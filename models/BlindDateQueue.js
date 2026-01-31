const mongoose = require('mongoose');

const blindDateQueueSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // Each user can only be in queue once
    },
    lookingFor: {
        type: String,
        enum: ['Women', 'Men', 'Everyone'],
        required: true,
    },
    gender: {
        type: String,
        enum: ['Man', 'Woman', 'Non-binary'],
        required: true,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
});

// TTL index - auto-remove from queue after 10 minutes of waiting
blindDateQueueSchema.index({ joinedAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('BlindDateQueue', blindDateQueueSchema);
