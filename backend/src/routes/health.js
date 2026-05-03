const express = require('express');
const router = express.Router();

// Health check endpoint - used by Render and frontend keep-alive
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Clipzy API is awake and healthy 🟢',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ping endpoint for keep-alive
router.get('/ping', (req, res) => {
  res.status(200).json({ pong: true, time: Date.now() });
});

module.exports = router;
