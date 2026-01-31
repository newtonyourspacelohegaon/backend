const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Story = require('../models/Story');
const Report = require('../models/Report');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/authMiddleware');
const { logActivity } = require('../utils/activityLogger');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized as admin' });
    }
    req.adminUser = user;
    next();
};

// @desc    Admin Login (Username only for dev/demo)
// @route   POST /api/admin/login
router.post('/login', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ message: 'Username is required' });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Not an admin.' });
        }

        // Generate JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Log admin login
        await logActivity({
            userId: user._id,
            action: 'ADMIN_LOGIN',
            details: { username },
            req,
        });

        res.json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                isAdmin: user.isAdmin,
            },
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
router.get('/stats', protect, isAdmin, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const postCount = await Post.countDocuments();
        const reportCount = await Report.countDocuments({ status: 'Pending' });

        // Calculate total revenue
        const Transaction = require('../models/Transaction');
        const transactions = await Transaction.find({ status: 'completed' });
        const totalRevenue = transactions.reduce((acc, curr) => acc + (curr.price || 0), 0);

        res.json({ userCount, postCount, reportCount, totalRevenue });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get Revenue Stats for Graph
// @route   GET /api/admin/stats/revenue
router.get('/stats/revenue', protect, isAdmin, async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');

        // Get transactions from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const stats = await Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$price" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.json(stats);
    } catch (error) {
        console.error('Revenue stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get All Transactions
// @route   GET /api/admin/transactions
router.get('/transactions', protect, isAdmin, async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');
        const transactions = await Transaction.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('user', 'username fullName email');

        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get User Activity Logs
// @route   GET /api/admin/users/:id/logs
router.get('/users/:id/logs', protect, isAdmin, async (req, res) => {
    try {
        const logs = await ActivityLog.find({ user: req.params.id })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('performedBy', 'username fullName');

        res.json(logs);
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get Single User Details (Admin)
// @route   GET /api/admin/users/:id
router.get('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Update User (Admin) - Modify coins, ban, etc.
// @route   PATCH /api/admin/users/:id
router.patch('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        const { coins, isAdmin: makeAdmin, isBanned, isVerified, note } = req.body;
        const targetUser = await User.findById(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const changes = {};
        const previousValues = {};

        // Handle coin modifications
        if (coins !== undefined) {
            previousValues.coins = targetUser.coins;
            targetUser.coins = coins;
            changes.coins = coins;
        }

        // Handle admin status
        if (makeAdmin !== undefined) {
            previousValues.isAdmin = targetUser.isAdmin;
            targetUser.isAdmin = makeAdmin;
            changes.isAdmin = makeAdmin;
        }

        // Handle ban status
        if (isBanned !== undefined) {
            previousValues.isBanned = targetUser.isBanned;
            targetUser.isBanned = isBanned;
            changes.isBanned = isBanned;
        }

        // Handle verification status
        if (isVerified !== undefined) {
            previousValues.isVerified = targetUser.isVerified;
            targetUser.isVerified = isVerified;
            changes.isVerified = isVerified;
        }

        await targetUser.save();

        // Log the admin action
        await logActivity({
            userId: targetUser._id,
            action: 'ADMIN_MODIFIED_USER',
            details: {
                changes,
                previousValues,
                note: note || 'No note provided',
            },
            req,
            performedBy: req.user.id,
        });

        res.json({ message: 'User updated successfully', user: targetUser });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Reset User Dating Profile (Admin)
// @route   POST /api/admin/users/:id/reset-dating
router.post('/users/:id/reset-dating', protect, isAdmin, require('../controllers/userController').adminResetDatingProfile);

// @desc    Add Coins to User
// @route   POST /api/admin/users/:id/add-coins
router.post('/users/:id/add-coins', protect, isAdmin, async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const targetUser = await User.findById(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const previousCoins = targetUser.coins;
        targetUser.coins += parseInt(amount) || 0;
        await targetUser.save();

        await logActivity({
            userId: targetUser._id,
            action: 'COINS_ADDED',
            details: {
                previousCoins,
                newCoins: targetUser.coins,
                amount,
                reason: reason || 'Admin added coins',
            },
            req,
            performedBy: req.user.id,
        });

        res.json({ message: `Added ${amount} coins`, user: targetUser });
    } catch (error) {
        console.error('Add coins error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Deduct Coins from User
// @route   POST /api/admin/users/:id/deduct-coins
router.post('/users/:id/deduct-coins', protect, isAdmin, async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const targetUser = await User.findById(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const previousCoins = targetUser.coins;
        targetUser.coins = Math.max(0, targetUser.coins - (parseInt(amount) || 0));
        await targetUser.save();

        await logActivity({
            userId: targetUser._id,
            action: 'COINS_DEDUCTED',
            details: {
                previousCoins,
                newCoins: targetUser.coins,
                amount,
                reason: reason || 'Admin deducted coins',
            },
            req,
            performedBy: req.user.id,
        });

        res.json({ message: `Deducted ${amount} coins`, user: targetUser });
    } catch (error) {
        console.error('Deduct coins error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get All Posts (Admin)
// @route   GET /api/admin/posts
router.get('/posts', protect, isAdmin, async (req, res) => {
    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('user', 'username fullName profileImage');
        res.json(posts);
    } catch (error) {
        console.error('Get all posts error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Delete Post (Admin)
// @route   DELETE /api/admin/posts/:id
router.delete('/posts/:id', protect, isAdmin, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        await Post.findByIdAndDelete(req.params.id);

        await logActivity({
            action: 'ADMIN_DELETED_POST',
            details: {
                postId: post._id,
                postCaption: post.caption,
                postOwner: post.user
            },
            req,
            performedBy: req.user.id,
        });

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get All Stories (Admin)
// @route   GET /api/admin/stories
router.get('/stories', protect, isAdmin, async (req, res) => {
    try {
        const stories = await Story.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('user', 'username fullName profileImage');
        res.json(stories);
    } catch (error) {
        console.error('Get all stories error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Delete Story (Admin)
// @route   DELETE /api/admin/stories/:id
router.delete('/stories/:id', protect, isAdmin, async (req, res) => {
    try {
        await Story.findByIdAndDelete(req.params.id);
        res.json({ message: 'Story deleted successfully' });
    } catch (error) {
        console.error('Delete story error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get All Reports (Admin)
// @route   GET /api/admin/reports
router.get('/reports', protect, isAdmin, async (req, res) => {
    try {
        const reports = await Report.find()
            .sort({ createdAt: -1 })
            .populate('reporter', 'username profileImage')
            .limit(100);
        res.json(reports);
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Handle Report (Admin)
// @route   PATCH /api/admin/reports/:id
router.patch('/reports/:id', protect, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.json(report);
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Delete User
// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent self-deletion
        if (targetUser._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        await User.findByIdAndDelete(req.params.id);

        // Delete associated posts
        await Post.deleteMany({ user: req.params.id });

        await logActivity({
            action: 'ADMIN_DELETED_USER',
            details: {
                deletedUserId: targetUser._id,
                username: targetUser.username,
                email: targetUser.email
            },
            req,
            performedBy: req.user.id,
        });

        res.json({ message: 'User and associated content deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
