const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
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
        const reportCount = 0; // Placeholder

        res.json({ userCount, postCount, reportCount });
    } catch (error) {
        console.error('Stats error:', error);
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
        const { coins, isAdmin: makeAdmin, isBanned, note } = req.body;
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

module.exports = router;
