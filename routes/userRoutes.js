const express = require('express');
const router = express.Router();
const { getMe, updateProfile, checkUsername, searchUsers, getUserById, followUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.post('/check-username', checkUsername);
router.get('/search', protect, searchUsers);
router.get('/:id', protect, getUserById);
router.post('/:id/follow', protect, followUser);
router.post('/:id/block', protect, require('../controllers/userController').blockUser);

module.exports = router;
