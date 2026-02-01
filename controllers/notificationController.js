const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendBulkNotifications } = require('../utils/pushService');

/**
 * Register/Update user's Expo push token
 * POST /api/notifications/register
 */
exports.registerPushToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        console.log(`[Push Registration] Intent for User: ${userId}, Token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);

        if (!token) {
            return res.status(400).json({ message: 'Push token is required' });
        }

        const user = await User.findByIdAndUpdate(userId, { expoPushToken: token }, { new: true });

        if (!user) {
            console.log(`[Push Registration] User NOT FOUND: ${userId}`);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`[Push Registration] SUCCESS for ${user.username} (${userId})`);
        res.json({ success: true, message: 'Push token registered' });
    } catch (error) {
        console.error('Register push token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Get user's notification history
 * GET /api/notifications
 */
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Notification.countDocuments({ userId });
        const unreadCount = await Notification.countDocuments({ userId, read: false });

        res.json({
            notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            unreadCount,
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ success: true, notification });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await Notification.updateMany({ userId, read: false }, { read: true });

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Admin: Send broadcast notification
 * POST /api/admin/notifications/broadcast
 */
exports.sendBroadcast = async (req, res) => {
    try {
        const { title, body, target, targetUserId } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: 'Title and body are required' });
        }

        let users;
        if (target === 'specific' && targetUserId) {
            users = await User.find({ _id: targetUserId, expoPushToken: { $exists: true, $ne: null } })
                .select('_id expoPushToken');
        } else if (target === 'verified') {
            users = await User.find({ isStudentVerified: true, expoPushToken: { $exists: true, $ne: null } })
                .select('_id expoPushToken');
        } else {
            // All users with push tokens
            users = await User.find({ expoPushToken: { $exists: true, $ne: null } })
                .select('_id expoPushToken');
        }

        if (users.length === 0) {
            return res.status(400).json({ message: 'No users with push tokens found' });
        }

        const notifications = users.map(user => ({
            token: user.expoPushToken,
            title,
            body,
            data: { type: 'promo' },
            userId: user._id,
            type: 'promo',
        }));

        await sendBulkNotifications(notifications);

        res.json({
            success: true,
            message: `Broadcast sent to ${users.length} users`,
            count: users.length,
        });
    } catch (error) {
        console.error('Send broadcast error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
