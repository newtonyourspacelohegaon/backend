/**
 * Blind Date Session Cleanup Job
 * Runs periodically to clean up expired/abandoned sessions
 */

const BlindDateSession = require('../models/BlindDateSession');
const BlindDateQueue = require('../models/BlindDateQueue');
const { notifyUser } = require('../utils/pushService');

// Cleanup interval in milliseconds (1 minute)
const CLEANUP_INTERVAL = 60 * 1000;

// Session is considered abandoned if no activity for this duration
const ABANDONED_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

let cleanupInterval = null;

/**
 * Clean up expired and abandoned blind date sessions
 */
async function cleanupSessions() {
    try {
        const now = new Date();

        // 1. End sessions that have expired (past expiresAt)
        const expiredSessions = await BlindDateSession.find({
            status: { $in: ['active', 'extended'] },
            expiresAt: { $lt: now }
        });

        for (const session of expiredSessions) {
            session.status = 'ended';
            session.endReason = 'expired';
            await session.save();
            console.log(`[Cleanup] Ended expired session: ${session._id}`);
        }

        // 2. End sessions with no recent activity (abandoned)
        const abandonedThreshold = new Date(now.getTime() - ABANDONED_THRESHOLD_MS);
        const abandonedSessions = await BlindDateSession.find({
            status: { $in: ['active', 'extended'] },
            lastActivity: { $lt: abandonedThreshold }
        });

        for (const session of abandonedSessions) {
            session.status = 'ended';
            session.endReason = 'abandoned';
            await session.save();
            console.log(`[Cleanup] Ended abandoned session: ${session._id}`);

            // Notify both users
            notifyUser(
                session.user1,
                'Session Ended',
                'Your blind date session ended due to inactivity.',
                { type: 'blind_ended', sessionId: session._id.toString() },
                'blind'
            );
            notifyUser(
                session.user2,
                'Session Ended',
                'Your blind date session ended due to inactivity.',
                { type: 'blind_ended', sessionId: session._id.toString() },
                'blind'
            );
        }

        // 3. Clean any stale queue entries older than 10 minutes (fallback)
        const staleQueueThreshold = new Date(now.getTime() - 10 * 60 * 1000);
        const deletedQueue = await BlindDateQueue.deleteMany({
            joinedAt: { $lt: staleQueueThreshold }
        });

        if (deletedQueue.deletedCount > 0) {
            console.log(`[Cleanup] Removed ${deletedQueue.deletedCount} stale queue entries`);
        }

        const totalCleaned = expiredSessions.length + abandonedSessions.length;
        if (totalCleaned > 0) {
            console.log(`[Cleanup] Total sessions cleaned: ${totalCleaned}`);
        }
    } catch (error) {
        console.error('[Cleanup] Error in session cleanup:', error);
    }
}

/**
 * Start the cleanup job
 */
function startCleanupJob() {
    if (cleanupInterval) {
        console.log('[Cleanup] Job already running');
        return;
    }

    console.log('[Cleanup] Starting blind date session cleanup job...');

    // Run immediately on startup
    cleanupSessions();

    // Then run periodically
    cleanupInterval = setInterval(cleanupSessions, CLEANUP_INTERVAL);
}

/**
 * Stop the cleanup job
 */
function stopCleanupJob() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('[Cleanup] Stopped blind date session cleanup job');
    }
}

module.exports = {
    startCleanupJob,
    stopCleanupJob,
    cleanupSessions
};
