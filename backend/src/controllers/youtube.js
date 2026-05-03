const { extractVideoId, getVideoInfo, getDownloadStream } = require('../utils/youtube');

async function getInfo(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL.' });

    const info = await getVideoInfo(url);
    return res.json({ success: true, data: info });
  } catch (err) {
    console.error('YouTube info error:', err.message);
    if (err.message?.includes('private') || err.message?.includes('unavailable')) {
      return res.status(400).json({ error: 'This video is private or unavailable.' });
    }
    if (err.message?.includes('yt-dlp is not installed')) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to fetch video info. Please try again.' });
  }
}

async function download(req, res) {
  try {
    const { url, itag, title, type, container } = req.query;
    if (!url || !itag) return res.status(400).json({ error: 'URL and format id are required' });

    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    // Determine correct extension and content-type
    let ext = container || 'mp4';
    let contentType = 'video/mp4';

    if (type === 'audio-only') {
      // yt-dlp audio formats can be m4a, webm, or opus
      ext = ['m4a', 'webm', 'opus', 'ogg'].includes(container) ? container : 'webm';
      contentType = ext === 'm4a' ? 'audio/mp4' : 'audio/webm';
    } else if (ext === 'webm') {
      contentType = 'video/webm';
    }

    const safeTitle = (title || 'video')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .slice(0, 80) || 'clipzy-download';

    const filename = `${safeTitle}.${ext}`;

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    const proc = getDownloadStream(url, itag);

    proc.stdout.pipe(res);

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      // Only log actual errors, not progress lines
      if (msg && !msg.startsWith('[download]') && !msg.startsWith('[info]') && !msg.startsWith('[youtube]')) {
        console.error('yt-dlp:', msg.slice(0, 150));
      }
    });

    proc.on('error', (err) => {
      console.error('yt-dlp spawn error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
    });

    req.on('close', () => {
      try { proc.kill(); } catch (_) {}
    });
  } catch (err) {
    console.error('YouTube download error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
  }
}

module.exports = { getInfo, download };
