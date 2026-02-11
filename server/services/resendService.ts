import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY || '';
const fromEmail = process.env.RESEND_FROM_EMAIL || 'LogExtract <onboarding@resend.dev>';
const appName = 'LogExtract';
const baseUrl = process.env.FRONTEND_URL || 'https://logextract.com';

const resend = apiKey ? new Resend(apiKey) : null;

export function isResendConfigured(): boolean {
  return Boolean(apiKey && resend);
}

// Resend limit: 2 requests/second. We throttle per send and crons add extra spacing.
const RESEND_RATE_LIMIT_RPS = 2;
const MIN_DELAY_MS = Math.ceil(1000 / RESEND_RATE_LIMIT_RPS); // 500ms between sends
let lastSendTime = 0;

/** Delay used by all cron batch sends (no-logbook, inactive-reminder, blast). Keeps us under 2 req/s. */
export const CRON_BATCH_SEND_DELAY_MS = 600;

export async function delayForBatchSend(): Promise<void> {
  await new Promise((r) => setTimeout(r, CRON_BATCH_SEND_DELAY_MS));
}

async function throttleResend(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSendTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastSendTime = Date.now();
}

/**
 * Send a single email. Use for transactional and campaign emails.
 * Throttles to stay within Resend's 2 requests/second limit.
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
  await throttleResend();
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const sendPayload = {
    from: params.from || fromEmail,
    to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await resend.emails.send(sendPayload);
    if (!error) {
      return { success: true, id: data?.id };
    }
    const is429 = (error as { statusCode?: number })?.statusCode === 429;
    if (is429 && attempt < maxAttempts) {
      const backoffMs = attempt * 1500; // 1.5s, 3s
      console.warn(`Resend 429 rate limit, backing off ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, backoffMs));
      continue;
    }
    console.error('Resend send error:', error);
    return { success: false, error: error.message };
  }
  return { success: false, error: 'Unexpected' };
}

/**
 * Use-the-app reminder: reminds users to go use the software. Mobile beta is now available.
 * Used by the no-logbook cron (3+ days, no scans) and by the one-time mobile-beta blast.
 */
export async function sendNoLogbookReminderEmail(toEmail: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const subject = `${appName}: Mobile is live — use it on your phone`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #003366; font-size: 1.5rem;">${appName} mobile is live</h1>
  <p>You can now use ${appName} on your <strong>phone</strong> as well as laptop and iPad. Scan and digitize your logbook from any device.</p>
  <p>What you can do:</p>
  <ul>
    <li>Open ${appName} in your browser on any device</li>
    <li>Upload or capture a photo of a logbook page</li>
    <li>We'll extract the entries and you can edit, export, and keep everything in one place</li>
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

/**
 * Inactive reminder: user has saved scans before but not in over 7 days.
 * Tells them the mobile version is now live and invites them back.
 * Used by the inactive-reminder cron.
 */
export async function sendInactiveReminderEmail(toEmail: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const subject = `${appName}: Mobile is live — you haven't scanned in a while`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #003366; font-size: 1.5rem;">The mobile version of ${appName} is now live</h1>
  <p>You haven't scanned a logbook page in over a week. We wanted to remind you that you can now use ${appName} on your <strong>phone</strong> as well as laptop and iPad — scan and digitize from anywhere.</p>
  <p>Come back and add another page to your permanent log when you're ready.</p>
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
