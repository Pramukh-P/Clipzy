const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

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

async function runYtDlpInfo(args) {
  const baseArgs = [
    '--no-warnings',
    '--no-check-certificates',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...args,
  ];
  const opts = { maxBuffer: 50 * 1024 * 1024, timeout: 45000 };
  try {
    const { stdout } = await execFileAsync('yt-dlp', baseArgs, opts);
    return stdout;
  } catch (e1) {
    try {
      const { stdout } = await execFileAsync('python3', ['-m', 'yt_dlp', ...baseArgs], opts);
      return stdout;
    } catch (e2) {
      throw new Error('yt-dlp is not installed. Run: pip install yt-dlp');
    }
  }
}

async function getVideoInfo(url) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const stdout = await runYtDlpInfo(['--dump-single-json', '--skip-download', cleanUrl]);

  let info;
  try {
    const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'));
    if (!jsonLine) throw new Error('No JSON output');
    info = JSON.parse(jsonLine);
  } catch (e) {
    throw new Error('Failed to parse yt-dlp output');
  }

  const rawFormats = info.formats || [];

  // ── Quality label helper ──────────────────────────────────────────
  const qlabel = (f) => {
    if (f.height) return `${f.height}p`;
    if (f.format_note) return f.format_note;
    return 'auto';
  };

  // ── COMBINED (video+audio in one stream — "progressive") ──────────
  // yt-dlp marks these with both vcodec and acodec not "none"
  const combinedMap = new Map();
  rawFormats
    .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
    .forEach(f => {
      const key = qlabel(f);
      if (!combinedMap.has(key) || (f.filesize || 0) > (combinedMap.get(key).filesize || 0)) {
        combinedMap.set(key, {
          itag: f.format_id,
          quality: key,
          container: f.ext || 'mp4',
          type: 'video+audio',
          fps: f.fps || null,
          filesize: f.filesize || f.filesize_approx || null,
          url: f.url,
        });
      }
    });

  // ── VIDEO-ONLY adaptive formats ───────────────────────────────────
  const videoOnlyMap = new Map();
  rawFormats
    .filter(f => f.vcodec !== 'none' && f.acodec === 'none')
    .forEach(f => {
      const key = `${qlabel(f)}-${f.fps || ''}`;
      if (!videoOnlyMap.has(key)) {
        videoOnlyMap.set(key, {
          itag: f.format_id,
          quality: qlabel(f),
          container: f.ext || 'mp4',
          type: 'video-only',
          fps: f.fps || null,
          filesize: f.filesize || f.filesize_approx || null,
          url: f.url,
        });
      }
    });

  // ── AUDIO-ONLY formats ────────────────────────────────────────────
  const audioOnlyMap = new Map();
  rawFormats
    .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
    .forEach(f => {
      const kbps = f.abr ? Math.round(f.abr) : 0;
      const key = `${kbps}-${f.ext}`;
      if (!audioOnlyMap.has(key)) {
        audioOnlyMap.set(key, {
          itag: f.format_id,
          quality: kbps ? `${kbps}kbps` : (f.format_note || 'audio'),
          container: f.ext || 'm4a',
          type: 'audio-only',
          audioBitrate: kbps || null,
          filesize: f.filesize || f.filesize_approx || null,
          url: f.url,
        });
      }
    });

  // Sort by resolution descending
  const sortQ = arr =>
    [...arr].sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));

  return {
    videoId,
    title: info.title,
    author: info.uploader || info.channel || 'Unknown',
    duration: info.duration,
    viewCount: info.view_count,
    thumbnail: info.thumbnail,
    description: (info.description || '').slice(0, 200),
    formats: {
      combined: sortQ([...combinedMap.values()]),
      videoOnly: sortQ([...videoOnlyMap.values()]),
      audioOnly: [...audioOnlyMap.values()].sort(
        (a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0)
      ),
    },
  };
}

function spawnYtDlp(args) {
  try {
    return spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (_) {
    return spawn('python3', ['-m', 'yt_dlp', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
}

function getDownloadStream(url, formatId) {
  const videoId = extractVideoId(url);
  const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
  const args = [
    '--no-warnings',
    '--no-check-certificates',
    '-f', String(formatId),
    '-o', '-',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    cleanUrl,
  ];
  return spawnYtDlp(args);
}

module.exports = { extractVideoId, getVideoInfo, getDownloadStream };
