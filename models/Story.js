const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  viewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(+new Date() + 24*60*60*1000), // 24 hours from now
    index: true // Index for efficient expiry queries
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Static method to get active (non-expired) stories
storySchema.statics.getActiveStories = function() {
  return this.find({
    expiresAt: { $gt: new Date() },
    isArchived: false
  })
  .populate('user', 'username fullName profileImage')
  .sort({ createdAt: -1 });
};

// Instance method to archive a story
storySchema.methods.archive = async function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Story', storySchema);
