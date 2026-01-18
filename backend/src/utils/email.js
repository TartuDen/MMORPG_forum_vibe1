import nodemailer from 'nodemailer';

const buildTransport = () => {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const authUser = process.env.SMTP_USER;
  const authPass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: authUser ? { user: authUser, pass: authPass } : undefined
  });
};

export const sendVerificationEmail = async ({ to, username, verificationUrl }) => {
  const transport = buildTransport();
  if (!transport) {
    console.log('SMTP not configured. Verification URL:', verificationUrl);
    return { sent: false };
  }

  const from = process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || 'support@example.com';
  const subject = 'Verify your email';
  const text = `Hi ${username || 'there'},\n\nPlease verify your email by clicking this link:\n${verificationUrl}\n\nIf you did not create an account, you can ignore this message.`;
  const html = `
    <p>Hi ${username || 'there'},</p>
    <p>Please verify your email by clicking this link:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>If you did not create an account, you can ignore this message.</p>
  `;

  await transport.sendMail({ from, to, subject, text, html });
  return { sent: true };
};
