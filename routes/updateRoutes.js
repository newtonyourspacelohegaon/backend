const express = require('express');
const router = express.Router();
const { checkUpdate, getLatestVersion, refreshCache } = require('../controllers/updateController');

// Public routes - no auth required for update checks
router.get('/check', checkUpdate);
router.get('/latest', getLatestVersion);
router.post('/refresh', refreshCache); // Clear cache and fetch fresh from GitHub

module.exports = router;
