const express = require('express');
const router = express.Router();
const { getPosts, createPost, seedPosts, getUserPosts, addComment, getPostById, toggleLike, toggleBookmark, getSavedPosts } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPosts);
router.post('/', protect, createPost);
router.get('/saved', protect, getSavedPosts);
router.get('/user/:userId', protect, getUserPosts);
router.post('/:id/comment', protect, addComment);
router.put('/:id/like', protect, toggleLike);
router.put('/:id/bookmark', protect, toggleBookmark);
router.get('/:id', protect, getPostById);
router.post('/seed', protect, seedPosts);

module.exports = router;
