require('dotenv').config();
const nodemailer = require('nodemailer');

async function debugEmail() {
    console.log('Using SMTP Settings:');
    console.log('Host:', process.env.SMTP_HOST);
    console.log('Port:', process.env.SMTP_PORT);
    console.log('User:', process.env.SMTP_USER);
    // console.log('Pass:', process.env.SMTP_PASS ? '******' : 'MISSING');

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT == 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        debug: true, // Enable debug output
        logger: true, // Log to console
    });

    const email = 'vybbb.tech@gmail.com';
    const otp = '123456';

    const mailOptions = {
        from: `"VYB App" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'DEBUG: Your OTP for VYB Login',
        text: `Your OTP is ${otp}`,
    };

    try {
        console.log('Attempting to send email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
    } catch (error) {
        console.error('ERROR SENDING EMAIL:');
        console.error(error);
    }
}

debugEmail();
