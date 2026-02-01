const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function findRecent() {
    await mongoose.connect(process.env.MONGO_URI);
    // There is no updatedAt by default unless timestamps: true is set. 
    // I'll check if it exists, otherwise just show last 5 created.
    const users = await User.find().sort({ _id: -1 }).limit(10).select('username expoPushToken createdAt');

    console.log('Last 10 Users:');
    users.forEach(u => {
        console.log(`- ${u.username}: ${u.expoPushToken ? 'HAS_TOKEN' : 'NO_TOKEN'} (ID: ${u._id})`);
    });

    process.exit();
}

findRecent();
