/**
 * YouTube utility using yt-dlp
 *
 * KEY INSIGHT about YouTube formats:
 * - Up to ~360p: "progressive" streams that have BOTH video+audio in one file
 * - 480p, 720p, 1080p, 1440p, 4K: "adaptive" streams — video-only + audio-only SEPARATE
 *   These require ffmpeg to merge. We use yt-dlp's built-in merge via format selector.
 *
 * Strategy for "Video + Audio" tab:
 *   We enumerate every unique height, then for each height we create a format entry
 *   using yt-dlp's selector: "bestvideo[height=H][ext=mp4]+bestaudio[ext=m4a]/best[height=H]"
 *   During download, yt-dlp merges via ffmpeg automatically.
 */

const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// ── helpers ──────────────────────────────────────────────────────────────────

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function ytdlpBin() { return 'yt-dlp'; }

function ytdlpBaseArgs() {
  return [
    '--no-warnings',
    '--no-check-certificates',
    // Use tv_embedded client which doesn't require sign-in/PO tokens
    // and works from server IPs that YouTube flags as bots
    '--extractor-args', 'youtube:player_client=tv_embedded,web_creator',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
}

// Fallback player clients to try if primary fails (bot detection workaround)
const FALLBACK_CLIENTS = [
  'tv_embedded,web_creator',
  'tv_embedded',
  'web_embedded',
  'default',
];

async function runYtDlp(extraArgs, clientOverride) {
  const baseArgs = clientOverride
    ? [
        '--no-warnings',
        '--no-check-certificates',
        '--extractor-args', `youtube:player_client=${clientOverride}`,
        '--user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ]
    : ytdlpBaseArgs();

  const args = [...baseArgs, ...extraArgs];
  const opts = { maxBuffer: 50 * 1024 * 1024, timeout: 45000 };
  try {
    const { stdout } = await execFileAsync(ytdlpBin(), args, opts);
    return stdout;
  } catch (e) {
    if (e.code === 'ENOENT') {
      // fallback to python module
      const { stdout } = await execFileAsync('python3', ['-m', 'yt_dlp', ...args], opts);
      return stdout;
    }
    throw e;
  }
}

// ── getVideoInfo ──────────────────────────────────────────────────────────────

async function getVideoInfo(url) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Try each player client in order until one works.
  // YouTube increasingly blocks server IPs — tv_embedded and web_creator
  // clients bypass the "Sign in to confirm you're not a bot" error.
  const infoArgs = ['--dump-single-json', '--skip-download', cleanUrl];
  let lastError;
  let stdout;

  for (const client of [null, ...FALLBACK_CLIENTS]) {
    try {
      stdout = await runYtDlp(infoArgs, client);
      // If we got output, break out of the retry loop
      if (stdout && stdout.trim()) break;
    } catch (e) {
      lastError = e;
      const msg = (e.stderr || e.message || '').toLowerCase();
      // Only retry on bot-detection errors
      if (msg.includes('sign in') || msg.includes('bot') || msg.includes('player response')) {
        continue;
      }
      throw e; // Non-bot error — don't retry
    }
  }

  if (!stdout || !stdout.trim()) {
    throw new Error(lastError?.message || 'Failed to fetch video info. Please try again.');
  }

  let info;
  try {
    const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'));
    if (!jsonLine) throw new Error('empty');
    info = JSON.parse(jsonLine);
  } catch (_) {
    throw new Error('Failed to parse yt-dlp output. Please try again.');
  }

  const rawFormats = info.formats || [];

  // ── COMBINED (Video + Audio) ──────────────────────────────────────────────
  // YouTube adaptive streams (480p+) are video-only. We collect ALL heights
  // that appear in any video format, then for each height build a yt-dlp
  // format selector that merges best video + best audio via ffmpeg.
  // Progressive streams (≤360p, already have audio) are used directly.

  const allVideoHeights = new Set();
  rawFormats.forEach(f => {
    if (f.height && f.vcodec && f.vcodec !== 'none') {
      allVideoHeights.add(f.height);
    }
  });

  // Progressive (already combined) formats by height
  const progressiveByHeight = new Map();
  rawFormats
    .filter(f => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none' && f.height)
    .forEach(f => {
      const h = f.height;
      if (!progressiveByHeight.has(h) || (f.tbr || 0) > (progressiveByHeight.get(h).tbr || 0)) {
        progressiveByHeight.set(h, f);
      }
    });

  const combinedFormats = [];
  const sortedHeights = [...allVideoHeights].sort((a, b) => b - a);

  sortedHeights.forEach(h => {
    const progressive = progressiveByHeight.get(h);
    const bestVideoFmt = rawFormats
      .filter(f => f.height === h && f.vcodec && f.vcodec !== 'none')
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];

    if (progressive) {
      combinedFormats.push({
        itag: progressive.format_id,
        quality: `${h}p`,
        container: progressive.ext || 'mp4',
        type: 'video+audio',
        needsMerge: false,
        fps: progressive.fps || null,
        filesize: progressive.filesize || progressive.filesize_approx || null,
      });
    } else {
      // Adaptive: yt-dlp will merge video + audio via ffmpeg on download
      const selector = `bestvideo[height=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=${h}]+bestaudio/best[height<=${h}]`;
      combinedFormats.push({
        itag: selector,
        quality: `${h}p`,
        container: 'mp4',
        type: 'video+audio',
        needsMerge: true,
        fps: bestVideoFmt?.fps || null,
        filesize: null,
      });
    }
  });

  // ── VIDEO ONLY: adaptive video streams ────────────────────────────────────
  const videoOnlyMap = new Map();
  rawFormats
    .filter(f => f.vcodec !== 'none' && f.acodec === 'none' && f.height)
    .forEach(f => {
      const key = `${f.height}-${f.fps || 30}`;
      if (!videoOnlyMap.has(key) || (f.tbr || 0) > (videoOnlyMap.get(key)._tbr || 0)) {
        videoOnlyMap.set(key, {
          itag: f.format_id,
          quality: `${f.height}p`,
          container: f.ext || 'mp4',
          type: 'video-only',
          needsMerge: false,
          fps: f.fps || null,
          filesize: f.filesize || f.filesize_approx || null,
          _tbr: f.tbr || 0,
        });
      }
    });

  // ── AUDIO ONLY ────────────────────────────────────────────────────────────
  const audioOnlyMap = new Map();
  rawFormats
    .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
    .forEach(f => {
      const kbps = Math.round(f.abr || 0);
      const key = `${kbps}-${f.ext}`;
      if (!audioOnlyMap.has(key)) {
        audioOnlyMap.set(key, {
          itag: f.format_id,
          quality: kbps ? `${kbps}kbps` : (f.format_note || 'audio'),
          container: f.ext || 'm4a',
          type: 'audio-only',
          needsMerge: false,
          audioBitrate: kbps || null,
          filesize: f.filesize || f.filesize_approx || null,
        });
      }
    });

  const sortByQuality = arr => [...arr].sort((a, b) => {
    const aH = parseInt(a.quality) || 0;
    const bH = parseInt(b.quality) || 0;
    return bH - aH;
  });

  // Clean up internal fields before returning
  const cleanFormats = arr => arr.map(f => { const c = {...f}; delete c._tbr; return c; });

  return {
    videoId,
    title: info.title,
    author: info.uploader || info.channel || 'Unknown',
    duration: info.duration,
    viewCount: info.view_count,
    thumbnail: info.thumbnail,
    description: (info.description || '').slice(0, 200),
    formats: {
      combined: sortByQuality(cleanFormats(combinedFormats)),
      videoOnly: sortByQuality(cleanFormats([...videoOnlyMap.values()])),
      audioOnly: cleanFormats([...audioOnlyMap.values()]).sort(
        (a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0)
      ),
    },
  };
}

// ── getDownloadStream ─────────────────────────────────────────────────────────

/**
 * Download a YouTube video to a temp file, then stream it to the response.
 *
 * WHY TEMP FILE: MP4 container requires random-access seeking to write the
 * moov atom (index). Piping directly to stdout produces audio-only or corrupt
 * files. We write to /tmp, stream the result, then clean up.
 *
 * @param {string} url
 * @param {string} formatIdOrSelector - format_id or yt-dlp format selector
 * @param {boolean} needsMerge - true for adaptive (video+audio merge via ffmpeg)
 * @param {object} res - Express response object
 * @param {string} filename - filename for Content-Disposition
 * @param {string} contentType
 */
async function downloadToResponse(url, formatIdOrSelector, needsMerge, res, filename, contentType) {
  const { execFile } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const videoId = extractVideoId(url);
  const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;

  // Unique temp file path
  const tmpFile = path.join(os.tmpdir(), `clipzy_yt_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

  const args = [
    ...ytdlpBaseArgs(),
    '-f', String(formatIdOrSelector),
    '--no-playlist',
    '-o', tmpFile,
  ];

  if (needsMerge) {
    args.push('--merge-output-format', 'mp4');
    args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
  }

  args.push(cleanUrl);

  return new Promise((resolve, reject) => {
    const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch (_) {} };

    let ytdlp;
    try {
      ytdlp = require('child_process').spawn(ytdlpBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (_) {
      ytdlp = require('child_process').spawn('python3', ['-m', 'yt_dlp', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    }

    let stderrBuf = '';
    ytdlp.stderr.on('data', d => {
      const msg = d.toString();
      if (!msg.startsWith('[download]') && !msg.startsWith('[info]') && !msg.startsWith('[youtube]')) {
        stderrBuf += msg;
      }
    });

    ytdlp.on('close', code => {
      if (code !== 0) {
        cleanup();
        if (!res.headersSent) {
          res.status(500).json({ error: 'yt-dlp failed. ' + stderrBuf.slice(0, 200) });
        }
        return resolve();
      }

      // yt-dlp may add .mp4 suffix automatically — check for it
      let actualFile = tmpFile;
      if (!fs.existsSync(tmpFile)) {
        // Try common suffixes yt-dlp might append
        const candidates = [tmpFile + '.mp4', tmpFile.replace('.mp4', '.webm'), tmpFile.replace('.mp4', '.mkv')];
        actualFile = candidates.find(f => fs.existsSync(f)) || tmpFile;
      }

      if (!fs.existsSync(actualFile)) {
        if (!res.headersSent) res.status(500).json({ error: 'Download file not found.' });
        return resolve();
      }

      const stat = fs.statSync(actualFile);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-cache');

      const fileStream = fs.createReadStream(actualFile);
      fileStream.pipe(res);
      fileStream.on('end', () => { cleanup(); resolve(); });
      fileStream.on('error', err => {
        cleanup();
        if (!res.headersSent) res.status(500).json({ error: 'Stream error.' });
        resolve();
      });
      res.on('close', () => cleanup()); // client disconnected
    });

    ytdlp.on('error', err => {
      cleanup();
      if (!res.headersSent) res.status(500).json({ error: 'Failed to start yt-dlp.' });
      resolve();
    });
  });
}

module.exports = { extractVideoId, getVideoInfo, downloadToResponse };
