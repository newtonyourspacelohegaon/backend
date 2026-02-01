const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { claimDailyReward, getRewardStatus } = require('../controllers/rewardController');

// @desc    Claim daily login reward
// @route   POST /api/rewards/daily
router.post('/daily', protect, claimDailyReward);

// @desc    Get reward status
// @route   GET /api/rewards/status
router.get('/status', protect, getRewardStatus);

module.exports = router;
