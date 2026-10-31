import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, text, html }) {
  if (process.env.NODE_ENV === 'test') return null;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error('Email delivery is not configured.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html,
  });
}

export default sendEmail;
