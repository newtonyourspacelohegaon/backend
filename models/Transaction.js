const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    amount: {
        type: Number,
        required: true, // Amount of coins bought
    },
    price: {
        type: Number,
        required: true, // Price paid in real currency
    },
    currency: {
        type: String,
        default: 'INR',
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    paymentMethod: {
        type: String,
        default: 'Razorpay',
    },
    transactionId: String,
    razorpay_order_id: {
        type: String,
        index: true,
    },
    razorpay_payment_id: String,
    razorpay_signature: String,
    packType: {
        type: String,
        enum: ['coins', 'unlimited'],
        default: 'coins',
    },
}, { timestamps: true });

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
