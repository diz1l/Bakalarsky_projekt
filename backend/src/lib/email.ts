import nodemailer from 'nodemailer';
import { config } from '../config.js';

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${config.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  if (!config.mail.host) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP_HOST must be configured to send password reset emails');
    console.info(`[dev] Password reset URL for ${to}: ${resetUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
  });
  await transporter.sendMail({
    from: config.mail.from,
    to,
    subject: 'Reset your Staff Manager password',
    text: `Use this link to reset your password. It expires in 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}
