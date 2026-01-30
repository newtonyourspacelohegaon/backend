const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    // unique: true, // Removed to prevent "dup key: null" error for Google users
    sparse: true, // Allows multiple users without phone numbers
  },
  email: {
    type: String,
    unique: true,
    index: true,
    sparse: true,
  },
  googleId: {
    type: String,
    unique: true,
    index: true,
    sparse: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined to not conflict uniqueness
  },
  fullName: String,
  isAdmin: { type: Boolean, default: false },
  age: Number,
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
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false,
  },

  // Dating Mode Profile Fields
  datingTermsAccepted: {
    type: Boolean,
    default: false,
  },
  datingTermsAcceptedAt: Date,
  datingProfileComplete: {
    type: Boolean,
    default: false,
  },
  datingGender: {
    type: String,
    enum: ['Man', 'Woman', 'Non-binary'],
  },
  datingLookingFor: {
    type: String,
    enum: ['Women', 'Men', 'Everyone'],
  },
  datingAge: Number,
  datingHeight: String,
  datingHometown: String,
  datingCollege: String,
  datingCourse: String,
  datingIntentions: [String], // ['Long-term relationship', 'Casual dating', etc.]
  datingBio: String,
  datingInterests: [String],
  datingPhotos: [String], // Array of photo URLs

  // Likes & Chat Slots System
  likes: {
    type: Number,
    default: 5, // Starting likes
  },
  lastLikeRegenTime: {
    type: Date,
    default: Date.now,
  },
  chatSlots: {
    type: Number,
    default: 2, // Will be set based on gender: 2 for male, 4 for female
  },
  activeChatCount: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);

