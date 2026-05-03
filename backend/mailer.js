const nodemailer = require('nodemailer');

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Sends email via SMTP. If SMTP_HOST is unset, logs the message (development only).
 * In production, missing SMTP is treated as an error when sending.
 */
async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';
  const transport = createTransport();

  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured. Set SMTP_HOST and related variables.');
    }
    // eslint-disable-next-line no-console
    console.info(`[mail:dev] To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br/>'),
  });
}

async function sendSignupOtpEmail(to, otp, name) {
  const safeName = name || 'there';
  await sendMail({
    to,
    subject: 'Your Team Task Manager verification code',
    text: `Hi ${safeName},\n\nYour verification code is: ${otp}\n\nIt expires in 15 minutes. If you did not request this, ignore this email.\n`,
    html: `<p>Hi ${safeName},</p><p>Your verification code is: <strong style="font-size:1.25rem">${otp}</strong></p><p>It expires in 15 minutes.</p>`,
  });
}

module.exports = { sendMail, sendSignupOtpEmail };
