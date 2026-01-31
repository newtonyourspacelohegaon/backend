const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '/home/pc/Desktop/vyb/backend/.env' });

const User = require('./models/User');
const Like = require('./models/Like');
const { getRecommendations } = require('./controllers/datingController');

const mockRes = {
    json: (data) => {
        console.log('--- Recommendation Results ---');
        if (data.length === 0) {
            console.log('No recommendations found.');
        } else {
            data.forEach((u, i) => {
                console.log(`${i + 1}. ${u.fullName || u.username} | Score: ${u.matchScore} | Interests: ${u.datingInterests.join(', ')}`);
            });
        }
    },
    status: (code) => ({
        json: (data) => console.log(`Error ${code}:`, data)
    })
};

async function verify() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Pick a user to be "Me"
        const me = await User.findOne({ datingProfileComplete: true });
        if (!me) {
            console.log('No user found with complete profile.');
            process.exit(0);
        }
        console.log(`Testing for User: ${me.fullName || me.username} (${me._id})`);
        console.log(`Gender: ${me.datingGender}, Looking For: ${me.datingLookingFor}`);
        console.log(`Interests: ${me.datingInterests.join(', ')}`);

        const mockReq = {
            user: { id: me._id.toString() },
            query: { page: 1, limit: 10 }
        };

        console.log('\n--- Initial Recommendations ---');
        await getRecommendations(mockReq, mockRes);

        // Find the first recommendation to exclude
        // Since getRecommendations returns an array, let's catch it.
        let firstRecId;
        const captureRes = {
            json: (data) => {
                if (data.length > 0) firstRecId = data[0]._id;
                mockRes.json(data);
            },
            status: mockRes.status
        };

        await getRecommendations(mockReq, captureRes);

        if (firstRecId) {
            console.log(`\nSimulating LIKE for user ID: ${firstRecId}...`);
            await Like.create({
                sender: me._id,
                receiver: firstRecId,
                status: 'pending'
            });

            console.log('\n--- Recommendations after LIKE (should not include the liked user) ---');
            await getRecommendations(mockReq, mockRes);

            // Clean up
            await Like.deleteOne({ sender: me._id, receiver: firstRecId });
            console.log('\nCleaned up test like.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verify();
