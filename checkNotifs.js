const mongoose = require('mongoose');
require('dotenv').config();
const Notification = require('./models/Notification');

async function checkNotifications() {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await Notification.countDocuments();
    const latest = await Notification.find().sort({ createdAt: -1 }).limit(5);

    console.log('Total Notifications in DB:', count);
    console.log('Latest 5 notifications:', JSON.stringify(latest, null, 2));

    process.exit();
}

checkNotifications();
