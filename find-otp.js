const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vyb';

async function findOTP(phone) {
    try {
        await mongoose.connect(MONGO_URI);
        const user = await User.findOne({ phoneNumber: phone });
        if (user) {
            console.log(`User found: ${user.fullName || user.username}`);
            console.log(`OTP: ${user.otp}`);
            console.log(`OTP Expires: ${user.otpExpires}`);
        } else {
            console.log(`User with phone ${phone} not found`);
        }
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

const phone = process.argv[2] || '9999999999';
findOTP(phone);
