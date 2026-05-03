require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const youtubeRoutes = require('./routes/youtube');
const instagramRoutes = require('./routes/instagram');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS: allow localhost (any port) and Netlify ──────────────────────────────
const CORS_ORIGIN = process.env.FRONTEND_URL || '';

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Always allow localhost on any port during dev
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

    // Allow configured frontend URL
    if (CORS_ORIGIN && origin === CORS_ORIGIN) return callback(null, true);

    // Allow any netlify.app subdomain
    if (/\.netlify\.app$/.test(origin)) return callback(null, true);

    console.warn('CORS blocked:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Pre-flight
app.options('*', cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/api/health', healthRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/instagram', instagramRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Clipzy API is running 🎬', version: '1.0.0' });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }
  console.error('Global error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Clipzy backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${CORS_ORIGIN || 'localhost (any port)'}`);
});

module.exports = app;
