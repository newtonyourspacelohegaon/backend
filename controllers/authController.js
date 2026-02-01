const User = require('../models/User');
const jwt = require('jsonwebtoken');
const path = require('path');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const { sendOTPEmail, sendCollegeVerificationEmail } = require('../utils/emailUtility');
const { logActivity } = require('../utils/activityLogger');

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

  if (phoneNumber) {
    return res.status(400).json({ message: 'Phone login is temporarily disabled. Please use your email.' });
  }

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
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
    require('fs').appendFileSync(path.join(__dirname, '../otp.txt'), `[${new Date().toISOString()}] OTP for ${phoneNumber}: ${otp}\n`);
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
    let referralBonus = 0;

    if (!user) {
      // Generate unique referral code for new user
      const generateReferralCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      // Check for referral code from request (passed during signup)
      const { referralCode } = req.body;
      let referredBy = null;

      if (referralCode) {
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (referrer) {
          referredBy = referrer._id;
          // Grant bonus to referrer
          referrer.coins += 100;
          await referrer.save();
          referralBonus = 100; // Will be added to new user
        }
      }

      // Register new user with referral code
      user = await User.create({
        ...(phoneNumber ? { phoneNumber } : { email }),
        referralCode: generateReferralCode(),
        referredBy,
        coins: 150 + referralBonus, // Base coins + referral bonus if applicable
      });
      isNewUser = true;
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      isNewUser: isNewUser || !user.username, // Treat as new if profile not finished
      referralBonus,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        profileImage: user.profileImage,
        coins: user.coins,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};



// @desc    Send College Verification OTP
// @route   POST /api/auth/college-verify/send
exports.sendCollegeVerification = async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;

  if (!email || !email.toLowerCase().endsWith('@adypu.edu.in')) {
    return res.status(400).json({ message: 'Please use your valid @adypu.edu.in email address.' });
  }

  // Check if already used by another user
  const existingUser = await User.findOne({ studentEmail: email, isStudentVerified: true });
  if (existingUser && existingUser._id.toString() !== userId) {
    return res.status(400).json({ message: 'This email is already linked to another verified account.' });
  }

  const otp = generateOTP();

  // Store OTP with expiry (10 minutes)
  otpStore.set(email, {
    otp,
    expiry: Date.now() + 10 * 60 * 1000,
    userId // Bind to current user
  });

  const emailSent = await sendCollegeVerificationEmail(email, otp);
  if (!emailSent) {
    return res.status(500).json({ message: 'Failed to send verification email' });
  }

  res.status(200).json({
    success: true,
    message: `Verification code sent to ${email}`,
    otp: process.env.NODE_ENV === 'development' ? otp : undefined
  });
};

// @desc    Verify College OTP
// @route   POST /api/auth/college-verify/verify
exports.verifyCollegeEmail = async (req, res) => {
  const { email, otp } = req.body;
  const userId = req.user.id; // Protected route

  const storedData = otpStore.get(email);

  if (!storedData) {
    return res.status(400).json({ message: 'OTP expired or not requested' });
  }

  if (storedData.expiry < Date.now()) {
    otpStore.delete(email);
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (storedData.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // Ensure the user verifying is the one who requested it (security)
  if (storedData.userId !== userId) {
    return res.status(403).json({ message: 'Verification session mismatch' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isStudentVerified) {
      return res.status(400).json({ message: 'You are already verified!' });
    }

    // Success! Update User
    user.isStudentVerified = true;
    user.studentEmail = email;
    user.coins += 200; // Bonus
    await user.save();

    // Log activity
    await logActivity({
      userId: user._id,
      action: 'COLLEGE_VERIFIED',
      details: { email, bonus: 200 },
      req
    });

    // Clear OTP
    otpStore.delete(email);

    res.json({
      success: true,
      coins: user.coins,
      isStudentVerified: true,
      message: 'Verification successful! You earned 200 coins and a badge.'
    });

  } catch (error) {
    console.error('College verify error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
