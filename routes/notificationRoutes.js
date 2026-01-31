const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    registerPushToken,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(protect);

// Register push token
router.post('/register', registerPushToken);

// Get user's notifications
router.get('/', getUserNotifications);

// Mark single notification as read
router.put('/:id/read', markAsRead);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

module.exports = router;
