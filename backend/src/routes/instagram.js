const express = require('express');
const router = express.Router();
const { getInfo, download } = require('../controllers/instagram');

// GET /api/instagram/info?url=<instagram_url>
router.get('/info', getInfo);

// GET /api/instagram/download?mediaUrl=<url>&filename=<name>
router.get('/download', download);

module.exports = router;
