const { extractShortcode, fetchInstagramPost } = require('../utils/instagram');
const axios = require('axios');
const { spawn } = require('child_process');

/**
 * GET /api/instagram/info?url=...\n */
async function getInfo(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!url.includes('instagram.com')) {
      return res.status(400).json({ error: 'Please enter a valid Instagram URL' });
    }
    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return res.status(400).json({ error: 'Invalid Instagram URL. Use a post, reel, or IGTV link.' });
    }

    const postData = await fetchInstagramPost(url);
    return res.json({ success: true, data: postData });
  } catch (err) {
    console.error('Instagram info error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to fetch Instagram post.' });
  }
}

/**
 * GET /api/instagram/download?mediaUrl=...&filename=...&needsYtDlp=true
 * - If needsYtDlp=true: mediaUrl is the original Instagram post URL.
 *   We invoke yt-dlp with bestvideo+bestaudio merge to get video WITH audio.
 * - Otherwise: proxy the CDN image/video URL directly.
 */
async function download(req, res) {
  try {
    const { mediaUrl, filename, needsYtDlp } = req.query;
    if (!mediaUrl) return res.status(400).json({ error: 'Media URL is required' });

    const safeFilename =
      (filename || 'clipzy-instagram')
        .replace(/[^\w\s-]/gi, '')
        .trim() || 'clipzy-instagram';

    // ── Video download via yt-dlp with temp file (audio+video merged) ─────────
    // IMPORTANT: MP4 container requires random-access seeking — piping to stdout
    // produces audio-only files. Must write to temp file then stream.
    if (needsYtDlp === 'true') {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const { execFile: execFileRaw } = require('child_process');

      const { ytDlpIndex } = req.query;
      const tmpFile = path.join(os.tmpdir(), `clipzy_ig_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

      const ytdlpArgs = [
        '--no-warnings',
        '--no-check-certificates',
        '-f', 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '-o', tmpFile,
      ];

      if (ytDlpIndex) {
        ytdlpArgs.push('--playlist-items', String(ytDlpIndex));
      } else {
        ytdlpArgs.push('--no-playlist');
      }

      ytdlpArgs.push(mediaUrl);

      const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch (_) {} };

      const runYtDlp = (bin, args) => new Promise((resolve, reject) => {
        const proc = require('child_process').spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderrBuf = '';
        proc.stderr.on('data', d => { stderrBuf += d.toString(); });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(stderrBuf.slice(0, 300))));
        proc.on('error', reject);
      });

      try {
        try {
          await runYtDlp('yt-dlp', ytdlpArgs);
        } catch (_) {
          await runYtDlp('python3', ['-m', 'yt_dlp', ...ytdlpArgs]);
        }

        // yt-dlp may suffix the filename — detect actual output file
        let actualFile = tmpFile;
        if (!fs.existsSync(tmpFile)) {
          const candidates = [tmpFile + '.mp4', tmpFile.replace('.mp4', '.mkv'), tmpFile.replace('.mp4', '.webm')];
          actualFile = candidates.find(f => fs.existsSync(f)) || tmpFile;
        }

        if (!fs.existsSync(actualFile)) {
          if (!res.headersSent) res.status(500).json({ error: 'Download failed: output file missing.' });
          return;
        }

        const stat = fs.statSync(actualFile);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-cache');

        const fileStream = fs.createReadStream(actualFile);
        fileStream.pipe(res);
        fileStream.on('end', () => { cleanup(); });
        fileStream.on('error', () => { cleanup(); });
        res.on('close', () => cleanup());
      } catch (err) {
        cleanup();
        console.error('yt-dlp (ig) error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Video download failed. ' + err.message.slice(0, 100) });
      }
      return;
    }

    // ── Image (or plain CDN video) proxy ─────────────────────────────────────
    const isCdn =
      mediaUrl.includes('cdninstagram.com') ||
      mediaUrl.includes('instagram.com') ||
      mediaUrl.includes('fbcdn.net') ||
      mediaUrl.includes('scontent') ||
      mediaUrl.includes('googleusercontent') ||
      mediaUrl.startsWith('https://');

    if (!isCdn) return res.status(400).json({ error: 'Invalid media URL' });

    const response = await axios({
      method: 'GET',
      url: mediaUrl,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
      },
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const isVideo = contentType.includes('video') || mediaUrl.endsWith('.mp4');
    const ext = isVideo ? 'mp4' : 'jpg';

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}.${ext}"`);
    res.setHeader('Content-Type', contentType);
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.data.pipe(res);
    response.data.on('error', (err) => {
      console.error('Instagram stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
  } catch (err) {
    console.error('Instagram download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download. The media link may have expired.' });
    }
  }
}


/**
 * GET /api/instagram/proxy-image?url=...
 * Proxies CDN images for frontend previews (Instagram CDN blocks direct img src)
 */
async function proxyImage(req, res) {
  try {
    const { url: imgUrl } = req.query;
    if (!imgUrl || !imgUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const response = await axios({
      method: 'GET',
      url: imgUrl,
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    response.data.pipe(res);
  } catch (err) {
    console.error('proxy-image error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to proxy image' });
  }
}

module.exports = { getInfo, download, proxyImage };
