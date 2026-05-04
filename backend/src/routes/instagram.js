const express = require('express');
const router = express.Router();
const { getInfo, download, proxyImage } = require('../controllers/instagram');

// GET /api/instagram/info?url=<instagram_url>
router.get('/info', getInfo);

// GET /api/instagram/download?mediaUrl=<url>&filename=<name>
router.get('/download', download);

// GET /api/instagram/proxy-image?url=<cdn_url>  (for previews - bypasses CORS)
router.get('/proxy-image', proxyImage);

module.exports = router;
