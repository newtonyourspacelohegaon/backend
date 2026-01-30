const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, googleLogin } = require('../controllers/authController');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google', googleLogin);

module.exports = router;
