const nodemailer = require('nodemailer');

async function sendTestEmail() {
    console.log('Creating test account...');
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 588, // 587 is often blocked, ethereal uses 588 or 465
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
        },
    });

    console.log('Sending email...');
    const email = 'vybbb.tech@gmail.com';
    const otp = '999999';

    let info = await transporter.sendMail({
        from: '"VYB Test" <test@example.com>',
        to: email,
        subject: "Test OTP from VYB",
        text: `Your test OTP is ${otp}`,
        html: `<b>Your test OTP is ${otp}</b>`,
    });

    console.log("Message sent: %s", info.messageId);
    // Message sent: <b678ef37-9925-83e0-4a64-72153e1f482d@example.com>

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaV6hKjguaYecBxp...
}

sendTestEmail().catch(console.error);
