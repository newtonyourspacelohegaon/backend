const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function checkTokens() {
    await mongoose.connect(process.env.MONGO_URI);
    const totalUsers = await User.countDocuments();
    const withToken = await User.countDocuments({ expoPushToken: { $exists: true, $ne: null } });
    const emptyToken = await User.countDocuments({ expoPushToken: "" });

    console.log('Total Users:', totalUsers);
    console.log('Users with Push Token:', withToken);
    console.log('Users with empty string Token:', emptyToken);

    if (withToken > 0) {
        const user = await User.findOne({ expoPushToken: { $exists: true, $ne: null } }).select('expoPushToken');
        console.log('Sample Token prefix:', user.expoPushToken.substring(0, 20));
    }

    process.exit();
}

checkTokens();
