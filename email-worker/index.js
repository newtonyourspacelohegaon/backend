const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.send('Mail Service is Online ✉️');
});

/**
 * SECURE INTERNAL ENDPOINT
 */
app.post('/api/mail/send-otp', async (req, res) => {
    const { email, otp, internalSecret } = req.body;

    // Security Check
    if (!internalSecret || internalSecret !== process.env.INTERNAL_SERVICE_SECRET) {
        console.warn(`[MAIL] Unauthorized access attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log(`[MAIL] Internal request for: ${email}`);

        const transportConfig = {
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            connectionTimeout: 15000,
        };

        const transporter = nodemailer.createTransport(transportConfig);

        const mailOptions = {
            from: `"VYB App" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Your OTP for VYB Login',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                  <h2 style="color: #333; text-align: center;">Welcome to VYB</h2>
                  <p style="font-size: 16px; color: #555;">Use the following One-Time Password (OTP) to complete your login:</p>
                  <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                    <h1 style="font-size: 32px; letter-spacing: 5px; margin: 0; color: #000;">${otp}</h1>
                  </div>
                  <p style="font-size: 14px; color: #888;">This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 12px; color: #aaa; text-align: center;">© 2026 VYB App. All rights reserved.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[MAIL] OTP Email sent successfully to ${email}`);
        res.json({ message: 'Email sent successfully' });

    } catch (error) {
        console.error('[MAIL] Error:', error);
        res.status(500).json({ error: 'Mail delivery failed', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Mail service running on port ${PORT}`);
});
