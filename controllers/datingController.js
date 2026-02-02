const cloudinary = require('../config/cloudinary');
const User = require('../models/User');
const { notifyUser } = require('../utils/pushService');

// Helper: Check if user has an active unlimited plan
const hasUnlimitedCoins = (user) => {
  return user.unlimitedCoinsExpiry && new Date(user.unlimitedCoinsExpiry) > new Date();
};

// Simple in-memory cache for suggestions
// Map: userId -> { suggestions: [...sortedUsers], timestamp: Number }
const suggestionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// @desc    Get Matching Recommendations
// @route   GET /api/dating/recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });

    // Check Cache
    const cached = suggestionsCache.get(req.user.id);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && page === 1) {
      // If page 1 is requested, we can return from cache. 
      // For subsequent pages, we also use the same cache if still valid.
    }

    // However, for simplicity and to handle "Already rejected/liked", 
    // we should probably re-calculate if cache is cold or if we need fresh exclusions.
    // Let's implement the full calculation.

    // 1. Find Excluded User IDs
    // - Already Liked by me
    // - Already Rejected/Declined by me
    // - Already Vibed (Chatting)
    const Like = require('../models/Like');
    const interactions = await Like.find({
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id, status: 'chatting' },
        { receiver: req.user.id, status: 'declined' },
        { receiver: req.user.id, status: 'passed' }
      ]
    });

    const excludedIds = new Set();
    excludedIds.add(req.user.id); // Exclude self

    // Exclude users blocked by me
    if (me.blockedUsers && me.blockedUsers.length > 0) {
      me.blockedUsers.forEach(id => excludedIds.add(id.toString()));
    }

    // Exclude users who have blocked me
    const usersWhoBlockedMe = await User.find({ blockedUsers: req.user.id }).select('_id');
    usersWhoBlockedMe.forEach(u => excludedIds.add(u._id.toString()));

    interactions.forEach(inter => {
      if (inter.sender.toString() === req.user.id) {
        // Exclude anyone I liked, rejected, or chatting with
        excludedIds.add(inter.receiver.toString());
      } else if (inter.receiver.toString() === req.user.id) {
        // If I am receiver:
        // Exclude if we are chatting (vibed)
        // Exclude if I declined them (rejected)
        // Exclude if they passed on me
        if (inter.status === 'chatting' || inter.status === 'declined' || inter.status === 'passed') {
          excludedIds.add(inter.sender.toString());
        }
      }
    });

    // 2. Query all potential candidates
    // For large scale, this needs to be an aggregation or more efficient query.
    // For now, following requirements and current scale.
    const candidates = await User.find({
      _id: { $nin: Array.from(excludedIds) },
      datingProfileComplete: true,
      isDatingProfileVisible: { $ne: false }
    }).select('-phoneNumber -email -coins -followers -following -blockedUsers');

    if (candidates.length === 0) {
      return res.json([]);
    }

    // 3. Calculate Scores
    const scoredCandidates = candidates.map(them => {
      let score = 0;

      // A. Interests Overlap (40%)
      if (me.datingInterests && them.datingInterests) {
        const myInterests = me.datingInterests || [];
        const theirInterests = them.datingInterests || [];
        const overlap = myInterests.filter(i => theirInterests.includes(i)).length;
        const maxPossibleOverlap = Math.max(myInterests.length, 1);
        score += (overlap / maxPossibleOverlap) * 40;
      }

      // B. Relationship Type Compatibility (30%)
      if (me.datingIntentions && them.datingIntentions) {
        const myIntentions = me.datingIntentions || [];
        const theirIntentions = them.datingIntentions || [];
        const overlap = myIntentions.filter(i => theirIntentions.includes(i)).length;
        if (overlap > 0) {
          // If any intention matches, give some score. 
          // More matches = higher score up to 30.
          const intentionScore = (overlap / Math.max(myIntentions.length, 1)) * 30;
          score += intentionScore;
        }
      }

      // C. Gender Preference Match (30%)
      // 15% if I like them, 15% if they like me
      let genderScore = 0;

      // Do I like their gender?
      const myPref = me.datingLookingFor; // Women, Men, Everyone
      const theirGender = them.datingGender; // Man, Woman, Non-binary

      const iLikeThem = (myPref === 'Everyone') ||
        (myPref === 'Women' && theirGender === 'Woman') ||
        (myPref === 'Men' && theirGender === 'Man');

      if (iLikeThem) genderScore += 15;

      // Do they like my gender?
      const theirPref = them.datingLookingFor;
      const myGender = me.datingGender;

      const theyLikeMe = (theirPref === 'Everyone') ||
        (theirPref === 'Women' && myGender === 'Woman') ||
        (theirPref === 'Men' && myGender === 'Man');

      if (theyLikeMe) genderScore += 15;

      score += genderScore;

      return {
        ...them.toObject(),
        matchScore: Math.round(score)
      };
    });

    // 4. Sort and Paginate
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

    const paginatedSuggestions = scoredCandidates.slice(skip, skip + limit);

    res.json(paginatedSuggestions);
  } catch (error) {
    console.error('getRecommendations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Switch Active Match (Costs 100 coins)
// @route   POST /api/dating/match/:id
exports.switchMatch = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const targetUserId = req.params.id;
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check Chat Slots for Sender
    if (user.activeChatCount >= user.chatSlots) {
      return res.status(400).json({
        success: false,
        message: 'You have no free chat slots. Please buy more slots to switch vibe.',
        errorType: 'NO_SLOTS_SENDER'
      });
    }

    // Check Chat Slots for Receiver
    if (targetUser.activeChatCount >= targetUser.chatSlots) {
      return res.status(400).json({
        success: false,
        message: 'This user has no free chat slots at the moment.',
        errorType: 'NO_SLOTS_RECEIVER'
      });
    }

    // Deduct coins and Increment Active Chats (Assuming Switch = Start Chat)
    if (!hasUnlimitedCoins(user)) {
      if (user.coins < 100) {
        return res.status(400).json({ message: 'Insufficient coins' });
      }
      user.coins -= 100;
    }
    user.activeChatCount += 1;
    targetUser.activeChatCount += 1;

    // Create/Update Mutual Match in Like Model
    const Like = require('../models/Like');
    await Like.findOneAndUpdate(
      {
        $or: [
          { sender: req.user.id, receiver: targetUserId },
          { sender: targetUserId, receiver: req.user.id }
        ]
      },
      {
        sender: req.user.id,
        receiver: targetUserId,
        status: 'chatting',
        chatStartedAt: new Date(),
        revealedAt: new Date()
      },
      { upsert: true, new: true }
    );

    await user.save();
    await targetUser.save();

    // Send push notification to both users
    notifyUser(
      targetUserId,
      "It's a Vibe! 💚",
      `You matched with ${user.fullName || 'someone'}!`,
      { type: 'match', matchId: req.user.id },
      'match'
    );
    notifyUser(
      req.user.id,
      "It's a Vibe! 💚",
      `You matched with ${targetUser.fullName || 'someone'}!`,
      { type: 'match', matchId: targetUserId },
      'match'
    );

    // Log the activity
    const { logActivity } = require('../utils/activityLogger');
    await logActivity({
      userId: req.user.id,
      action: 'COINS_DEDUCTED',
      details: {
        amount: 100,
        reason: 'Switch Match (Vibe Switch)',
        targetUserId
      },
      req
    });

    res.json({ success: true, coins: user.coins, message: 'Vibe switched successfully!' });
  } catch (error) {
    console.error('switchMatch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Buy Coins (Simulated)
// @route   POST /api/dating/buy-coins
exports.buyCoins = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const price = amount / 10; // Simple conversion for simulation (10 coins per INR)

    const user = await User.findById(req.user.id);
    user.coins += amount;
    await user.save();

    // Create Transaction record
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      user: user._id,
      amount,
      price,
      status: 'completed',
      paymentMethod: 'Simulated'
    });

    // Log the activity
    const { logActivity } = require('../utils/activityLogger');
    await logActivity({
      userId: user._id,
      action: 'COINS_ADDED',
      details: {
        amount,
        price,
        reason: 'Purchase'
      },
      req
    });

    res.json({ success: true, coins: user.coins, message: `Added ${amount} coins!` });
  } catch (error) {
    console.error('buyCoins error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Accept Dating Terms & Conditions
// @route   POST /api/dating/accept-terms
exports.acceptDatingTerms = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        datingTermsAccepted: true,
        datingTermsAcceptedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      datingTermsAccepted: user.datingTermsAccepted,
      message: 'Dating terms accepted!'
    });
  } catch (error) {
    console.error('acceptDatingTerms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Dating Profile
// @route   PATCH /api/dating/profile
exports.updateDatingProfile = async (req, res) => {
  try {
    const {
      datingGender,
      datingLookingFor,
      datingAge,
      datingHeight,
      datingHometown,
      datingCollege,
      datingCourse,
      datingIntentions,
      datingBio,
      datingInterests,
      datingPhotos,
      datingProfileComplete,
      isDatingProfileVisible
    } = req.body;

    // Upload photos to Cloudinary if they are base64
    let uploadedPhotos = [];
    if (datingPhotos && datingPhotos.length > 0) {
      for (const photo of datingPhotos) {
        if (photo.startsWith('data:')) {
          try {
            const result = await cloudinary.uploader.upload(photo, {
              folder: 'dating_photos',
              transformation: [
                { width: 800, height: 1067, crop: 'limit' },
                { quality: 'auto:good' }
              ]
            });
            uploadedPhotos.push(result.secure_url);
          } catch (uploadError) {
            console.error('Photo upload error:', uploadError);
          }
        } else {
          uploadedPhotos.push(photo); // Already a URL
        }
      }
    }

    // Fetch current user first so we can check existing fields
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {
      datingGender,
      datingLookingFor,
      datingHeight,
      datingHometown,
      datingCollege,
      datingCourse,
      datingIntentions,
      datingBio,
      datingInterests,
      datingPhotos: uploadedPhotos.length > 0 ? uploadedPhotos : datingPhotos,
      datingProfileComplete: datingProfileComplete || true,
      isDatingProfileVisible
    };

    // Age can only be set once (Locked field)
    if (datingAge && !currentUser.datingAge) {
      updateData.datingAge = datingAge;
      // Also sync to main profile age if not set
      if (!currentUser.age) {
        updateData.age = datingAge;
      }
    }

    // Set initial chat slots based on gender if profile is being completed for the first time
    if (!currentUser.datingProfileComplete && (datingProfileComplete || true)) {
      // Only set if not already set (e.g. via purchase)
      if (!currentUser.chatSlots || currentUser.chatSlots === 0) {
        updateData.chatSlots = (datingGender === 'Man') ? 1 : 4;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select('-phoneNumber');

    res.json({
      success: true,
      user,
      message: 'Dating profile updated!'
    });
  } catch (error) {
    console.error('updateDatingProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get Dating Profile Status
// @route   GET /api/dating/profile
exports.getDatingProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'datingTermsAccepted datingProfileComplete datingGender datingLookingFor datingAge datingHeight datingHometown datingCollege datingCourse datingIntentions datingBio datingInterests datingPhotos'
    );

    res.json(user);
  } catch (error) {
    console.error('getDatingProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
