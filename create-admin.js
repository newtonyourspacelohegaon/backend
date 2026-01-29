require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const phoneNumber = '+919999999999'; // Default admin phone

        // Check by phone OR username
        let user = await User.findOne({
            $or: [{ phoneNumber }, { username: 'admin' }]
        });

        if (user) {
            user.isAdmin = true;
            user.username = 'admin';
            // Only update phone if it was the reason we found it (optional, but keeps consistency)
            if (!user.phoneNumber) user.phoneNumber = phoneNumber;

            await user.save();
            console.log(`✅ Existing user '${user.username}' updated to Admin.`);
        } else {
            user = await User.create({
                phoneNumber,
                username: 'admin',
                fullName: 'System Admin',
                isAdmin: true,
                coins: 1000
            });
            console.log('✅ New Admin user created:', phoneNumber);
        }

        mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

createAdmin();
