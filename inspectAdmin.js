const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function inspectAdmin() {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({ username: 'admin' });
    console.log('Admin User Object:', JSON.stringify(admin, null, 2));
    process.exit();
}

inspectAdmin();
