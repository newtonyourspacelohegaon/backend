const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined to not conflict uniqueness
  },
  fullName: String,
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
  },
  college: String,
  year: String,
  major: String,
  bio: String,
  profileImage: String,
  interests: [String],
  coins: {
    type: Number,
    default: 150, // Starting balance
  },
  items: [String],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
