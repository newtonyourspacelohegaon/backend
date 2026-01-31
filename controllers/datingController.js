const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// @desc    Get Matching Recommendations
// @route   GET /api/dating/recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Find other users who have completed dating profile
    const recommendations = await User.find({
      _id: { $ne: req.user.id },
      datingProfileComplete: true
    }).select('-phoneNumber').limit(20);

    res.json(recommendations);
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

    if (user.coins < 100) {
      return res.status(400).json({ message: 'Insufficient coins' });
    }

    // Deduct coins and Increment Active Chats (Assuming Switch = Start Chat)
    user.coins -= 100;
    user.activeChatCount += 1;
    targetUser.activeChatCount += 1;

    await user.save();
    await targetUser.save();

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
      datingProfileComplete
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

    const updateData = {
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
      datingPhotos: uploadedPhotos.length > 0 ? uploadedPhotos : datingPhotos,
      datingProfileComplete: datingProfileComplete || true
    };

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
