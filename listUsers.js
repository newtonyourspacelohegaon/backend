const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function listUsers() {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find().select('username email fullName');

    console.log('Total Users:', users.length);
    users.forEach(u => {
        console.log(`- ${u.username || 'No Name'} (${u.email})`);
    });

    process.exit();
}

listUsers();
