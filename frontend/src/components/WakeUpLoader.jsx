import React from 'react';
import { motion } from 'framer-motion';

const WakeUpLoader = ({ attempt, maxAttempts, onRetry, failed }) => {
  const progress = (attempt / maxAttempts) * 100;
  const messages = [
    'Waking up the server…',
    'Server is sleeping on free tier…',
    'Stretching and yawning…',
    'Booting up the engine…',
    'Almost there, hold tight…',
    'Rendering takes time on free plans…',
    'Just a few more seconds…',
    'Server is almost awake…',
    'Checking connections…',
    'Final checks running…',
    'Nearly ready…',
    'One last ping…',
  ];

  const currentMessage = messages[Math.min(attempt - 1, messages.length - 1)] || messages[0];

  return (
    <div className="wake-up-overlay">
      <div className="wake-up-card">
        {/* Animated logo */}
        <motion.div
          className="wake-logo"
          animate={failed ? {} : {
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="16" fill="url(#wakeGrad)" />
            <path d="M20 22L44 32L20 42V22Z" fill="white" opacity="0.9" />
            <defs>
              <linearGradient id="wakeGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        <h2 className="wake-title">
          {failed ? 'Server Unreachable' : 'Server is Waking Up'}
        </h2>

        {!failed ? (
          <>
            <p className="wake-message">{currentMessage}</p>

            {/* Animated dots */}
            <div className="wake-dots">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="wake-dot"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="wake-progress-track">
              <motion.div
                className="wake-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            <p className="wake-hint">
              Render free tier servers sleep after inactivity.<br />
              First request takes ~30–60 seconds. ☕
            </p>
          </>
        ) : (
          <>
            <p className="wake-message">
              Could not reach the server after {maxAttempts} attempts.
            </p>
            <button className="wake-retry-btn" onClick={onRetry}>
              Try Again
            </button>
            <p className="wake-hint">
              Make sure the backend is deployed and running on Render.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default WakeUpLoader;
