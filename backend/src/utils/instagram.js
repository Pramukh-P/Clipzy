const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

function ytdlpBin() {
  const localBin = path.join(__dirname, '..', '..', 'bin', 'yt-dlp');
  if (fs.existsSync(localBin)) return localBin;
  return 'yt-dlp';
}

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

// Parse Instagram GraphQL media node (handles single + carousel)
function parseGraphQLMedia(media, url, shortcode) {
  const postType = detectPostType(url);
  const isCarousel = media.__typename === 'GraphSidecar' || !!media.carousel_media;
  let mediaItems = [];

  if (isCarousel) {
    const children = media.edge_sidecar_to_children?.edges?.map(e => e.node)
      || media.carousel_media || [];

    children.forEach((node, i) => {
      const isVideo = node.is_video || node.__typename === 'GraphVideo';
      if (isVideo) {
        mediaItems.push({
          index: i, type: 'video', url,
          thumbnail: node.display_url || node.thumbnail_src || '',
          width: node.dimensions?.width || 1080, height: node.dimensions?.height || 1080,
          needsYtDlp: true, ytDlpIndex: i + 1,
        });
      } else {
        const imgUrl = node.display_url || node.thumbnail_src || '';
        mediaItems.push({
          index: i, type: 'image', url: imgUrl, thumbnail: imgUrl,
          width: node.dimensions?.width || 1080, height: node.dimensions?.height || 1080,
          needsYtDlp: false, ytDlpIndex: null,
        });
      }
    });
  } else {
    const isVideo = media.is_video || media.__typename === 'GraphVideo';
    if (isVideo) {
      mediaItems.push({
        index: 0, type: 'video', url,
        thumbnail: media.display_url || media.thumbnail_src || '',
        width: media.dimensions?.width || 1080, height: media.dimensions?.height || 1080,
        needsYtDlp: true, ytDlpIndex: null,
      });
    } else {
      const imgUrl = media.display_url || media.thumbnail_src || '';
      mediaItems.push({
        index: 0, type: 'image', url: imgUrl, thumbnail: imgUrl,
        width: media.dimensions?.width || 1080, height: media.dimensions?.height || 1080,
        needsYtDlp: false, ytDlpIndex: null,
      });
    }
  }

  if (mediaItems.length === 0) return null;
  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text
    || media.caption?.text || '';
  const author = media.owner?.username || media.user?.username || 'instagram_user';
  return {
    shortcode, type: mediaItems.length > 1 ? 'carousel' : (mediaItems[0].type === 'video' ? postType : 'post'),
    mediaCount: mediaItems.length, caption: caption.slice(0, 300), author,
    thumbnail: mediaItems[0]?.thumbnail || '', originalUrl: url, mediaItems,
  };
}

// ── Method 1: Instagram ?__a=1 JSON endpoint ─────────────────────────────────
async function fetchViaGraphQL(url, shortcode) {
  try {
    const jsonUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
    const res = await axios.get(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/',
        'Cookie': process.env.INSTAGRAM_SESSION_ID ? `sessionid=${process.env.INSTAGRAM_SESSION_ID}` : '',
      },
      timeout: 15000,
    });
    const data = res.data;
    const media = data?.items?.[0] || data?.graphql?.shortcode_media || data?.data?.xdt_shortcode_media;
    if (!media) return null;
    return parseGraphQLMedia(media, url, shortcode);
  } catch (_) { return null; }
}

// ── Method 2: Embed page scrape ───────────────────────────────────────────────
async function fetchViaEmbedScrape(url, shortcode) {
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 20000,
    });
    const html = res.data;

    // Try structured JSON first
    const jsonMatch = html.match(/window\.__additionalDataLoaded\([^,]+,({.+?})\);<\/script>/s)
      || html.match(/PolarisQueryPreloaderQuery.*?({\"data\":{.+?})<\/script>/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const media = parsed?.data?.xdt_shortcode_media
          || parsed?.shortcode_media || parsed?.graphql?.shortcode_media;
        if (media) {
          const r = parseGraphQLMedia(media, url, shortcode);
          if (r) return r;
        }
      } catch (_) {}
    }

    // Fallback: extract all CDN image URLs from raw HTML
    const postType = detectPostType(url);
    const imgUrls = [];
    const seen = new Set();

    // Match all display_url entries (each carousel image appears once)
    const displayUrlRe = /"display_url":"(https:\\\/\\\/[^"]+\.jpg[^"]*)"/g;
    let m;
    while ((m = displayUrlRe.exec(html)) !== null) {
      const clean = m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      // Deduplicate by removing query string for comparison
      const base = clean.split('?')[0];
      if (!seen.has(base)) { seen.add(base); imgUrls.push(clean); }
    }

    const videoMatch = html.match(/video_url":"(https:\\\/\\\/[^"]+\.mp4[^"]*)/);
    const videoUrl = videoMatch
      ? videoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
      : null;

    const captionMatch = html.match(/"text":"([^"]{0,300})"/);
    const authorMatch = html.match(/"username":"([^"]+)"/);

    if (imgUrls.length === 0 && !videoUrl) return null;

    const mediaItems = [];
    if (videoUrl) {
      mediaItems.push({
        index: 0, type: 'video', url,
        thumbnail: imgUrls[0] || '', width: 1080, height: 1920,
        needsYtDlp: true, ytDlpIndex: null,
      });
    } else {
      imgUrls.slice(0, 10).forEach((imgUrl, i) => {
        mediaItems.push({
          index: i, type: 'image', url: imgUrl, thumbnail: imgUrl,
          width: 1080, height: 1080, needsYtDlp: false, ytDlpIndex: null,
        });
      });
    }

    return {
      shortcode, type: mediaItems.length > 1 ? 'carousel' : (videoUrl ? postType : 'post'),
      mediaCount: mediaItems.length, caption: captionMatch ? captionMatch[1] : '',
      author: authorMatch ? authorMatch[1] : 'instagram_user',
      thumbnail: mediaItems[0]?.thumbnail || '', originalUrl: url, mediaItems,
    };
  } catch (_) { return null; }
}

