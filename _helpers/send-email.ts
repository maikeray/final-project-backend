import * as https from 'https';

export async function sendEmail({ to, subject, html, from = process.env.EMAIL_FROM }: 
    { to: string, subject: string, html: string, from?: string }) {
    
    const data = JSON.stringify({
        sender: { email: from || 'michaelnatingor@gmail.com' },
        to: [{ email: to }],
        subject,
        htmlContent: html
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.brevo.com',
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'Content-Length': Buffer.byteLength(data)
            }
        }, resolve);
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}