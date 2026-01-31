const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getMyStatus,
    sendLike,
    getReceivedLikes,
    revealProfile,
    startChat,
    directChat,
    buyLikes,
    buyChatSlot,
    declineLike,
    getActiveChats,
    passUser,
    unmatchUser,
} = require('../controllers/likesController');

// All routes require authentication
router.use(protect);

// Status
router.get('/my-status', getMyStatus);

// Likes
router.post('/like/:userId', sendLike);
router.post('/pass/:userId', passUser);
router.get('/likes', getReceivedLikes);
router.post('/decline/:likeId', declineLike);

// Reveal & Chat
router.post('/reveal/:likeId', revealProfile);
router.post('/start-chat/:likeId', startChat);
router.post('/direct-chat/:likeId', directChat);
router.post('/unmatch/:likeId', unmatchUser);
router.get('/active-chats', getActiveChats);

// Purchases
router.post('/buy-likes', buyLikes);
router.post('/buy-chat-slot', buyChatSlot);

module.exports = router;
