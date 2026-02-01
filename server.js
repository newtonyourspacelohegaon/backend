const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: true, // Reflect request origin to support credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const datingRoutes = require('./routes/datingRoutes');
const blindDatingRoutes = require('./routes/blindDatingRoutes');
const likesRoutes = require('./routes/likesRoutes');
const postRoutes = require('./routes/postRoutes');
const chatRoutes = require('./routes/chatRoutes');
const uploadRoutes = require('./routes/upload');
const storyRoutes = require('./routes/storyRoutes');
const updateRoutes = require('./routes/updateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dating', datingRoutes);
app.use('/api/blind', blindDatingRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/update', updateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

const rewardRoutes = require('./routes/rewardRoutes');
app.use('/api/rewards', rewardRoutes);


// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected Successfully');
    // Ensure indexes are synced (this drops the bad unique index on phoneNumber)
    const User = require('./models/User');
    try {
      await User.syncIndexes();
      console.log('✅ User Indexes Synced');
    } catch (idxErr) {
      console.error('⚠️ Index Sync Warning:', idxErr.message);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
  });

// Basic Route
app.get('/', (req, res) => {
  res.send('CampusConnect API is Running 🚀');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
