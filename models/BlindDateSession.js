const mongoose = require('mongoose');

const blindDateSessionSchema = new mongoose.Schema({
    user1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    user2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'ended', 'extended'],
        default: 'active',
    },
    startTime: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    extended: {
        type: Boolean,
        default: false,
    },
    extendedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    user1Choice: {
        type: String,
        enum: ['none', 'reveal', 'chat', 'decline'],
        default: 'none',
    },
    user2Choice: {
        type: String,
        enum: ['none', 'reveal', 'chat', 'decline'],
        default: 'none',
    },
    user1Revealed: {
        type: Boolean,
        default: false,
    },
    user2Revealed: {
        type: Boolean,
        default: false,
    },
    // Store anonymous messages within the session
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        text: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for faster queries
blindDateSessionSchema.index({ user1: 1, status: 1 });
blindDateSessionSchema.index({ user2: 1, status: 1 });
blindDateSessionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('BlindDateSession', blindDateSessionSchema);
