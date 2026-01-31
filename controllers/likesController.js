const User = require('../models/User');
const Like = require('../models/Like');

// Constants
const LIKE_REGEN_INTERVAL = 60 * 60 * 1000; // 1 hour in ms
const MAX_FREE_LIKES = 5;
const COST_BUY_LIKES = 100; // coins for 5 likes
const COST_REVEAL = 70;
const COST_START_CHAT = 100;
const COST_DIRECT_CHAT = 150;
const COST_BUY_CHAT_SLOT = 100;

// Helper: Check and regenerate likes if eligible
const regenerateLikes = async (user) => {
    if (user.likes >= MAX_FREE_LIKES) return; // No regen if at or above max

    const now = new Date();
    const timeSinceLastRegen = now - new Date(user.lastLikeRegenTime);
    const hoursElapsed = Math.floor(timeSinceLastRegen / LIKE_REGEN_INTERVAL);

    if (hoursElapsed > 0) {
        const likesToAdd = Math.min(hoursElapsed, MAX_FREE_LIKES - user.likes);
        if (likesToAdd > 0) {
            user.likes += likesToAdd;
            user.lastLikeRegenTime = now;
            await user.save();
        }
    }
};

// @desc    Get user's likes/slots status
// @route   GET /api/dating/my-status
exports.getMyStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        await regenerateLikes(user);

        const nextRegenTime = user.likes >= MAX_FREE_LIKES
            ? null
            : new Date(new Date(user.lastLikeRegenTime).getTime() + LIKE_REGEN_INTERVAL);

        res.json({
            likes: user.likes,
            chatSlots: user.chatSlots,
            activeChatCount: user.activeChatCount,
            availableSlots: user.chatSlots - user.activeChatCount,
            coins: user.coins,
            nextRegenTime,
            maxFreeLikes: MAX_FREE_LIKES,
        });
    } catch (error) {
        console.error('getMyStatus error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Send a like to user
// @route   POST /api/dating/like/:userId
exports.sendLike = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const targetUserId = req.params.userId;

        // Regenerate likes first
        await regenerateLikes(user);

        if (user.likes < 1) {
            return res.status(400).json({ message: 'No likes remaining. Wait for regeneration or buy more!' });
        }

        // Check if already liked
        const existingLike = await Like.findOne({ sender: req.user.id, receiver: targetUserId });
        if (existingLike) {
            return res.status(400).json({ message: 'You already liked this person!' });
        }

        // Check if there's a reciprocal like (They already liked you)
        const reciprocalLike = await Like.findOne({ sender: targetUserId, receiver: req.user.id });

        if (reciprocalLike) {
            // Check chat slot availability
            if (user.activeChatCount >= user.chatSlots) {
                return res.status(400).json({ message: 'They liked you too, but you have no available chat slots!' });
            }
            const targetUser = await User.findById(targetUserId);
            if (targetUser.activeChatCount >= targetUser.chatSlots) {
                return res.status(400).json({ message: 'They liked you too, but their chat slots are full!' });
            }

            // Create mutual match
            reciprocalLike.status = 'chatting';
            reciprocalLike.chatStartedAt = new Date();
            reciprocalLike.revealedAt = new Date();
            await reciprocalLike.save();

            // Update chat counts
            user.activeChatCount += 1;
            user.likes -= 1;
            await user.save();
            await User.findByIdAndUpdate(targetUserId, { $inc: { activeChatCount: 1 } });

            return res.json({
                success: true,
                likes: user.likes,
                isMatch: true,
                message: 'It\'s a Match! You can now start chatting.',
            });
        }

        // Create new like
        await Like.create({
            sender: req.user.id,
            receiver: targetUserId,
        });

        // Deduct like
        user.likes -= 1;
        await user.save();

        res.json({
            success: true,
            likes: user.likes,
            isMatch: false,
            message: 'Like sent! They will see you in their Chat tab.',
        });
    } catch (error) {
        console.error('sendLike error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get received likes (blurred profiles)
// @route   GET /api/dating/likes
exports.getReceivedLikes = async (req, res) => {
    try {
        const likes = await Like.find({
            receiver: req.user.id,
            status: { $in: ['pending', 'revealed'] },
        })
            .populate('sender', 'datingInterests datingAge datingGender datingPhotos fullName username profileImage datingBio datingHeight datingHometown datingCollege')
            .sort({ createdAt: -1 });

        // Return blurred version for pending likes
        const likeData = likes.map(like => ({
            _id: like._id,
            status: like.status,
            createdAt: like.createdAt,
            sender: like.status === 'revealed' || like.status === 'chatting'
                ? like.sender
                : {
                    // Blurred data - show minimal info and one photo for blurring
                    _id: like.sender._id,
                    datingInterests: like.sender.datingInterests?.slice(0, 3),
                    datingGender: like.sender.datingGender,
                    datingPhotos: like.sender.datingPhotos?.slice(0, 1),
                },
        }));

        res.json(likeData);
    } catch (error) {
        console.error('getReceivedLikes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reveal a like sender's profile (70 coins)
// @route   POST /api/dating/reveal/:likeId
exports.revealProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const like = await Like.findById(req.params.likeId).populate('sender');

        if (!like || like.receiver.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Like not found' });
        }

        if (like.status !== 'pending') {
            return res.status(400).json({ message: 'Profile already revealed' });
        }

        if (user.coins < COST_REVEAL) {
            return res.status(400).json({ message: `Insufficient coins. Need ${COST_REVEAL} coins.` });
        }

        // Deduct coins and update like status
        user.coins -= COST_REVEAL;
        await user.save();

        like.status = 'revealed';
        like.revealedAt = new Date();
        await like.save();

        res.json({
            success: true,
            coins: user.coins,
            like: {
                _id: like._id,
                status: like.status,
                sender: like.sender,
            },
            message: 'Profile revealed! You can now see who liked you.',
        });
    } catch (error) {
        console.error('revealProfile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Start chat with revealed like (100 coins)
// @route   POST /api/dating/start-chat/:likeId
exports.startChat = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const like = await Like.findById(req.params.likeId).populate('sender');

        if (!like || like.receiver.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Like not found' });
        }

        if (like.status === 'pending') {
            return res.status(400).json({ message: 'Must reveal profile first' });
        }

        if (like.status === 'chatting') {
            return res.status(400).json({ message: 'Chat already started' });
        }

        // Check chat slot availability
        if (user.activeChatCount >= user.chatSlots) {
            return res.status(400).json({ message: 'No available chat slots. Buy more slots!' });
        }

        if (user.coins < COST_START_CHAT) {
            return res.status(400).json({ message: `Insufficient coins. Need ${COST_START_CHAT} coins.` });
        }

        // Deduct coins and update status
        user.coins -= COST_START_CHAT;
        user.activeChatCount += 1;
        await user.save();

        like.status = 'chatting';
        like.chatStartedAt = new Date();
        await like.save();

        // Also increment sender's active chat count
        await User.findByIdAndUpdate(like.sender._id, { $inc: { activeChatCount: 1 } });

        res.json({
            success: true,
            coins: user.coins,
            activeChatCount: user.activeChatCount,
            chatPartnerId: like.sender._id,
            message: 'Chat started! You can now message each other.',
        });
    } catch (error) {
        console.error('startChat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Direct chat - reveal + start chat (150 coins)
// @route   POST /api/dating/direct-chat/:likeId
exports.directChat = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const like = await Like.findById(req.params.likeId).populate('sender');

        if (!like || like.receiver.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Like not found' });
        }

        if (like.status === 'chatting') {
            return res.status(400).json({ message: 'Chat already started' });
        }

        // Check chat slot availability
        if (user.activeChatCount >= user.chatSlots) {
            return res.status(400).json({ message: 'No available chat slots. Buy more slots!' });
        }

        if (user.coins < COST_DIRECT_CHAT) {
            return res.status(400).json({ message: `Insufficient coins. Need ${COST_DIRECT_CHAT} coins.` });
        }

        // Deduct coins and update status
        user.coins -= COST_DIRECT_CHAT;
        user.activeChatCount += 1;
        await user.save();

        like.status = 'chatting';
        like.revealedAt = new Date();
        like.chatStartedAt = new Date();
        await like.save();

        // Also increment sender's active chat count
        await User.findByIdAndUpdate(like.sender._id, { $inc: { activeChatCount: 1 } });

        res.json({
            success: true,
            coins: user.coins,
            activeChatCount: user.activeChatCount,
            chatPartnerId: like.sender._id,
            sender: like.sender,
            message: 'Profile revealed and chat started!',
        });
    } catch (error) {
        console.error('directChat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Buy 5 likes (100 coins)
// @route   POST /api/dating/buy-likes
exports.buyLikes = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user.coins < COST_BUY_LIKES) {
            return res.status(400).json({ message: `Insufficient coins. Need ${COST_BUY_LIKES} coins.` });
        }

        user.coins -= COST_BUY_LIKES;
        user.likes += 5;
        await user.save();

        res.json({
            success: true,
            coins: user.coins,
            likes: user.likes,
            message: 'Purchased 5 likes!',
        });
    } catch (error) {
        console.error('buyLikes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Buy chat slot (100 coins)
// @route   POST /api/dating/buy-chat-slot
exports.buyChatSlot = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user.coins < COST_BUY_CHAT_SLOT) {
            return res.status(400).json({ message: `Insufficient coins. Need ${COST_BUY_CHAT_SLOT} coins.` });
        }

        user.coins -= COST_BUY_CHAT_SLOT;
        user.chatSlots += 1;
        await user.save();

        res.json({
            success: true,
            coins: user.coins,
            chatSlots: user.chatSlots,
            availableSlots: user.chatSlots - user.activeChatCount,
            message: 'Purchased 1 chat slot!',
        });
    } catch (error) {
        console.error('buyChatSlot error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Decline a like
// @route   POST /api/dating/decline/:likeId
exports.declineLike = async (req, res) => {
    try {
        const like = await Like.findById(req.params.likeId);

        if (!like || like.receiver.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Like not found' });
        }

        like.status = 'declined';
        await like.save();

        res.json({
            success: true,
            message: 'Like declined.',
        });
    } catch (error) {
        console.error('declineLike error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get active chats (from likes system)
// @route   GET /api/dating/active-chats
exports.getActiveChats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all chats where user is sender or receiver with 'chatting' status
        const chats = await Like.find({
            status: 'chatting',
            $or: [{ sender: userId }, { receiver: userId }],
        })
            .populate('sender', 'fullName username profileImage datingPhotos')
            .populate('receiver', 'fullName username profileImage datingPhotos')
            .sort({ chatStartedAt: -1 });

        // Format response to show the "other" person
        const chatList = chats.map(chat => {
            const isMyLike = chat.sender._id.toString() === userId;
            const partner = isMyLike ? chat.receiver : chat.sender;
            return {
                likeId: chat._id,
                partnerId: partner._id,
                partnerName: partner.fullName || partner.username,
                partnerImage: partner.datingPhotos?.[0] || partner.profileImage,
                chatStartedAt: chat.chatStartedAt,
            };
        });

        res.json(chatList);
    } catch (error) {
        console.error('getActiveChats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Pass/Reject a user in discovery
// @route   POST /api/dating/pass/:userId
exports.passUser = async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        // Check if already interacted
        const existingInteraction = await Like.findOne({
            sender: req.user.id,
            receiver: targetUserId
        });

        if (existingInteraction) {
            existingInteraction.status = 'passed';
            await existingInteraction.save();
        } else {
            await Like.create({
                sender: req.user.id,
                receiver: targetUserId,
                status: 'passed'
            });
        }

        res.json({ success: true, message: 'User passed.' });
    } catch (error) {
        console.error('passUser error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Unmatch/Archive a chat to free up a slot
// @route   POST /api/dating/unmatch/:likeId
exports.unmatchUser = async (req, res) => {
    try {
        const like = await Like.findById(req.params.likeId);

        if (!like || (like.sender.toString() !== req.user.id && like.receiver.toString() !== req.user.id)) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        if (like.status !== 'chatting') {
            return res.status(400).json({ message: 'Chat is not active' });
        }

        like.status = 'archived';
        await like.save();

        // Decrement activeChatCount for both
        await User.findByIdAndUpdate(like.sender, { $inc: { activeChatCount: -1 } });
        await User.findByIdAndUpdate(like.receiver, { $inc: { activeChatCount: -1 } });

        res.json({ success: true, message: 'Unmatched. Slot freed.' });
    } catch (error) {
        console.error('unmatchUser error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
