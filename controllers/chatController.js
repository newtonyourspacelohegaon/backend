const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');
const { logActivity } = require('../utils/activityLogger');
const { notifyUser } = require('../utils/pushService');
const { checkFirstChatReward } = require('./rewardController');

// @desc    Send a message
// @route   POST /api/chat/send
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !text) {
      return res.status(400).json({ message: 'Receiver and text are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'Invalid receiver ID' });
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      text,
    });

    await newMessage.save();

    // Check for first chat reward (async, don't wait)
    checkFirstChatReward(senderId);

    // Send push notification to receiver
    const sender = await User.findById(senderId).select('fullName username');
    const senderName = sender?.fullName || sender?.username || 'Someone';
    const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;

    notifyUser(
      receiverId,
      'New Message 💬',
      `${senderName}: ${preview}`,
      { type: 'chat', chatUserId: senderId },
      'chat'
    );

    res.json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Get messages between current user and another user
// @route   GET /api/chat/:userId
exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    }).sort({ createdAt: 1 }); // Oldest first

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/chat/read/:userId
exports.markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    await Message.updateMany(
      { sender: userId, receiver: currentUserId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete conversation
// @route   DELETE /api/chat/:userId
exports.deleteConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Delete all messages between these two users
    await Message.deleteMany({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    });

    // Also remove the Like record (which represents the active chat)
    const Like = require('../models/Like');
    const like = await Like.findOneAndDelete({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
      status: 'chatting'
    });

    if (like) {
      // Restore chat slots
      const User = require('../models/User');
      await User.findByIdAndUpdate(currentUserId, { $inc: { activeChatCount: -1 } });
      await User.findByIdAndUpdate(userId, { $inc: { activeChatCount: -1 } });

      await logActivity({
        userId: currentUserId,
        action: 'CONVERSATION_DELETED',
        details: { partnerId: userId, slotFreed: true },
        req
      });
    }

    res.json({ success: true, message: 'Conversation deleted and chat slot freed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
