import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendNewsletter(params: {
  to: string[];
  subject: string;
  content: string;
  fromName?: string;
}): Promise<{ success: boolean; sent: number; failed: string[]; error?: string }> {
  const { to, subject, content, fromName = 'Koya Content Lab' } = params;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { success: false, sent: 0, failed: to, error: 'Email sending is not configured. Contact your administrator.' };
  }

  const htmlContent = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.*)$/, '<p>$1</p>');

  const sent: string[] = [];
  const failed: string[] = [];

  for (const recipient of to) {
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${process.env.GMAIL_USER}>`,
        to: recipient,
        subject,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">${htmlContent}</div>`,
        text: content,
      });
      sent.push(recipient);
    } catch (err) {
      failed.push(recipient);
    }
  }

  return {
    success: sent.length > 0,
    sent: sent.length,
    failed,
    error: failed.length > 0 ? `Failed to send to ${failed.length} recipient(s)` : undefined,
  };
}
