import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getYouTubeInfo, getYouTubeDownloadUrl } from '../utils/api';
import { formatDuration, formatViews, formatFileSize, qualityColor, truncate } from '../utils/helpers';

const TYPE_ICON = { 'video+audio': '🎬', 'video-only': '📹', 'audio-only': '🎵' };
const TYPE_LABEL = { 'video+audio': 'Video + Audio', 'video-only': 'Video Only', 'audio-only': 'Audio Only' };

const QualityBadge = ({ quality, type }) => {
  const color = qualityColor(quality);
  return (
    <span className="quality-badge" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
      {quality}
    </span>
  );
};

const FormatCard = ({ format, onDownload, downloading }) => {
  const isDownloading = downloading === format.itag;
  return (
    <motion.div
      className={`format-card ${isDownloading ? 'downloading' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
    >
      <div className="format-left">
        <span className="format-icon">{TYPE_ICON[format.type]}</span>
        <div>
          <div className="format-quality-row">
            <QualityBadge quality={format.quality} type={format.type} />
            <span className="format-container">{(format.container || 'mp4').toUpperCase()}</span>
            {format.fps && <span className="format-fps">{format.fps}fps</span>}
            {format.audioBitrate && <span className="format-fps">{format.audioBitrate}kbps</span>}
          </div>
          <span className="format-type-label">{TYPE_LABEL[format.type]}</span>
        </div>
      </div>
      <div className="format-right">
        {format.filesize && <span className="format-size">{formatFileSize(format.filesize)}</span>}
        <button
          className={`dl-btn ${isDownloading ? 'dl-btn-loading' : ''}`}
          onClick={() => onDownload(format)}
          disabled={!!downloading}
        >
          {isDownloading ? <span className="spinner-sm" /> : (
            <>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path d="M8 1v9M4 6l4 4 4-4M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

const YouTube = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('combined');
  const [downloading, setDownloading] = useState(null);
  const inputRef = useRef(null);

  const handleFetch = async (e) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setVideoData(null);
    try {
      const data = await getYouTubeInfo(trimmed);
      setVideoData(data);
      if (data.formats?.combined?.length > 0) setActiveTab('combined');
      else if (data.formats?.videoOnly?.length > 0) setActiveTab('videoOnly');
      else setActiveTab('audioOnly');
    } catch (err) {
      setError(err.message || 'Failed to fetch video.');
      toast.error(err.message || 'Failed to fetch video');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = () => {
    navigator.clipboard.readText().then(t => setUrl(t)).catch(() => {});
  };

  const handleDownload = (format) => {
    if (downloading) return;
    setDownloading(format.itag);
    try {
      const dlUrl = getYouTubeDownloadUrl(url.trim(), format.itag, videoData.title, format.type, format.container, format.needsMerge);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = '';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started! Check your Downloads folder.');
    } catch (err) {
      toast.error('Download failed. Please try again.');
    } finally {
      setTimeout(() => setDownloading(null), 4000);
    }
  };

  const tabs = [
    { key: 'combined',  label: 'Video + Audio', icon: '🎬', formats: videoData?.formats?.combined || [] },
    { key: 'videoOnly', label: 'Video Only',    icon: '📹', formats: videoData?.formats?.videoOnly || [] },
    { key: 'audioOnly', label: 'Audio Only',    icon: '🎵', formats: videoData?.formats?.audioOnly || [] },
  ];

  const activeFormats = tabs.find(t => t.key === activeTab)?.formats || [];

  return (
    <div className="page yt-page">
      <div className="page-bg">
        <div className="blob blob-yt-1" />
        <div className="blob blob-yt-2" />
      </div>

      <div className="page-content">
        {/* Header */}
        <motion.div className="page-header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="page-icon yt-icon-bg">
            <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
              <path d="M38.5 16.2C38.2 15.1 37.3 14.2 36.2 13.9C34.2 13.4 24 13.4 24 13.4C24 13.4 13.8 13.4 11.8 13.9C10.7 14.2 9.8 15.1 9.5 16.2C9 18.2 9 24 9 24C9 24 9 29.8 9.5 31.8C9.8 32.9 10.7 33.8 11.8 34.1C13.8 34.6 24 34.6 24 34.6C24 34.6 34.2 34.6 36.2 34.1C37.3 33.8 38.2 32.9 38.5 31.8C39 29.8 39 24 39 24C39 24 39 18.2 38.5 16.2ZM21 28.6V19.4L29.5 24L21 28.6Z" fill="#FF0000" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">YouTube Downloader</h1>
            <p className="page-subtitle">All formats powered by yt-dlp — paste any YouTube URL</p>
          </div>
        </motion.div>

        {/* URL Form */}
        <motion.form className="url-form" onSubmit={handleFetch}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="url-input-wrap">
            <svg className="url-icon" viewBox="0 0 20 20" fill="none" width="18" height="18">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            </svg>
            <input
              ref={inputRef}
              className="url-input"
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
              disabled={loading}
              autoFocus
            />
            {url && (
              <button type="button" className="url-clear" onClick={() => { setUrl(''); setVideoData(null); setError(''); }}>✕</button>
            )}
            {!url && (
              <button type="button" className="url-paste-btn" onClick={handlePaste}>Paste</button>
            )}
          </div>
          <motion.button
            type="submit"
            className="fetch-btn yt-fetch-btn"
            disabled={loading || !url.trim()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? <><span className="spinner-sm" /> Fetching…</> : (
              <><svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 7l4 3-4 3V7z" fill="currentColor" />
              </svg> Get Formats</>
            )}
          </motion.button>
        </motion.form>

        <AnimatePresence>
          {error && (
            <motion.div className="error-box"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <motion.div className="loading-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="loading-pulse" />
            <div className="loading-pulse short" />
            <div className="loading-pulse shorter" />
          </motion.div>
        )}

        <AnimatePresence>
          {videoData && (
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Video card */}
              <div className="video-card">
                <div className="video-thumb-wrap">
                  <img src={videoData.thumbnail} alt={videoData.title} className="video-thumb"
                    onError={e => { e.target.style.display = 'none'; }} />
                  <div className="video-duration-badge">{formatDuration(videoData.duration)}</div>
                </div>
                <div className="video-meta">
                  <h2 className="video-title">{truncate(videoData.title, 90)}</h2>
                  <div className="video-stats">
                    <span>👤 {videoData.author}</span>
                    <span>👁 {formatViews(videoData.viewCount)} views</span>
                    <span>⏱ {formatDuration(videoData.duration)}</span>
                  </div>
                  {/* Format counts summary */}
                  <div className="format-summary">
                    {tabs.map(t => t.formats.length > 0 && (
                      <span key={t.key} className="format-summary-badge">
                        {t.icon} {t.formats.length} {t.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="format-tabs">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    className={`format-tab ${activeTab === t.key ? 'active' : ''} ${t.formats.length === 0 ? 'disabled' : ''}`}
                    onClick={() => t.formats.length > 0 && setActiveTab(t.key)}
                  >
                    {t.icon} {t.label}
                    <span className="tab-count">{t.formats.length}</span>
                  </button>
                ))}
              </div>

              {/* Format list */}
              <div className="format-list">
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}
                  >
                    {activeFormats.length === 0 ? (
                      <div className="empty-formats">No formats available in this category</div>
                    ) : (
                      activeFormats.map(f => (
                        <FormatCard key={f.itag} format={f} onDownload={handleDownload} downloading={downloading} />
                      ))
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default YouTube;
