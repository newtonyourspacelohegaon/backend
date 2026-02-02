const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // New: Array of image URLs (supports multiple images)
  images: [{
    type: String
  }],
  // Legacy: Single image field for backward compat
  image: {
    type: String,
  },
  caption: String,
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual to always return images array (handles old posts with single image)
postSchema.virtual('allImages').get(function () {
  if (this.images && this.images.length > 0) {
    return this.images;
  }
  // Fallback for old posts with single image
  if (this.image) {
    return [this.image];
  }
  return [];
});

// Ensure virtuals are included in JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