// ── Method 3: yt-dlp ──────────────────────────────────────────────────────────
async function fetchViaYtDlp(url) {
  const baseArgs = ['--no-warnings', '--no-check-certificates', '--dump-json', '--skip-download', '--yes-playlist', url];
  const opts = { maxBuffer: 20 * 1024 * 1024, timeout: 45000 };
  let stdout;
  try {
    ({ stdout } = await execFileAsync(ytdlpBin(), baseArgs, opts));
  } catch (_) {
    try {
      ({ stdout } = await execFileAsync('python3', ['-m', 'yt_dlp', ...baseArgs], opts));
    } catch (e2) { return null; }
  }

  const entries = stdout.split('\n')
    .filter(l => l.trim().startsWith('{'))
    .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(e => e && (e.url || e.formats));

  if (entries.length === 0) return null;
  const shortcode = extractShortcode(url);
  const postType = detectPostType(url);
  const info = entries[0];

  const mediaItems = entries.map((entry, index) => {
    const isVideo = (entry.ext === 'mp4') || (entry.vcodec && entry.vcodec !== 'none');
    return {
      index, type: isVideo ? 'video' : 'image',
      url: isVideo ? url : (entry.url || (entry.formats && entry.formats.slice(-1)[0]?.url) || ''),
      thumbnail: entry.thumbnail || (isVideo ? '' : (entry.url || '')),
      width: entry.width || 1080, height: entry.height || 1080,
      needsYtDlp: isVideo, ytDlpIndex: isVideo ? (index + 1) : null,
    };
  }).filter(m => m.url);

  if (mediaItems.length === 0) return null;
  return {
    shortcode: shortcode || 'unknown',
    type: entries.length > 1 ? 'carousel' : postType,
    mediaCount: mediaItems.length,
    caption: (info.description || info.title || '').slice(0, 300),
    author: info.uploader || info.channel || 'instagram_user',
    thumbnail: info.thumbnail || mediaItems[0]?.thumbnail || '',
    originalUrl: url, mediaItems,
  };
}

// ── Method 4: oEmbed last resort ─────────────────────────────────────────────
async function fetchViaOEmbed(url, shortcode) {
  try {
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}&hidecaption=false`;
    const res = await axios.get(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000,
    });
    if (!res.data?.thumbnail_url) return null;
    const postType = detectPostType(url);
    const t = res.data.thumbnail_url;
    return {
      shortcode: shortcode || 'unknown', type: postType, mediaCount: 1,
      caption: res.data.title || '', author: res.data.author_name || 'instagram_user',
      thumbnail: t, originalUrl: url,
      mediaItems: [{ index: 0, type: 'image', url: t, thumbnail: t,
        width: res.data.thumbnail_width || 1080, height: res.data.thumbnail_height || 1080,
        needsYtDlp: false, ytDlpIndex: null }],
    };
  } catch (_) { return null; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchInstagramPost(url) {
  const shortcode = extractShortcode(url);
  if (!shortcode) throw new Error('Invalid Instagram URL. Use a post, reel, or IGTV link.');

  // 1. ?__a=1 GraphQL (best for carousel — full structured data)
  const gqlResult = await fetchViaGraphQL(url, shortcode);
  if (gqlResult && gqlResult.mediaItems.length > 0) return gqlResult;

  // 2. Embed page scrape (extracts carousel images from HTML/JSON)
  const embedResult = await fetchViaEmbedScrape(url, shortcode);
  if (embedResult && embedResult.mediaItems.length > 0) return embedResult;

  // 3. yt-dlp (reliable for videos, hit-or-miss for carousels)
  const ytResult = await fetchViaYtDlp(url);
  if (ytResult && ytResult.mediaItems.length > 0) return ytResult;

  // 4. oEmbed last resort
  const oembedResult = await fetchViaOEmbed(url, shortcode);
  if (oembedResult) return oembedResult;

  throw new Error('Could not fetch this Instagram post. Make sure it is public and try again.');
}

module.exports = { extractShortcode, fetchInstagramPost };
