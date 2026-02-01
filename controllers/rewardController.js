const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');

// Constants
const DAILY_REWARD = 20;
const PROFILE_COMPLETE_REWARD = 50;
const FIRST_CHAT_REWARD = 30;
const REFERRAL_REWARD = 100;

// Helper: Generate unique referral code
const generateReferralCode = (userId) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code + userId.toString().slice(-4).toUpperCase();
};

// @desc    Claim daily login reward
// @route   POST /api/rewards/daily
exports.claimDailyReward = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = new Date();
        const lastReward = user.lastDailyReward ? new Date(user.lastDailyReward) : null;

        // Check if 24 hours have passed
        if (lastReward) {
            const hoursSinceLastReward = (now - lastReward) / (1000 * 60 * 60);
            if (hoursSinceLastReward < 24) {
                const hoursRemaining = Math.ceil(24 - hoursSinceLastReward);
                return res.status(400).json({
                    message: 'Daily reward already claimed',
                    hoursRemaining,
                    nextClaimAt: new Date(lastReward.getTime() + 24 * 60 * 60 * 1000),
                });
            }
        }

        // Grant reward
        user.coins += DAILY_REWARD;
        user.lastDailyReward = now;
        await user.save();

        await logActivity({
            userId: user._id,
            action: 'DAILY_REWARD_CLAIMED',
            details: { amount: DAILY_REWARD, newBalance: user.coins },
            req,
        });

        res.json({
            success: true,
            message: `You received ${DAILY_REWARD} coins!`,
            reward: DAILY_REWARD,
            newBalance: user.coins,
        });
    } catch (error) {
        console.error('Daily reward error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get reward status
// @route   GET /api/rewards/status
exports.getRewardStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = new Date();
        const lastReward = user.lastDailyReward ? new Date(user.lastDailyReward) : null;

        let dailyAvailable = true;
        let hoursRemaining = 0;

        if (lastReward) {
            const hoursSinceLastReward = (now - lastReward) / (1000 * 60 * 60);
            if (hoursSinceLastReward < 24) {
                dailyAvailable = false;
                hoursRemaining = Math.ceil(24 - hoursSinceLastReward);
            }
        }

        // Generate referral code if not exists
        if (!user.referralCode) {
            user.referralCode = generateReferralCode(user._id);
            await user.save();
        }

        res.json({
            daily: {
                available: dailyAvailable,
                hoursRemaining,
                amount: DAILY_REWARD,
            },
            profileComplete: {
                claimed: user.profileRewardClaimed,
                amount: PROFILE_COMPLETE_REWARD,
            },
            firstChat: {
                claimed: user.firstChatRewardClaimed,
                amount: FIRST_CHAT_REWARD,
            },
            referral: {
                code: user.referralCode,
                amount: REFERRAL_REWARD,
            },
        });
    } catch (error) {
        console.error('Get reward status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Check and grant profile completion reward
// @route   Called internally when profile is completed
exports.checkProfileReward = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user || user.profileRewardClaimed) {
            return null;
        }

        // Check if profile is complete
        const isComplete = user.fullName && user.username && user.profileImage;
        if (!isComplete) {
            return null;
        }

        user.coins += PROFILE_COMPLETE_REWARD;
        user.profileRewardClaimed = true;
        await user.save();

        await logActivity({
            userId: user._id,
            action: 'PROFILE_REWARD_CLAIMED',
            details: { amount: PROFILE_COMPLETE_REWARD, newBalance: user.coins },
        });

        return { reward: PROFILE_COMPLETE_REWARD, newBalance: user.coins };
    } catch (error) {
        console.error('Profile reward error:', error);
        return null;
    }
};

// @desc    Check and grant first chat reward
// @route   Called internally when first message is sent
exports.checkFirstChatReward = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user || user.firstChatRewardClaimed) {
            return null;
        }

        user.coins += FIRST_CHAT_REWARD;
        user.firstChatRewardClaimed = true;
        await user.save();

        await logActivity({
            userId: user._id,
            action: 'FIRST_CHAT_REWARD_CLAIMED',
            details: { amount: FIRST_CHAT_REWARD, newBalance: user.coins },
        });

        return { reward: FIRST_CHAT_REWARD, newBalance: user.coins };
    } catch (error) {
        console.error('First chat reward error:', error);
        return null;
    }
};

// @desc    Apply referral code and grant rewards to both users
// @route   Called during registration
exports.applyReferralReward = async (newUserId, referralCode) => {
    try {
        if (!referralCode) return null;

        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (!referrer) {
            return { error: 'Invalid referral code' };
        }

        // Don't allow self-referral
        if (referrer._id.toString() === newUserId.toString()) {
            return { error: 'Cannot use your own referral code' };
        }

        const newUser = await User.findById(newUserId);
        if (!newUser) {
            return { error: 'User not found' };
        }

        // Link referral
        newUser.referredBy = referrer._id;
        newUser.coins += REFERRAL_REWARD;
        await newUser.save();

        // Grant reward to referrer
        referrer.coins += REFERRAL_REWARD;
        await referrer.save();

        await logActivity({
            userId: newUser._id,
            action: 'REFERRAL_BONUS_RECEIVED',
            details: { referrerId: referrer._id, amount: REFERRAL_REWARD },
        });

        await logActivity({
            userId: referrer._id,
            action: 'REFERRAL_BONUS_GRANTED',
            details: { refereeId: newUser._id, amount: REFERRAL_REWARD },
        });

        return { success: true, bonusGranted: REFERRAL_REWARD };
    } catch (error) {
        console.error('Referral reward error:', error);
        return { error: 'Failed to apply referral' };
    }
};
