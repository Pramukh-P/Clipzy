const { extractShortcode, fetchInstagramPost } = require('../utils/instagram');
const axios = require('axios');
const { spawn } = require('child_process');

/**
 * GET /api/instagram/info?url=...
 */
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
 * GET /api/instagram/download?mediaUrl=...&filename=...
 * Proxies CDN media through the server (bypasses browser CORS on CDN)
 */
async function download(req, res) {
  try {
    const { mediaUrl, filename } = req.query;
    if (!mediaUrl) return res.status(400).json({ error: 'Media URL is required' });

    // Safety: only allow Instagram/Facebook CDN URLs
    const isCdn =
      mediaUrl.includes('cdninstagram.com') ||
      mediaUrl.includes('instagram.com') ||
      mediaUrl.includes('fbcdn.net') ||
      mediaUrl.includes('scontent') ||
      mediaUrl.includes('googleusercontent') || // yt-dlp sometimes uses this
      mediaUrl.startsWith('https://');           // fallback for yt-dlp direct URLs

    if (!isCdn) return res.status(400).json({ error: 'Invalid media URL' });

    const safeFilename =
      (filename || 'clipzy-instagram')
        .replace(/[^\w\s-]/gi, '')
        .trim() || 'clipzy-instagram';

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

module.exports = { getInfo, download };
