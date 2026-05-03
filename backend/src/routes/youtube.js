const express = require('express');
const router = express.Router();
const { getInfo, download } = require('../controllers/youtube');

// GET /api/youtube/info?url=<youtube_url>
router.get('/info', getInfo);

// GET /api/youtube/download?url=<url>&itag=<itag>&title=<title>&type=<type>
router.get('/download', download);

module.exports = router;
