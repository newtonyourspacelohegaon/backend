const User = require('../models/User');

// @desc    Get Matching Recommendations
// @route   GET /api/dating/recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Find other users who are NOT the current user
    // In a real app, this would use complex aggregation for interests/college overlap
    const recommendations = await User.find({ 
      _id: { $ne: req.user.id },
      isVerified: true // Only show completed profiles
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

    if (user.coins < 100) {
      return res.status(400).json({ message: 'Insufficient coins' });
    }

    // Deduct coins
    user.coins -= 100;
    // user.activeMatch = targetUserId; // Assume we add this field to model later
    await user.save();

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

    const user = await User.findById(req.user.id);
    user.coins += amount;
    await user.save();

    res.json({ success: true, coins: user.coins, message: `Added ${amount} coins!` });
  } catch (error) {
    console.error('buyCoins error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
