const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, sendCollegeVerification, verifyCollegeEmail } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/college-verify/send', protect, sendCollegeVerification);
router.post('/college-verify/verify', protect, verifyCollegeEmail);

module.exports = router;
