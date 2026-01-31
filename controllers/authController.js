const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const { sendOTPEmail } = require('../utils/emailUtility');

// OTP Store (In-memory for demo, use Redis/DB for production)
const otpStore = new Map();

// Helper to generate 6-digit random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Send OTP
// @route   POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  const { phoneNumber, email } = req.body;

  if (!phoneNumber && !email) {
    return res.status(400).json({ message: 'Phone number or email is required' });
  }

  if (email && !email.toLowerCase().endsWith('@adypu.edu.in')) {
    return res.status(400).json({ message: 'Only @adypu.edu.in emails are allowed' });
  }

  const otp = generateOTP();
  const target = phoneNumber || email;

  // Store OTP with expiry (10 minutes)
  otpStore.set(target, {
    otp,
    expiry: Date.now() + 10 * 60 * 1000
  });

  if (email) {
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }
  } else {
    // In production, integrate Twilio/Fast2SMS here
    console.log(`[SMS MOCK] OTP for ${phoneNumber}: ${otp}`);
  }

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    otp: process.env.NODE_ENV === 'development' || !email ? otp : undefined
  });
};


// @desc    Verify OTP and Login/Register
// @route   POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, email, otp } = req.body;

  if ((!phoneNumber && !email) || !otp) {
    return res.status(400).json({ message: 'Phone/Email and OTP are required' });
  }

  const target = phoneNumber || email;
  const storedData = otpStore.get(target);

  if (!storedData) {
    return res.status(400).json({ message: 'OTP expired or not requested' });
  }

  if (storedData.expiry < Date.now()) {
    otpStore.delete(target);
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (storedData.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // Clear OTP after successful verification
  otpStore.delete(target);

  try {
    // Check if user exists
    let query = phoneNumber ? { phoneNumber } : { email };
    let user = await User.findOne(query);

    let isNewUser = false;
    if (!user) {
      // Register new user
      user = await User.create(phoneNumber ? { phoneNumber } : { email });
      isNewUser = true;
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      isNewUser: isNewUser || !user.username, // Treat as new if profile not finished
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
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

