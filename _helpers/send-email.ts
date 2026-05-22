import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html, from = process.env.EMAIL_FROM }: 
    { to: string, subject: string, html: string, from?: string }) {
    
    const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: {
        rejectUnauthorized: false
    },
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});
    
    await transporter.sendMail({ from, to, subject, html });
}