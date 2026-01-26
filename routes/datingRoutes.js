const express = require('express');
const router = express.Router();
const { 
  getRecommendations, 
  switchMatch, 
  buyCoins,
  acceptDatingTerms,
  updateDatingProfile,
  getDatingProfile
} = require('../controllers/datingController');
const { protect } = require('../middleware/authMiddleware');

router.get('/recommendations', protect, getRecommendations);
router.post('/match/:id', protect, switchMatch);
router.post('/buy-coins', protect, buyCoins);

// Dating Profile Routes
router.post('/accept-terms', protect, acceptDatingTerms);
router.route('/profile')
  .get(protect, getDatingProfile)
  .patch(protect, updateDatingProfile);

module.exports = router;

