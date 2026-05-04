import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  r => r,
  err => {
    const msg = err.response?.data?.error || err.message || 'Something went wrong';
    return Promise.reject(new Error(msg));
  }
);

export async function pingBackend() {
  try {
    const res = await axios.get(`${BASE_URL}/api/health/ping`, { timeout: 5000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function wakeUpBackend(onProgress) {
  const MAX = 12;
  const DELAY = 5000;
  for (let i = 1; i <= MAX; i++) {
    if (onProgress) onProgress(i, MAX);
    if (await pingBackend()) return true;
    if (i < MAX) await new Promise(r => setTimeout(r, DELAY));
  }
  return false;
}

export async function getYouTubeInfo(url) {
  const res = await api.get('/api/youtube/info', { params: { url } });
  return res.data.data;
}

export function getYouTubeDownloadUrl(url, itag, title, type, container, needsMerge) {
  const p = new URLSearchParams({ url, itag, title: title || 'video', type: type || 'video+audio', container: container || 'mp4' });
  if (needsMerge) p.set('needsMerge', 'true');
  return `${BASE_URL}/api/youtube/download?${p.toString()}`;
}

export async function getInstagramInfo(url) {
  const res = await api.get('/api/instagram/info', { params: { url } });
  return res.data.data;
}

export function getInstagramDownloadUrl(mediaUrl, filename, needsYtDlp, ytDlpIndex) {
  const p = new URLSearchParams({ mediaUrl, filename: filename || 'clipzy-instagram' });
  if (needsYtDlp) p.set('needsYtDlp', 'true');
  if (ytDlpIndex != null) p.set('ytDlpIndex', String(ytDlpIndex));
  return `${BASE_URL}/api/instagram/download?${p.toString()}`;
}

export function getInstagramProxyImageUrl(cdnUrl) {
  if (!cdnUrl) return '';
  const p = new URLSearchParams({ url: cdnUrl });
  return `${BASE_URL}/api/instagram/proxy-image?${p.toString()}`;
}

export { BASE_URL };
export default api;
