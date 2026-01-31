const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    type: {
        type: String,
        enum: ['like', 'match', 'blind', 'chat', 'expiry', 'promo', 'admin'],
        default: 'admin',
    },
    read: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
