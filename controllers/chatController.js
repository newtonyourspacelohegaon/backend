const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Send a message
// @route   POST /api/chat/send
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !text) {
        return res.status(400).json({ message: 'Receiver and text are required' });
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      text,
    });

    await newMessage.save();

    // In a real app, emit socket event here
    
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
