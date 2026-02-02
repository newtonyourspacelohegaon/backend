const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function findAdmins() {
    await mongoose.connect(process.env.MONGO_URI);
    const admins = await User.find({ isAdmin: true }).select('username email fullName phoneNumber');

    console.log('Admin Accounts found:');
    admins.forEach(a => {
        console.log(`- Username: ${a.username || 'N/A'}, Email: ${a.email || 'N/A'}, Phone: ${a.phoneNumber || 'N/A'}`);
    });

    process.exit();
}

findAdmins();
