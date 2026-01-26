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
    const { username, bio, college, year, major, interests, profileImage } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If username is changing, ensure it's unique
    if (username && username !== user.username) {
        const exists = await User.findOne({ username });
        if (exists) return res.status(400).json({ message: 'Username already taken' });
        user.username = username;
    }

    user.bio = bio || user.bio;
    user.college = college || user.college;
    user.year = year || user.year;
    user.major = major || user.major;
    user.interests = interests || user.interests;

    if (profileImage) {
        user.profileImage = profileImage;
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

