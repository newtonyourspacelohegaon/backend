const User = require('../models/User');

// @desc    Get Current User Profile
// @route   GET /api/users/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('followers', '_id')
      .populate('following', '_id');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Send back raw user doc plus explicit counts if frontend needs them easily
    const userData = user.toObject();
    userData.followersCount = user.followers.length;
    userData.followingCount = user.following.length;

    res.json(userData);
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Search Users
// @route   GET /api/users/search
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    // If no query, return random/popular users (limit 10)
    // If query, search by username or fullName
    let query = {};
    if (q) {
      query = {
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { fullName: { $regex: q, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('username fullName profileImage college isVerified')
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get Specific User by ID
// @route   GET /api/users/:id
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -phoneNumber -otp -otpExpires')
      .populate('followers', 'username profileImage')
      .populate('following', 'username profileImage');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if current user follows this user
    const isFollowing = user.followers.some(f => f._id.toString() === req.user.id);

    // Return user object + isFollowing flag
    res.json({ ...user.toObject(), isFollowing });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Follow/Unfollow User
// @route   POST /api/users/:id/follow
exports.followUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!targetUser || !currentUser) return res.status(404).json({ message: 'User not found' });

    const isFollowing = targetUser.followers.includes(req.user.id);

    if (isFollowing) {
      // Unfollow
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user.id);
      currentUser.following = currentUser.following.filter(id => id.toString() !== req.params.id);
      await targetUser.save();
      await currentUser.save();
      res.json({ success: true, isFollowing: false, message: 'Unfollowed' });
    } else {
      // Follow
      targetUser.followers.push(req.user.id);
      currentUser.following.push(req.params.id);
      await targetUser.save();
      await currentUser.save();
      res.json({ success: true, isFollowing: true, message: 'Followed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Check Username Availability
// @route   POST /api/users/check-username
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });
    if (user) {
      return res.json({ available: false });
    }
    res.json({ available: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update User Profile (Bio, Interests, etc.)
// @route   PATCH /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, fullName, age, bio, college, year, major, interests, profileImage, coverImage } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If username is changing, ensure it's unique
    if (username && username !== user.username) {
      const exists = await User.findOne({ username });
      if (exists) return res.status(400).json({ message: 'Username already taken' });
      user.username = username;
    }

    user.fullName = fullName || user.fullName;

    // Age can only be set once (immutable after first set)
    if (age && !user.age) {
      user.age = age;
      // Also sync to dating profile
      user.datingAge = age;
    }

    user.bio = bio || user.bio;
    user.college = college || user.college;
    user.year = year || user.year;
    user.major = major || user.major;
    user.interests = interests || user.interests;

    if (profileImage) {
      user.profileImage = profileImage;
    }
    if (coverImage) {
      user.coverImage = coverImage;
    }

    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Block User
// @route   POST /api/users/:id/block
exports.blockUser = async (req, res) => {
  try {
    const userIdToBlock = req.params.id;
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.blockedUsers.includes(userIdToBlock)) {
      return res.status(400).json({ message: 'User already blocked' });
    }

    currentUser.blockedUsers.push(userIdToBlock);

    // Also unfollow if blocked
    if (currentUser.following.includes(userIdToBlock)) {
      currentUser.following = currentUser.following.filter(id => id.toString() !== userIdToBlock);
    }

    // Remove from followers if they follow you
    const blockedUser = await User.findById(userIdToBlock);
    if (blockedUser && blockedUser.following.includes(req.user.id)) {
      blockedUser.following = blockedUser.following.filter(id => id.toString() !== req.user.id);
      await blockedUser.save();
    }

    await currentUser.save();

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete User Account
// @route   DELETE /api/users/profile
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Delete user's posts
    await require('../models/Post').deleteMany({ user: userId });

    // 2. Delete user's stories
    await require('../models/Story').deleteMany({ user: userId });

    // 3. Delete user's messages (sent and received)
    await require('../models/Message').deleteMany({
      $or: [{ sender: userId }, { receiver: userId }]
    });

    // 4. Delete user's likes (sent and received)
    await require('../models/Like').deleteMany({
      $or: [{ sender: userId }, { receiver: userId }]
    });

    // 5. Delete activity logs
    await require('../models/ActivityLog').deleteMany({ user: userId });

    // 6. Remove from Blind Date Queue
    await require('../models/BlindDateQueue').deleteMany({ user: userId });

    // 7. Handle Blind Date Sessions
    // (You might want to mark them as ended if one user deletes account)
    const BlindDateSession = require('../models/BlindDateSession');
    await BlindDateSession.deleteMany({
      $or: [{ user1: userId }, { user2: userId }]
    });

    // 8. Remove user from others' followers/following arrays
    await User.updateMany(
      { followers: userId },
      { $pull: { followers: userId } }
    );
    await User.updateMany(
      { following: userId },
      { $pull: { following: userId } }
    );
    await User.updateMany(
      { blockedUsers: userId },
      { $pull: { blockedUsers: userId } }
    );

    // 9. Finally, delete the user record
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account and all associated data deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Get All Users (Admin Only)
// @route   GET /api/users/admin/all
exports.getAllUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    // Simple check: In production, use robust role management.
    // For now, checks the isAdmin flag we just added.
    if (!user || (!user.isAdmin)) {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
  // @desc    Reset Dating Profile (User)
  // @route   POST /api/users/profile/reset-dating
  exports.resetDatingProfile = async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Reset all dating fields
      user.datingProfileComplete = false;
      user.datingTermsAccepted = false;
      user.datingTermsAcceptedAt = undefined;

      user.datingGender = undefined;
      user.datingLookingFor = undefined;
      user.datingAge = undefined;
      user.datingHeight = undefined;
      user.datingHometown = undefined;
      user.datingCollege = undefined;
      user.datingCourse = undefined;
      user.datingIntentions = [];
      user.datingBio = undefined;
      user.datingInterests = [];
      user.datingPhotos = [];

      await user.save();

      // Remove from Blind Date Queue if present
      await require('../models/BlindDateQueue').deleteMany({ user: user._id });

      res.json({ message: 'Dating profile reset successfully' });
    } catch (error) {
      console.error('Reset dating profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };

  // @desc    Reset Dating Profile (Admin)
  // @route   POST /api/admin/users/:id/reset-dating
  exports.adminResetDatingProfile = async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Reset all dating fields
      user.datingProfileComplete = false;
      user.datingTermsAccepted = false;
      user.datingTermsAcceptedAt = undefined;

      user.datingGender = undefined;
      user.datingLookingFor = undefined;
      user.datingAge = undefined;
      user.datingHeight = undefined;
      user.datingHometown = undefined;
      user.datingCollege = undefined;
      user.datingCourse = undefined;
      user.datingIntentions = [];
      user.datingBio = undefined;
      user.datingInterests = [];
      user.datingPhotos = [];

      await user.save();

      // Remove from Blind Date Queue if present
      await require('../models/BlindDateQueue').deleteMany({ user: user._id });

      await require('../utils/activityLogger').logActivity({
        action: 'ADMIN_RESET_DATING_PROFILE',
        details: {
          targetUserId: user._id,
          targetUsername: user.username
        },
        req,
        performedBy: req.user.id,
      });

      res.json({ message: 'User dating profile reset successfully', user });
    } catch (error) {
      console.error('Admin reset dating profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
