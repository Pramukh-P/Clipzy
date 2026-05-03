import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getInstagramInfo, getInstagramDownloadUrl } from '../utils/api';
import { truncate } from '../utils/helpers';

const TypeBadge = ({ type }) => {
  const config = {
    reel: { label: 'Reel', color: '#ec4899', icon: '🎬' },
    video: { label: 'Video', color: '#a78bfa', icon: '📹' },
    image: { label: 'Photo', color: '#34d399', icon: '🖼' },
    carousel: { label: 'Carousel', color: '#f59e0b', icon: '🎠' },
    tv: { label: 'IGTV', color: '#60a5fa', icon: '📺' },
  };
  const c = config[type] || { label: type, color: '#888', icon: '📄' };
  return (
    <span className="type-badge" style={{ '--badge-color': c.color }}>
      {c.icon} {c.label}
    </span>
  );
};

const MediaItem = ({ item, index, selected, onToggle, onDownload, downloading }) => {
  const isVideo = item.type === 'video';
  const isDownloading = downloading === index;
  return (
    <motion.div
      className={`media-item ${selected ? 'selected' : ''}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.07 }}
    >
      {/* Checkbox */}
      <div
        className={`media-check ${selected ? 'checked' : ''}`}
        onClick={() => onToggle(index)}
      >
        {selected && (
          <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Preview */}
      <div className="media-preview" onClick={() => onToggle(index)}>
        {isVideo ? (
          <div className="media-video-thumb">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={`Item ${index + 1}`} />
            ) : (
              <div className="video-placeholder">
                <span>▶</span>
              </div>
            )}
            <div className="video-play-overlay">▶</div>
          </div>
        ) : (
          <img
            src={item.url || item.thumbnail}
            alt={`Item ${index + 1}`}
            className="media-img"
            onError={(e) => {
              e.target.src = item.thumbnail || '';
            }}
          />
        )}
        <div className="media-type-icon">{isVideo ? '🎬' : '🖼'}</div>
        <div className="media-index">#{index + 1}</div>
      </div>

      {/* View & Download buttons */}
      <div className="media-actions">
        <a
          href={item.url || item.thumbnail}
          target="_blank"
          rel="noopener noreferrer"
          className="media-view-btn"
        >
          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
            <path d="M8 3C4.5 3 1.5 5.5 1 8c.5 2.5 3.5 5 7 5s6.5-2.5 7-5c-.5-2.5-3.5-5-7-5z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          View
        </a>
        <button
          className={`media-dl-btn ${isDownloading ? 'loading' : ''}`}
          onClick={() => onDownload(item, index)}
          disabled={!!downloading}
        >
          {isDownloading ? (
            <span className="spinner-sm" />
          ) : (
            <>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                <path d="M8 1v9M4 7l4 4 4-4M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Save
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

const Instagram = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [postData, setPostData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(null); // index or 'all'
  const inputRef = useRef(null);

  const handleFetch = async (e) => {
    e?.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setPostData(null);
    setSelected(new Set());

    try {
      const data = await getInstagramInfo(url.trim());
      setPostData(data);
      // Select all by default
      setSelected(new Set(data.mediaItems.map((_, i) => i)));
    } catch (err) {
      setError(err.message || 'Failed to fetch post. Make sure it\'s a public post.');
      toast.error(err.message || 'Failed to fetch Instagram post');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = () => {
    navigator.clipboard.readText().then((text) => setUrl(text)).catch(() => {});
  };

  const toggleSelect = (index) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === postData.mediaItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(postData.mediaItems.map((_, i) => i)));
    }
  };

  const downloadItem = async (item, index) => {
    if (downloading !== null) return;
    setDownloading(index);
    try {
      const filename = `clipzy-ig-${postData.shortcode}-${index + 1}`;
      const dlUrl = getInstagramDownloadUrl(item.url, filename);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started!');
    } catch (err) {
      toast.error('Download failed. Try again.');
    } finally {
      setTimeout(() => setDownloading(null), 2000);
    }
  };

  const downloadSelected = async () => {
    if (downloading !== null || selected.size === 0) return;
    setDownloading('all');

    const items = postData.mediaItems.filter((_, i) => selected.has(i));
    let count = 0;

    for (const item of items) {
      const idx = postData.mediaItems.indexOf(item);
      const filename = `clipzy-ig-${postData.shortcode}-${idx + 1}`;
      const dlUrl = getInstagramDownloadUrl(item.url, filename);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      count++;
      await new Promise((r) => setTimeout(r, 600)); // stagger downloads
    }

    toast.success(`Started ${count} download${count > 1 ? 's' : ''}!`);
    setDownloading(null);
  };

  return (
    <div className="page ig-page">
      <div className="page-bg">
        <div className="blob blob-ig-1" />
        <div className="blob blob-ig-2" />
      </div>

      <div className="page-content">
        {/* Header */}
        <motion.div
          className="page-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="page-icon ig-icon-bg">
            <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
              <rect x="8" y="8" width="32" height="32" rx="10" stroke="url(#igPageGrad)" strokeWidth="3" fill="none" />
              <circle cx="24" cy="24" r="7" stroke="url(#igPageGrad)" strokeWidth="2.5" />
              <circle cx="34" cy="14" r="2" fill="url(#igPageGrad)" />
              <defs>
                <linearGradient id="igPageGrad" x1="8" y1="48" x2="48" y2="8" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F58529" />
                  <stop offset="0.5" stopColor="#DD2A7B" />
                  <stop offset="1" stopColor="#515BD4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="page-title">Instagram Downloader</h1>
            <p className="page-subtitle">Download posts, reels, carousels and more</p>
          </div>
        </motion.div>

        {/* URL Input */}
        <motion.form
          className="url-form"
          onSubmit={handleFetch}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="url-input-wrap">
            <svg className="url-icon" viewBox="0 0 20 20" fill="none" width="18" height="18">
              <rect x="2" y="2" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <circle cx="14.5" cy="5.5" r="1" fill="currentColor" opacity="0.4" />
            </svg>
            <input
              ref={inputRef}
              className="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/... or /reel/..."
              disabled={loading}
              autoFocus
            />
            {url && (
              <button
                type="button"
                className="url-clear"
                onClick={() => { setUrl(''); setPostData(null); setError(''); }}
              >✕</button>
            )}
            {!url && (
              <button type="button" className="url-paste-btn" onClick={handlePaste}>
                Paste
              </button>
            )}
          </div>

          <motion.button
            type="submit"
            className="fetch-btn ig-fetch-btn"
            disabled={loading || !url.trim()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? (
              <><span className="spinner-sm" /> Fetching…</>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <rect x="2" y="2" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Get Post
              </>
            )}
          </motion.button>
        </motion.form>

        {/* Tip */}
        <motion.div
          className="ig-tip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          💡 Only public posts can be downloaded. Copy the link from Instagram and paste here.
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="error-box"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading && (
          <motion.div className="loading-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="loading-pulse" />
            <div className="loading-pulse short" />
            <div className="loading-grid">
              {[1, 2, 3].map(i => <div key={i} className="loading-square" />)}
            </div>
          </motion.div>
        )}

        {/* Post Result */}
        <AnimatePresence>
          {postData && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Post Info Card */}
              <div className="post-card">
                <div className="post-card-top">
                  <div className="post-author">
                    <div className="post-avatar">
                      {postData.author?.[0]?.toUpperCase() || 'I'}
                    </div>
                    <div>
                      <div className="post-username">@{postData.author}</div>
                      <TypeBadge type={postData.type} />
                    </div>
                  </div>
                  <div className="post-count">
                    {postData.mediaCount} {postData.mediaCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
                {postData.caption && (
                  <p className="post-caption">"{truncate(postData.caption, 150)}"</p>
                )}
              </div>

              {/* Media Grid */}
              {postData.mediaItems?.length > 0 && (
                <>
                  {/* Select controls */}
                  <div className="media-controls">
                    <button className="select-all-btn" onClick={toggleAll}>
                      {selected.size === postData.mediaItems.length ? '☑ Deselect All' : '☐ Select All'}
                    </button>
                    <span className="selected-count">
                      {selected.size} of {postData.mediaItems.length} selected
                    </span>
                  </div>

                  {/* Grid */}
                  <div className={`media-grid ${postData.mediaItems.length === 1 ? 'single' : ''}`}>
                    {postData.mediaItems.map((item, i) => (
                      <MediaItem
                        key={i}
                        item={item}
                        index={i}
                        selected={selected.has(i)}
                        onToggle={toggleSelect}
                        onDownload={downloadItem}
                        downloading={typeof downloading === 'number' ? downloading : null}
                      />
                    ))}
                  </div>

                  {/* Download All button */}
                  {postData.mediaItems.length > 1 && (
                    <motion.button
                      className={`download-all-btn ${downloading === 'all' ? 'loading' : ''}`}
                      onClick={downloadSelected}
                      disabled={downloading !== null || selected.size === 0}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {downloading === 'all' ? (
                        <><span className="spinner-sm" /> Downloading…</>
                      ) : (
                        <>
                          <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                            <path d="M10 3v10M5 9l5 5 5-5M3 16h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          Download Selected ({selected.size})
                        </>
                      )}
                    </motion.button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Instagram;
