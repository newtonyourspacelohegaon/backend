const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'revealed', 'chatting', 'declined', 'passed', 'archived'],
        default: 'pending',
    },
    revealedAt: Date,
    chatStartedAt: Date,
    isBlindMatch: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index to prevent duplicate likes
likeSchema.index({ sender: 1, receiver: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
