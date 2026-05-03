import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const features = [
  { icon: '⚡', text: 'Lightning fast' },
  { icon: '🎯', text: 'All qualities' },
  { icon: '🔒', text: 'No sign-up' },
  { icon: '🎵', text: 'Audio only' },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home">
      {/* Background blobs */}
      <div className="home-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="grid-overlay" />
      </div>

      <div className="home-content">
        {/* Hero */}
        <motion.div
          className="hero"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* <motion.div
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <span className="badge-dot" />
            Free · Fast · No ads
          </motion.div> */}

          <h1 className="hero-title">
            Download
            <span className="hero-gradient"> anything</span>
            <br />
            in seconds.
          </h1>

          <p className="hero-sub">
            YouTube videos in every quality. Instagram posts, reels & carousels.
            <br />
            Just paste, click, download — no accounts needed.
          </p>

          {/* Feature pills */}
          <div className="feature-pills">
            {features.map((f, i) => (
              <motion.span
                key={i}
                className="feature-pill"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                {f.icon} {f.text}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Platform Cards */}
        <div className="platform-grid">
          {/* YouTube Card */}
          <motion.button
            className="platform-card yt-card"
            onClick={() => navigate('/youtube')}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="platform-glow yt-glow" />

            <div className="platform-icon">
              <svg viewBox="0 0 48 48" fill="none" width="56" height="56">
                <rect width="48" height="48" rx="14" fill="#FF0000" />
                <path d="M38.5 16.2C38.2 15.1 37.3 14.2 36.2 13.9C34.2 13.4 24 13.4 24 13.4C24 13.4 13.8 13.4 11.8 13.9C10.7 14.2 9.8 15.1 9.5 16.2C9 18.2 9 24 9 24C9 24 9 29.8 9.5 31.8C9.8 32.9 10.7 33.8 11.8 34.1C13.8 34.6 24 34.6 24 34.6C24 34.6 34.2 34.6 36.2 34.1C37.3 33.8 38.2 32.9 38.5 31.8C39 29.8 39 24 39 24C39 24 39 18.2 38.5 16.2ZM21 28.6V19.4L29.5 24L21 28.6Z" fill="white" />
              </svg>
            </div>

            <div className="platform-info">
              <h2 className="platform-title">YouTube</h2>
              <p className="platform-desc">
                Download videos in 4K, 1080p, 720p and more. Extract audio as MP3. Shorts & full videos supported.
              </p>
              <div className="platform-tags">
                <span className="p-tag">MP4</span>
                <span className="p-tag">MP3</span>
                <span className="p-tag">4K</span>
                <span className="p-tag">Shorts</span>
              </div>
            </div>

            <div className="platform-arrow">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.button>

          {/* Instagram Card */}
          <motion.button
            className="platform-card ig-card"
            onClick={() => navigate('/instagram')}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="platform-glow ig-glow" />

            <div className="platform-icon">
              <svg viewBox="0 0 48 48" fill="none" width="56" height="56">
                <rect width="48" height="48" rx="14" fill="url(#igGrad)" />
                <rect x="12" y="12" width="24" height="24" rx="7" stroke="white" strokeWidth="2.5" fill="none" />
                <circle cx="24" cy="24" r="5.5" stroke="white" strokeWidth="2.5" />
                <circle cx="33" cy="15" r="1.5" fill="white" />
                <defs>
                  <linearGradient id="igGrad" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F58529" />
                    <stop offset="0.4" stopColor="#DD2A7B" />
                    <stop offset="0.7" stopColor="#8134AF" />
                    <stop offset="1" stopColor="#515BD4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="platform-info">
              <h2 className="platform-title">Instagram</h2>
              <p className="platform-desc">
                Download posts, reels, carousels & IGTV. Preview before saving. Batch-download multi-photo posts.
              </p>
              <div className="platform-tags">
                <span className="p-tag">Reels</span>
                <span className="p-tag">Posts</span>
                <span className="p-tag">Carousels</span>
                <span className="p-tag">IGTV</span>
              </div>
            </div>

            <div className="platform-arrow">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.button>
        </div>

        {/* Stats bar */}
        <motion.div
          className="stats-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {[
            { value: '4K', label: 'Max Quality' },
            { value: '100%', label: 'Free Forever' },
            { value: '2', label: 'Platforms' },
            { value: '0', label: 'Sign-ups' },
          ].map((s, i) => (
            <div className="stat-item" key={i}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
