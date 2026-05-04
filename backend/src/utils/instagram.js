const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execFileAsync = promisify(execFile);

function extractShortcode(url) {
  const patterns = [
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/reels\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/tv\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function detectPostType(url) {
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reel';
  if (url.includes('/tv/')) return 'tv';
  return 'post';
}

// ── Method 1: yt-dlp (most reliable, handles IG natively) ────────────────────
async function fetchViaYtDlp(url) {
  // Strategy: use --dump-json (not --dump-single-json) with --yes-playlist.
  // --dump-json outputs ONE JSON object per media item (one line per item),
  // which correctly expands carousel posts into multiple entries.
  // --dump-single-json wraps carousels in a playlist object whose entries[]
  // are often lazy (_type: 'url') and don't have resolved media URLs.
  const baseArgs = [
    '--no-warnings',
    '--no-check-certificates',
    '--dump-json',
    '--skip-download',
    '--yes-playlist',
    url,
  ];
  const opts = { maxBuffer: 20 * 1024 * 1024, timeout: 45000 };

  let stdout;
  try {
    ({ stdout } = await execFileAsync('yt-dlp', baseArgs, opts));
  } catch (_) {
    try {
      ({ stdout } = await execFileAsync('python3', ['-m', 'yt_dlp', ...baseArgs], opts));
    } catch (e2) {
      return null;
    }
  }

  // --dump-json outputs one JSON object per line (one per carousel item)
  const entries = stdout
    .split('\n')
    .filter(l => l.trim().startsWith('{'))
    .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(e => e && (e.url || e.formats));

  if (entries.length === 0) return null;

  const shortcode = extractShortcode(url);
  const postType = detectPostType(url);

  // Use first entry for post-level metadata
  const info = entries[0];

  const mediaItems = entries.map((entry, index) => {
    const isVideo = (entry.ext === 'mp4') || (entry.vcodec && entry.vcodec !== 'none');

    // For images: use the direct CDN URL
    // For videos: store the original post URL + item index so the download
    //   endpoint can run yt-dlp with bestvideo+bestaudio --playlist-items N
    let mediaUrl;
    let needsYtDlp = false;
    let ytDlpIndex = null; // 1-based index for yt-dlp --playlist-items

    if (isVideo) {
      mediaUrl = url; // original post URL
      needsYtDlp = true;
      ytDlpIndex = index + 1; // yt-dlp uses 1-based playlist index
    } else {
      mediaUrl = entry.url || (entry.formats && entry.formats.slice(-1)[0]?.url) || '';
    }

    // Thumbnail: prefer entry.thumbnail, then entry.url for images (it IS the image)
    const thumb = entry.thumbnail || (isVideo ? '' : (entry.url || ''));

    return {
      index,
      type: isVideo ? 'video' : 'image',
      url: mediaUrl,
      thumbnail: thumb,
      width: entry.width || 1080,
      height: entry.height || 1080,
      needsYtDlp,
      ytDlpIndex,
    };
  }).filter(m => m.url);

  if (mediaItems.length === 0) return null;

  const firstEntry = entries[0] || info;
  return {
    shortcode: shortcode || 'unknown',
    type: entries.length > 1 ? 'carousel' : postType,
    mediaCount: mediaItems.length,
    caption: (info.description || info.title || '').slice(0, 300),
    author: info.uploader || info.channel || 'instagram_user',
    thumbnail: info.thumbnail || mediaItems[0]?.thumbnail || '',
    originalUrl: url,
    mediaItems,
  };
}

// ── Method 2: Instagram oEmbed (public, no auth — gives thumbnail+title) ─────
async function fetchViaOEmbed(url, shortcode) {
  try {
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}&hidecaption=false`;
    const res = await axios.get(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    if (!res.data?.thumbnail_url) return null;

    const postType = detectPostType(url);
    // oEmbed only gives thumbnail — construct a usable single-item response
    return {
      shortcode: shortcode || 'unknown',
      type: postType,
      mediaCount: 1,
      caption: res.data.title || '',
      author: res.data.author_name || 'instagram_user',
      thumbnail: res.data.thumbnail_url,
      originalUrl: url,
      mediaItems: [{
        index: 0,
        type: 'image', // oEmbed never gives direct video URL, only thumbnail
        url: res.data.thumbnail_url,
        thumbnail: res.data.thumbnail_url,
        width: res.data.thumbnail_width || 1080,
        height: res.data.thumbnail_height || 1080,
      }],
    };
  } catch (_) {
    return null;
  }
}

// ── Method 3: Embed page scrape ──────────────────────────────────────────────
async function fetchViaEmbedPage(url, shortcode) {
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    const html = res.data;
    const videoMatch = html.match(/video_url":"([^"]+)"/);
    const imgMatch = html.match(/display_url":"([^"]+)"/);
    const captionMatch = html.match(/edge_media_to_caption.*?"text":"([^"]{0,200})/s);

    const rawVideoUrl = videoMatch
      ? videoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
      : null;
    const rawImgUrl = imgMatch
      ? imgMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
      : null;

    if (!rawVideoUrl && !rawImgUrl) return null;

    const mediaUrl = rawVideoUrl || rawImgUrl;
    const isVideo = !!rawVideoUrl;
    const postType = detectPostType(url);

    return {
      shortcode,
      type: postType === 'reel' ? 'reel' : isVideo ? 'video' : 'image',
      mediaCount: 1,
      caption: captionMatch ? captionMatch[1] : '',
      author: 'instagram_user',
      thumbnail: rawImgUrl || '',
      originalUrl: url,
      mediaItems: [{
        index: 0,
        type: isVideo ? 'video' : 'image',
        url: mediaUrl,
        thumbnail: rawImgUrl || mediaUrl,
        width: 1080,
        height: 1080,
      }],
    };
  } catch (_) {
    return null;
  }
}

// ── Main fetch function (tries all methods) ──────────────────────────────────
async function fetchInstagramPost(url) {
  const shortcode = extractShortcode(url);
  if (!shortcode) throw new Error('Invalid Instagram URL. Use a post, reel, or IGTV link.');

  // 1. yt-dlp (most reliable for actual media URLs)
  const ytResult = await fetchViaYtDlp(url);
  if (ytResult) return ytResult;

  // 2. Embed page scrape (gets actual video/image URL)
  const embedResult = await fetchViaEmbedPage(url, shortcode);
  if (embedResult) return embedResult;

  // 3. oEmbed (last resort — only gives thumbnail, not downloadable video)
  const oembedResult = await fetchViaOEmbed(url, shortcode);
  if (oembedResult) return oembedResult;

  throw new Error(
    'Could not fetch this Instagram post. Instagram may be rate-limiting requests. ' +
    'Make sure the post is public and try again in a moment.'
  );
}

module.exports = { extractShortcode, fetchInstagramPost };
