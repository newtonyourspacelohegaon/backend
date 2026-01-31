const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, markAsRead, deleteConversation } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send', protect, sendMessage);
router.put('/read/:userId', protect, markAsRead);
router.delete('/:userId', protect, deleteConversation);
router.get('/:userId', protect, getMessages);

module.exports = router;
