/**
 * Format seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds) {
  const s = parseInt(seconds, 10);
  if (isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Format view count
 */
export function formatViews(views) {
  const n = parseInt(views, 10);
  if (isNaN(n)) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format file size in bytes to human readable
 */
export function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * Quality label to color
 */
export function qualityColor(quality) {
  if (!quality) return '#888';
  if (quality.includes('2160') || quality.includes('4K')) return '#f59e0b';
  if (quality.includes('1440')) return '#a78bfa';
  if (quality.includes('1080')) return '#34d399';
  if (quality.includes('720')) return '#60a5fa';
  if (quality.includes('480')) return '#f87171';
  return '#9ca3af';
}

/**
 * Truncate text
 */
export function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}
