const { extractVideoId, getVideoInfo, downloadToResponse } = require('../utils/youtube');

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

    // Determine extension and content-type
    let ext = container || 'mp4';
    let contentType = 'video/mp4';

    if (type === 'audio-only') {
      ext = ['m4a', 'webm', 'opus', 'ogg'].includes(container) ? container : 'm4a';
      contentType = ext === 'm4a' ? 'audio/mp4' : 'audio/webm';
    } else if (ext === 'webm') {
      contentType = 'video/webm';
    }

    // needsMerge=true means adaptive streams that require ffmpeg to merge.
    // These MUST be written to a temp file first — mp4 containers require
    // random-access seeking that is impossible on a pipe/stdout.
    const needsMerge = req.query.needsMerge === 'true';
    if (needsMerge) {
      ext = 'mp4';
      contentType = 'video/mp4';
    }

    const safeTitle = (title || 'video')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .slice(0, 80) || 'clipzy-download';

    const filename = `${safeTitle}.${ext}`;

    await downloadToResponse(url, itag, needsMerge, res, filename, contentType);
  } catch (err) {
    console.error('YouTube download error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
  }
}

module.exports = { getInfo, download };
