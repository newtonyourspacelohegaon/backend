const BlindDateSession = require('../models/BlindDateSession');
const BlindDateQueue = require('../models/BlindDateQueue');
const User = require('../models/User');

const SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const EXTENSION_COST = 100; // coins
const EXTENSION_DURATION_MS = 10 * 60 * 1000; // 10 more minutes

// @desc    Join blind dating queue
// @route   POST /api/blind/join
exports.joinQueue = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user.datingProfileComplete) {
            return res.status(400).json({ message: 'Please complete your dating profile first' });
        }

        if (!user.datingGender || !user.datingLookingFor) {
            return res.status(400).json({ message: 'Please set your gender and preferences in dating profile' });
        }

        // Check if already in an active session
        const activeSession = await BlindDateSession.findOne({
            $or: [{ user1: userId }, { user2: userId }],
            status: { $in: ['active', 'extended'] },
        });

        if (activeSession) {
            return res.status(400).json({
                message: 'You are already in an active blind date session',
                sessionId: activeSession._id
            });
        }

        // Check if already in queue
        const existingEntry = await BlindDateQueue.findOne({ user: userId });
        if (existingEntry) {
            return res.json({
                status: 'searching',
                message: 'You are already in the queue'
            });
        }

        // Try to find a match first
        const match = await findMatch(user);

        if (match) {
            // Remove match from queue
            await BlindDateQueue.deleteOne({ user: match.user });

            // Create session
            const session = new BlindDateSession({
                user1: userId,
                user2: match.user,
                startTime: new Date(),
                expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
            });
            await session.save();

            return res.json({
                status: 'matched',
                sessionId: session._id,
                message: 'Match found! Start chatting anonymously.',
            });
        }

        // No match found, add to queue
        const queueEntry = new BlindDateQueue({
            user: userId,
            lookingFor: user.datingLookingFor,
            gender: user.datingGender,
        });
        await queueEntry.save();

        res.json({
            status: 'searching',
            message: 'Searching for a match...',
        });
    } catch (error) {
        console.error('joinQueue error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Helper: Find a compatible match in the queue
async function findMatch(user) {
    const query = {
        user: { $ne: user._id },
    };

    // Match based on preferences
    // User is looking for X, so find someone whose gender is X
    // AND that someone is looking for user's gender

    if (user.datingLookingFor === 'Women') {
        query.gender = 'Woman';
    } else if (user.datingLookingFor === 'Men') {
        query.gender = 'Man';
    }
    // If 'Everyone', don't filter by gender

    // The match should also be looking for user's gender
    const queueEntries = await BlindDateQueue.find(query).sort({ joinedAt: 1 });

    for (const entry of queueEntries) {
        // Check if this queued user would be interested in the current user's gender
        if (entry.lookingFor === 'Everyone') {
            return entry;
        }
        if (entry.lookingFor === 'Women' && user.datingGender === 'Woman') {
            return entry;
        }
        if (entry.lookingFor === 'Men' && user.datingGender === 'Man') {
            return entry;
        }
    }

    return null;
}

// @desc    Leave blind dating queue
// @route   POST /api/blind/leave
exports.leaveQueue = async (req, res) => {
    try {
        const userId = req.user.id;
        await BlindDateQueue.deleteOne({ user: userId });
        res.json({ success: true, message: 'Left the queue' });
    } catch (error) {
        console.error('leaveQueue error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get blind dating status
// @route   GET /api/blind/status
exports.getStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        // Check for active session
        const session = await BlindDateSession.findOne({
            $or: [{ user1: userId }, { user2: userId }],
            status: { $in: ['active', 'extended'] },
        });

        if (session) {
            // Check if session has expired
            if (new Date() > session.expiresAt) {
                session.status = 'ended';
                await session.save();
                return res.json({
                    status: 'ended',
                    sessionId: session._id,
                    message: "Time's up!",
                });
            }

            return res.json({
                status: session.status,
                sessionId: session._id,
                messages: session.messages,
                extended: session.extended,
            });
        }

        // Check if in queue
        const queueEntry = await BlindDateQueue.findOne({ user: userId });
        if (queueEntry) {
            return res.json({
                status: 'searching',
                message: 'Looking for a match...',
            });
        }

        res.json({
            status: 'idle',
            message: 'Not in a session or queue',
        });
    } catch (error) {
        console.error('getStatus error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Send anonymous message in blind date session
// @route   POST /api/blind/session/:id/message
exports.sendMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ message: 'Message text is required' });
        }

        const session = await BlindDateSession.findOne({
            _id: sessionId,
            $or: [{ user1: userId }, { user2: userId }],
            status: { $in: ['active', 'extended'] },
        });

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        // Check if session has expired
        if (new Date() > session.expiresAt) {
            session.status = 'ended';
            await session.save();
            return res.status(400).json({ message: "Session has ended. Time's up!" });
        }

        // Add message
        session.messages.push({
            sender: userId,
            text: text.trim(),
            createdAt: new Date(),
        });
        await session.save();

        res.json({
            success: true,
            messages: session.messages,
        });
    } catch (error) {
        console.error('sendMessage error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get session messages
// @route   GET /api/blind/session/:id/messages
exports.getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const session = await BlindDateSession.findOne({
            _id: sessionId,
            $or: [{ user1: userId }, { user2: userId }],
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Check if session has expired (for active sessions)
        if (session.status === 'active' || session.status === 'extended') {
            if (new Date() > session.expiresAt) {
                session.status = 'ended';
                await session.save();
            }
        }

        res.json({
            status: session.status,
            messages: session.messages,
            extended: session.extended,
        });
    } catch (error) {
        console.error('getMessages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Extend blind date session (costs coins)
// @route   POST /api/blind/session/:id/extend
exports.extendSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const user = await User.findById(userId);

        if (user.coins < EXTENSION_COST) {
            return res.status(400).json({
                message: `Insufficient coins. You need ${EXTENSION_COST} coins.`,
                required: EXTENSION_COST,
                current: user.coins,
            });
        }

        const session = await BlindDateSession.findOne({
            _id: sessionId,
            $or: [{ user1: userId }, { user2: userId }],
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (session.status !== 'active' && session.status !== 'ended') {
            return res.status(400).json({ message: 'Session cannot be extended' });
        }

        // Deduct coins
        user.coins -= EXTENSION_COST;
        await user.save();

        // Extend session
        session.status = 'extended';
        session.extended = true;
        session.extendedBy = userId;
        session.expiresAt = new Date(Date.now() + EXTENSION_DURATION_MS);
        await session.save();

        // Get partner's profile for reveal
        const partnerId = session.user1.toString() === userId ? session.user2 : session.user1;
        const partner = await User.findById(partnerId).select(
            'fullName username profileImage datingBio datingInterests datingAge datingCollege datingPhotos'
        );

        res.json({
            success: true,
            message: 'Session extended! You can now see their profile.',
            coins: user.coins,
            partnerProfile: partner,
            expiresAt: session.expiresAt,
        });
    } catch (error) {
        console.error('extendSession error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    End blind date session manually
// @route   POST /api/blind/session/:id/end
exports.endSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const session = await BlindDateSession.findOne({
            _id: sessionId,
            $or: [{ user1: userId }, { user2: userId }],
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        session.status = 'ended';
        await session.save();

        // Also remove from queue if somehow still there
        await BlindDateQueue.deleteOne({ user: userId });

        res.json({
            success: true,
            message: 'Session ended',
        });
    } catch (error) {
        console.error('endSession error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
