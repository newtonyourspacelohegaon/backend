const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay Order
// @route   POST /api/payment/create-order
exports.createOrder = async (req, res) => {
    try {
        const { amount, price } = req.body;

        if (!amount || !price) {
            return res.status(400).json({ message: 'Amount and price are required' });
        }

        const options = {
            amount: Math.round(price * 100), // amount in the smallest currency unit (paise for INR)
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        // Save a pending transaction
        await Transaction.create({
            user: req.user.id,
            amount,
            price,
            status: 'pending',
            paymentMethod: 'Razorpay',
            razorpay_order_id: order.id,
        });

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error) {
        console.error('createOrder error:', error);
        res.status(500).json({ message: 'Payment initialization failed', error: error.message });
    }
};

// @desc    Verify Razorpay Payment
// @route   POST /api/payment/verify-payment
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Create the signature body
        const body = razorpay_order_id + "|" + razorpay_payment_id;

        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isSignatureValid = expectedSignature === razorpay_signature;

        if (!isSignatureValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Find the transaction
        const transaction = await Transaction.findOne({ razorpay_order_id });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (transaction.status === 'completed') {
            return res.status(400).json({ message: 'Payment already verified' });
        }

        // Update transaction
        transaction.status = 'completed';
        transaction.razorpay_payment_id = razorpay_payment_id;
        transaction.razorpay_signature = razorpay_signature;
        await transaction.save();

        // Update User Balance
        const user = await User.findById(transaction.user);
        user.coins += transaction.amount;
        await user.save();

        // Log the activity
        await logActivity({
            userId: user._id,
            action: 'COINS_ADDED',
            details: {
                amount: transaction.amount,
                price: transaction.price,
                reason: 'Razorpay Purchase',
                razorpay_payment_id
            },
            req
        });

        res.json({
            success: true,
            coins: user.coins,
            message: `Added ${transaction.amount} coins successfully!`
        });
    } catch (error) {
        console.error('verifyPayment error:', error);
        res.status(500).json({ message: 'Payment verification failed', error: error.message });
    }
};
