const express = require('express');
const router = express.Router();
const { getRecommendations, switchMatch, buyCoins } = require('../controllers/datingController');
const { protect } = require('../middleware/authMiddleware');

router.get('/recommendations', protect, getRecommendations);
router.post('/match/:id', protect, switchMatch);
router.post('/buy-coins', protect, buyCoins);

module.exports = router;
