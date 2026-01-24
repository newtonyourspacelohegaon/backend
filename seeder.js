const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Post = require('./models/Post');

dotenv.config();

// Connect to DB (Removed deprecated options for Mongoose v7+)
mongoose.connect(process.env.MONGO_URI);

const users = [
  {
    phoneNumber: '9999999991',
    username: 'priya_art',
    fullName: 'Priya Sharma',
    gender: 'Female',
    college: 'NIFT Delhi',
    bio: '🎨 Artist | 🖌️ Design Student | Dreaming in colors',
    interests: ['Art', 'Design', 'Fashion'],
    profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    isVerified: true
  },
  {
    phoneNumber: '9999999992',
    username: 'rahul_tech',
    fullName: 'Rahul Verma',
    gender: 'Male',
    college: 'IIT Bombay',
    bio: '💻 CompSci | 🚀 Building next-gen apps | AI Enthusiast',
    interests: ['Technology', 'Coding', 'Gaming'],
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    isVerified: false
  },
  {
    phoneNumber: '9999999993',
    username: 'anjali_travels',
    fullName: 'Anjali Gupta',
    gender: 'Female',
    college: 'Symbiosis Pune',
    bio: '✈️ Travel | 📸 Photography | Exploring the world one city at a time',
    interests: ['Travel', 'Photography', 'Food'],
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    isVerified: true
  },
  {
    phoneNumber: '9999999994',
    username: 'vikram.fit',
    fullName: 'Vikram Singh',
    gender: 'Male',
    college: 'Amity Noida',
    bio: '💪 Fitness | 🏏 Cricket | Consistency is key',
    interests: ['Fitness', 'Sports', 'Health'],
    profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    isVerified: false
  }
];

const posts = [
  {
    caption: 'Sunset vibes at the beach 🌅 #TravelDiaries',
    image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
    userIndex: 2 // Anjali
  },
  {
    caption: 'Just finished my latest canvas piece! 🎨 What do you think?',
    image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800',
    userIndex: 0 // Priya
  },
  {
    caption: 'Hackathon weekend! 48 hours of coding non-stop ☕💻 #DevLife',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
    userIndex: 1 // Rahul
  },
  {
    caption: 'Morning run done. 5k in 25 mins! 🏃‍♂️💨',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800',
    userIndex: 3 // Vikram
  },
  {
    caption: 'Exploring the old city streets 🏛️',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
    userIndex: 2 // Anjali
  },
  {
    caption: 'New setup upgrade! RGB everything 🌈',
    image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800',
    userIndex: 1 // Rahul
  }
];

const seedDB = async () => {
  try {
    // 1. Create Users
    console.log('creating users...');
    const createdUsers = [];
    for (const u of users) {
        // Use findOneAndUpdate with upsert to create or update
        // This ensures if we run it again, we update fields (like gender)
        const user = await User.findOneAndUpdate(
            { phoneNumber: u.phoneNumber },
            u,
            { new: true, upsert: true }
        );
        createdUsers.push(user);
    }

    // 2. Create Posts
    console.log('creating posts...');
    const createdPosts = [];
    for (const p of posts) {
        // Only create post if it doesn't look like a duplicate (check caption/user)
        const existing = await Post.findOne({ user: createdUsers[p.userIndex]._id, caption: p.caption });
        if (!existing) {
            const post = await Post.create({
                user: createdUsers[p.userIndex]._id,
                image: p.image,
                caption: p.caption,
                likes: [],
            });
            createdPosts.push(post);
        } else {
            createdPosts.push(existing);
        }
    }

    // 3. Create Interactions (Follows & Likes)
    console.log('simulating interactions...');
    
    // Random Follows
    for (const user of createdUsers) {
        const others = createdUsers.filter(u => u._id.toString() !== user._id.toString());
        const toFollow = others.sort(() => 0.5 - Math.random()).slice(0, 2);
        
        for (const target of toFollow) {
            if (!user.following.includes(target._id)) {
                user.following.push(target._id);
            }
            if (!target.followers.includes(user._id)) {
                target.followers.push(user._id);
            }
            await target.save();
        }
        await user.save();
    }

    // Random Likes
    for (const post of createdPosts) {
        const randomUsers = createdUsers.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 2);
        for (const liker of randomUsers) {
            if (!post.likes.includes(liker._id)) {
                post.likes.push(liker._id);
            }
        }
        await post.save();
    }

    console.log('✅ Database Seeded Successfully with 4 Verified Users & Posts!');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
