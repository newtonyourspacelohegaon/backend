const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function identifyUser() {
    await mongoose.connect(process.env.MONGO_URI);
    const usersWithToken = await User.find({ expoPushToken: { $exists: true, $ne: null, $ne: "" } }).select('username fullName email');

    console.log('Users with Push Token:');
    usersWithToken.forEach(u => {
        console.log(`- ${u.username || 'No Username'} (${u.fullName}) - ${u.email}`);
    });

    process.exit();
}

identifyUser();
