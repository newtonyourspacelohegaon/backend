const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const { sendPushNotification } = require('./utils/pushService');

async function reproduceIssue() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        console.log('Finding user with push token...');
        const user = await User.findOne({ expoPushToken: { $exists: true, $ne: null, $ne: "" } });

        if (!user) {
            console.error('No user with push token found.');
            process.exit(1);
        }

        console.log(`Found user: ${user._id} with token: ${user.expoPushToken}`);

        console.log('Attempting to send push notification...');
        const result = await sendPushNotification(
            user.expoPushToken,
            'Test Notification',
            'This is a test notification from the reproduction script.',
            { test: true },
            user._id,
            'admin'
        );

        console.log('Send result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error in reproduction script:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

reproduceIssue();
