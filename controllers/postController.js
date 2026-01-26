const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Get Feed Posts (with pagination)
// @route   GET /api/posts?page=1&limit=10
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({
      user: { $nin: req.user.blockedUsers }
    })
      .populate('user', 'username fullName profileImage isVerified college followers')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1); // Get one extra to check if more exist

    // Check if there are more posts
    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    res.json({
      posts: postsToReturn,
      hasMore,
      page,
      limit
    });
  } catch (error) {
    console.error('Get Posts Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a Post
// @route   POST /api/posts
exports.createPost = async (req, res) => {
  try {
    const { image, caption } = req.body;
    
    if (!image) return res.status(400).json({ message: 'Image is required' });

    const post = await Post.create({
      user: req.user.id,
      image,
      caption
    });

    // Populate user for immediate frontend display
    await post.populate('user', 'username fullName profileImage');

    res.json(post);
  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get Single Post
// @route   GET /api/posts/:id
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username profileImage')
      .populate('comments.user', 'username profileImage');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get Posts by Specific User
// @route   GET /api/posts/user/:userId
exports.getUserPosts = async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('user', 'username fullName profileImage')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add Comment to Post
// @route   POST /api/posts/:id/comment
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const newComment = {
      user: req.user.id,
      text,
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    // Return the new comment with populated user
    const populatedPost = await post.populate('comments.user', 'username profileImage');
    const addedComment = populatedPost.comments[populatedPost.comments.length - 1];

    res.json(addedComment);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Like/Unlike Post
// @route   PUT /api/posts/:id/like
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Convert ObjectIds to strings for proper comparison
    const likeIds = post.likes.map(id => id.toString());
    const userId = req.user.id.toString();

    // Check if post has already been liked by this user
    if (likeIds.includes(userId)) {
      // Unlike - remove user from likes array
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      // Like - add user to likes array
      post.likes.push(req.user.id);
    }

    await post.save();
    res.json(post.likes);
  } catch (error) {
    console.error('Toggle Like Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Seed Dummy Posts (For Demo)
// @route   POST /api/posts/seed
exports.seedPosts = async (req, res) => {
  try {
    // Create a dummy post linked to the current user (or random)
    const post = await Post.create({
      user: req.user.id,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50da6a3a?w=800', // Dummy Image
      caption: '🎭✨ Unwind 2026 Day 1 was INSANE! #UnwindFest #ADYPU',
    });
    res.json({ message: 'Seeded successfully', post });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
