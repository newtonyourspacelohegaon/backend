const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Send OTP (Simulated for Demo)
// @route   POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // In production, integrate Twilio/Fast2SMS here
  // For demo, we'll just return success and use a fixed OTP '123456'
  
  console.log(`OTP for ${phoneNumber}: 123456`);

  res.status(200).json({ 
    success: true, 
    message: 'OTP sent successfully', 
    otp: '123456' // Sending back for easier testing
  });
};

// @desc    Verify OTP and Login/Register
// @route   POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ message: 'Phone number and OTP are required' });
  }

  // Fixed OTP Check
  if (otp !== '123456') {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  try {
    // Check if user exists
    let user = await User.findOne({ phoneNumber });

    let isNewUser = false;
    if (!user) {
      // Register new user
      user = await User.create({
        phoneNumber,
      });
      isNewUser = true;
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      isNewUser: isNewUser,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        fullName: user.fullName,
        profileImage: user.profileImage,
        coins: user.coins
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
