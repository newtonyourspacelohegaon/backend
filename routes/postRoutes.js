const express = require('express');
const router = express.Router();
const { getPosts, createPost, seedPosts, getUserPosts, addComment, getPostById, toggleLike } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPosts);
router.post('/', protect, createPost);
router.get('/user/:userId', protect, getUserPosts);
router.post('/:id/comment', protect, addComment);
router.post('/:id/comment', protect, addComment);
router.put('/:id/like', protect, toggleLike);
router.get('/:id', protect, getPostById);
router.post('/seed', protect, seedPosts);

module.exports = router;
