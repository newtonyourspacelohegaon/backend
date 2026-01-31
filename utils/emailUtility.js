const nodemailer = require('nodemailer');

const sendOTPEmail = async (email, otp) => {
    try {
        // For production, you should use a real SMTP service (Gmail, SendGrid, Mailtrap, etc.)
        // We'll try to use environment variables first, then fallback to a mock for demo

        let transporter;

        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_PORT == 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        } else {
            // MOCK implementation for demo if no SMTP is configured
            console.log('-----------------------------------------');
            console.log(`MOCK EMAIL SENT TO: ${email}`);
            console.log(`OTP CODE: ${otp}`);
            console.log('-----------------------------------------');
            return true;
        }

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
        console.log(`OTP Email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = { sendOTPEmail };
