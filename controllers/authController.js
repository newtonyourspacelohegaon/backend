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

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(); // Initialize without ID to avoid default audience check conflict

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

// @desc    Google Login
// @route   POST /api/auth/google
exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'ID Token is required' });
  }

  try {
    // Accept tokens from multiple client IDs (Web, Android, iOS)
    const audiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      '560227419750-6vpcqgo8l2uopfg9e4j24dq7102dkb5i.apps.googleusercontent.com', // Explicit Web ID
      '560227419750-45vcnpoiog5k2unnrc057caaq6s5imp4.apps.googleusercontent.com'  // Explicit Android ID
    ].filter(Boolean); // Remove null/undefined values

    console.log('Verifying Google token with audiences:', audiences);

    // Verify the ID token using Google's client library
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists by googleId OR email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    let isNewUser = false;
    if (!user) {
      // Create new user
      user = await User.create({
        googleId,
        email,
        fullName: name,
        profileImage: picture,
      });
      isNewUser = true;
    } else {
      // If user exists but doesn't have googleId linked yet (e.g. registered via phone with same email)
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      isNewUser,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        profileImage: user.profileImage,
        coins: user.coins
      },
    });
  } catch (error) {
    console.error('Google Auth Error:', error.message);
    // Return the specific error message to help debug (e.g. "Wrong audience")
    res.status(401).json({ message: `Invalid Google Token: ${error.message}` });
  }
};
