const express = require('express');
const router = express.Router();
const { getMe, updateProfile, checkUsername, searchUsers, getUserById, followUser, deleteAccount } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { reportUser, blockUser } = require('../controllers/reportController');

router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.post('/profile/reset-dating', protect, require('../controllers/userController').resetDatingProfile);
router.delete('/profile', protect, deleteAccount);
router.post('/check-username', checkUsername);
router.get('/search', protect, searchUsers);
router.get('/:id', protect, getUserById);
router.post('/:id/follow', protect, followUser);
router.post('/report', protect, reportUser);
router.post('/block', protect, blockUser);

// Admin Route
router.get('/admin/all', protect, require('../controllers/userController').getAllUsers);

module.exports = router;
