const express = require('express');
const router = express.Router();
const {
    joinQueue,
    leaveQueue,
    getStatus,
    sendMessage,
    getMessages,
    extendSession,
    endSession,
} = require('../controllers/blindDatingController');
const { protect } = require('../middleware/authMiddleware');

// Queue management
router.post('/join', protect, joinQueue);
router.post('/leave', protect, leaveQueue);
router.get('/status', protect, getStatus);

// Session management
router.post('/session/:id/message', protect, sendMessage);
router.get('/session/:id/messages', protect, getMessages);
router.post('/session/:id/extend', protect, extendSession);
router.post('/session/:id/end', protect, endSession);

module.exports = router;
