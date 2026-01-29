const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    action: {
        type: String,
        required: true,
        // Examples: 'LOGIN', 'LOGOUT', 'PROFILE_UPDATE', 'POST_CREATE', 'POST_DELETE', 
        // 'COINS_ADDED', 'COINS_DEDUCTED', 'DATING_PROFILE_SETUP', 'MATCH', etc.
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        // Flexible object to store action-specific data
        // e.g., { previousCoins: 100, newCoins: 150, addedBy: 'admin' }
    },
    ipAddress: String,
    userAgent: String,
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // If action was done by admin on behalf of user, this stores admin's ID
    },
}, { timestamps: true });

// Index for efficient querying
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
