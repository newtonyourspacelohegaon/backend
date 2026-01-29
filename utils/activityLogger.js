const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity for a user
 * @param {Object} params
 * @param {string} params.userId - The user performing or affected by the action
 * @param {string} params.action - Action type (e.g., 'LOGIN', 'COINS_ADDED')
 * @param {Object} params.details - Additional details about the action
 * @param {Object} params.req - Express request object (optional, for IP/UA)
 * @param {string} params.performedBy - Admin user ID if action was done by admin
 */
const logActivity = async ({ userId, action, details = {}, req = null, performedBy = null }) => {
    try {
        const logEntry = {
            user: userId,
            action,
            details,
            performedBy,
        };

        if (req) {
            logEntry.ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
            logEntry.userAgent = req.headers['user-agent'];
        }

        await ActivityLog.create(logEntry);
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw - logging should not break main functionality
    }
};

module.exports = { logActivity };
