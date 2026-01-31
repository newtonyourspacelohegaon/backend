const User = require('../models/User');
const Report = require('../models/Report');

// @desc    Report a user
// @route   POST /api/users/report
exports.reportUser = async (req, res) => {
    try {
        const { targetUserId, reason, details } = req.body;
        const reporterId = req.user.id;

        if (!targetUserId || !reason) {
            return res.status(400).json({ message: 'Target user and reason are required' });
        }

        const report = new Report({
            reporter: reporterId,
            entityId: targetUserId,
            entityType: 'User',
            reason,
            description: details,
        });

        await report.save();

        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (error) {
        console.error('reportUser error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Block a user
// @route   POST /api/users/block
exports.blockUser = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const userId = req.user.id;

        if (!targetUserId) {
            return res.status(400).json({ message: 'Target user is required' });
        }

        // Add to blocked list in User model (Assume blockedUsers field exists or add it)
        await User.findByIdAndUpdate(userId, {
            $addToSet: { blockedUsers: targetUserId }
        });

        res.json({ success: true, message: 'User blocked' });
    } catch (error) {
        console.error('blockUser error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
