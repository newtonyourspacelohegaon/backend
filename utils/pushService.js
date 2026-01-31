/**
 * Push Notification Service using Expo Push API
 */

const Notification = require('../models/Notification');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to a single user
 * @param {string} expoPushToken - User's Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @param {string} userId - User ID to store notification in DB
 * @param {string} type - Notification type
 */
const sendPushNotification = async (expoPushToken, title, body, data = {}, userId = null, type = 'admin') => {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
        console.log('[Push] Invalid or missing push token:', expoPushToken);
        return null;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();
        console.log('[Push] Sent:', title, 'to', expoPushToken.substring(0, 30) + '...');

        // Store notification in DB
        if (userId) {
            await Notification.create({
                userId,
                title,
                body,
                data,
                type,
            });
        }

        return result;
    } catch (error) {
        console.error('[Push] Error sending notification:', error);
        return null;
    }
};

/**
 * Send push notifications to multiple users
 * @param {Array} notifications - Array of { token, title, body, data, userId, type }
 */
const sendBulkNotifications = async (notifications) => {
    const messages = notifications
        .filter(n => n.token && n.token.startsWith('ExponentPushToken'))
        .map(n => ({
            to: n.token,
            sound: 'default',
            title: n.title,
            body: n.body,
            data: n.data || {},
        }));

    if (messages.length === 0) {
        console.log('[Push] No valid tokens for bulk send');
        return [];
    }

    try {
        // Expo allows up to 100 messages per request
        const chunks = [];
        for (let i = 0; i < messages.length; i += 100) {
            chunks.push(messages.slice(i, i + 100));
        }

        const results = [];
        for (const chunk of chunks) {
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });
            const result = await response.json();
            results.push(result);
        }

        // Store notifications in DB
        const dbNotifications = notifications
            .filter(n => n.userId)
            .map(n => ({
                userId: n.userId,
                title: n.title,
                body: n.body,
                data: n.data || {},
                type: n.type || 'admin',
            }));

        if (dbNotifications.length > 0) {
            await Notification.insertMany(dbNotifications);
        }

        console.log(`[Push] Bulk sent ${messages.length} notifications`);
        return results;
    } catch (error) {
        console.error('[Push] Bulk send error:', error);
        return [];
    }
};

/**
 * Helper to send notification to a user by their ID
 */
const notifyUser = async (userId, title, body, data = {}, type = 'admin') => {
    const User = require('../models/User');
    const user = await User.findById(userId).select('expoPushToken');
    if (user && user.expoPushToken) {
        return sendPushNotification(user.expoPushToken, title, body, data, userId, type);
    }
    return null;
};

module.exports = {
    sendPushNotification,
    sendBulkNotifications,
    notifyUser,
};
