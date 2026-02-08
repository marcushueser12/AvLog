import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY || '';
const fromEmail = process.env.RESEND_FROM_EMAIL || 'LogExtract <onboarding@resend.dev>';
const appName = 'LogExtract';
const baseUrl = process.env.FRONTEND_URL || 'https://logextract.com';

const resend = apiKey ? new Resend(apiKey) : null;

export function isResendConfigured(): boolean {
  return Boolean(apiKey && resend);
}

/**
 * Send a single email. Use for transactional and campaign emails.
 */
export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!resend) {
    console.warn('Resend not configured (RESEND_API_KEY missing). Skipping send.');
    return { success: false, error: 'Resend not configured' };
  }
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const { data, error } = await resend.emails.send({
    from: params.from || fromEmail,
    to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  });
  if (error) {
    console.error('Resend send error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, id: data?.id };
}

/**
 * No-logbook reminder: for users who signed up 3+ days ago and have never uploaded a logbook page.
 * Gentle nudge to try on laptop or iPad (mobile phone experience still in the works).
 */
export async function sendNoLogbookReminderEmail(toEmail: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const subject = `${appName}: Ready when you are — try it on your laptop or iPad`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #003366; font-size: 1.5rem;">You’re all set — next step is on your laptop or iPad</h1>
  <p>You created your ${appName} account a few days ago. We wanted to remind you that the best way to scan and digitize your logbook right now is on a <strong>laptop or iPad</strong> — it works great on both.</p>
  <p>Our phone experience is still in the works, so if you signed up on your phone, open ${appName} on your laptop or iPad when you have a minute:</p>
  <ul>
    <li>Open ${appName} in your browser (Safari, Chrome, or any browser on laptop or iPad)</li>
    <li>Upload or capture a photo of a logbook page</li>
    <li>We’ll extract the entries and you can edit, export, and keep everything in one place</li>
  </ul>
  <p style="margin-top: 28px;">
    <a href="${baseUrl}" style="display: inline-block; background: #003366; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Open ${appName}</a>
  </p>
  <p style="margin-top: 28px; font-size: 0.9rem; color: #666;">If you have any questions, just reply to this email.</p>
  <p style="margin-top: 16px; font-size: 0.85rem; color: #999;">— The ${appName} team</p>
</body>
</html>
`.trim();

  return sendEmail({ to: toEmail, subject, html });
}
