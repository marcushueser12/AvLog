/**
 * Cron routes: no-logbook reminder, inactive reminder, blast-mobile-beta.
 * All batch email sends use resendService.delayForBatchSend() and sendEmail()'s
 * internal throttle + 429 backoff so we respect Resend rate limits (2 req/s).
 */
import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { sendNoLogbookReminderEmail, sendInactiveReminderEmail, isResendConfigured, delayForBatchSend } from '../services/resendService.js';

const router = express.Router();
const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const provided = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.query?.secret;
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/**
 * POST /api/cron/no-logbook-reminder
 *
 * Sends a one-time email to users who:
 * - Signed up 3+ days ago (user_profiles.created_at)
 * - Have never uploaded a logbook page (no row in verified_scans)
 * - Have not already been sent this reminder (no_logbook_reminder_sent_at is null)
 *
 * Call daily via Vercel Cron or Railway cron. Requires CRON_SECRET in Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 */
router.post('/no-logbook-reminder', verifyCronSecret, async (req, res) => {
  try {
    if (!isResendConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Resend not configured (RESEND_API_KEY)',
        sent: 0,
      });
    }

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoff = threeDaysAgo.toISOString();

    // user_profiles: created_at >= 3 days ago, reminder not yet sent
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, created_at')
      .lt('created_at', cutoff)
      .is('no_logbook_reminder_sent_at', null);

    if (profileError) {
      console.error('Cron no-logbook-reminder: profile query error', profileError);
      return res.status(500).json({ ok: false, error: profileError.message, sent: 0 });
    }

    if (!profiles?.length) {
      return res.json({ ok: true, sent: 0, message: 'No eligible users' });
    }

    const userIds = profiles.map((p) => p.user_id);

    // Users who have at least one verified scan
    const { data: usersWithScans, error: scansError } = await supabaseAdmin
      .from('verified_scans')
      .select('user_id')
      .in('user_id', userIds);

    if (scansError) {
      console.error('Cron no-logbook-reminder: verified_scans query error', scansError);
      return res.status(500).json({ ok: false, error: scansError.message, sent: 0 });
    }

    const hasScansSet = new Set((usersWithScans || []).map((r) => r.user_id));
    const eligibleIds = userIds.filter((id) => !hasScansSet.has(id));

    if (eligibleIds.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'All eligible users already have scans' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const userId of eligibleIds) {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError || !authUser?.user?.email) {
        errors.push(`${userId}: ${authError?.message || 'no email'}`);
        continue;
      }
      const email = authUser.user.email;
      const result = await sendNoLogbookReminderEmail(email);
      if (result.success) {
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ no_logbook_reminder_sent_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (updateError) {
          errors.push(`${userId}: failed to mark sent: ${updateError.message}`);
        } else {
          sent += 1;
        }
      } else {
        errors.push(`${userId}: ${result.error || 'send failed'}`);
      }
      await delayForBatchSend();
    }

    res.json({
      ok: true,
      sent,
      eligible: eligibleIds.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) {
    console.error('Cron no-logbook-reminder:', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error', sent: 0 });
  }
});

/**
 * POST /api/cron/inactive-reminder
 *
 * Sends a one-time email to users who haven't scanned a page in over 7 days:
 * - Have at least one scan but most recent was 7+ days ago, OR
 * - Have no scans and account is 7+ days old
 * - Have not already been sent this reminder (inactive_reminder_sent_at is null)
 *
 * Message: mobile version is now live, you haven't scanned a page in over a week.
 * Call daily via Vercel Cron or Railway cron. Requires CRON_SECRET.
 */
router.post('/inactive-reminder', verifyCronSecret, async (req, res) => {
  try {
    if (!isResendConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Resend not configured (RESEND_API_KEY)',
        sent: 0,
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    // Candidates: never sent this reminder
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, created_at')
      .is('inactive_reminder_sent_at', null);

    if (profileError) {
      console.error('Cron inactive-reminder: user_profiles query error', profileError);
      return res.status(500).json({ ok: false, error: profileError.message, sent: 0 });
    }
    if (!profiles?.length) {
      return res.json({ ok: true, sent: 0, message: 'No candidates (all already reminded)' });
    }

    // Per user: latest scan date (from verified_scans)
    const { data: scans, error: scansError } = await supabaseAdmin
      .from('verified_scans')
      .select('user_id, created_at');

    if (scansError) {
      console.error('Cron inactive-reminder: verified_scans query error', scansError);
      return res.status(500).json({ ok: false, error: scansError.message, sent: 0 });
    }

    const lastScanByUser = new Map<string, string>();
    for (const row of scans || []) {
      const existing = lastScanByUser.get(row.user_id);
      if (!existing || row.created_at > existing) {
        lastScanByUser.set(row.user_id, row.created_at);
      }
    }

    // Eligible = no scan in last 7 days: either no scans (use profile created_at) or last scan before cutoff
    const eligibleIds = profiles
      .filter((p) => {
        const lastScan = lastScanByUser.get(p.user_id);
        const referenceDate = lastScan ?? p.created_at; // no scans → use account age
        return referenceDate < cutoff;
      })
      .map((p) => p.user_id);

    if (eligibleIds.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'No users inactive 7+ days' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const userId of eligibleIds) {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError || !authUser?.user?.email) {
        errors.push(`${userId}: ${authError?.message || 'no email'}`);
        continue;
      }
      const email = authUser.user.email;
      const result = await sendInactiveReminderEmail(email);
      if (result.success) {
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ inactive_reminder_sent_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (updateError) {
          errors.push(`${userId}: failed to mark sent: ${updateError.message}`);
        } else {
          sent += 1;
        }
      } else {
        errors.push(`${userId}: ${result.error || 'send failed'}`);
      }
      await delayForBatchSend();
    }

    res.json({
      ok: true,
      sent,
      eligible: eligibleIds.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) {
    console.error('Cron inactive-reminder:', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error', sent: 0 });
  }
});

/**
 * POST /api/cron/inactive-reminder-test
 *
 * One-time test: send the inactive reminder email to a specific address.
 * No eligibility checks, no DB updates. Same CRON_SECRET.
 * Query or body: to=your@email.com
 */
router.post('/inactive-reminder-test', verifyCronSecret, async (req, res) => {
  try {
    if (!isResendConfigured()) {
      return res.status(503).json({ ok: false, error: 'Resend not configured (RESEND_API_KEY)' });
    }
    const to = (req.query.to as string) || (req.body?.to as string);
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Provide to=your@email.com in query or body' });
    }
    const result = await sendInactiveReminderEmail(to);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, message: `Inactive reminder test email sent to ${to}` });
  } catch (e: any) {
    console.error('Cron inactive-reminder-test:', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
});

/**
 * POST /api/cron/no-logbook-reminder-test
 *
 * One-time test: send the no-logbook reminder email to a specific address.
 * No eligibility checks, no DB updates. Same CRON_SECRET as the real cron.
 * Query or body: to=your@email.com
 */
router.post('/no-logbook-reminder-test', verifyCronSecret, async (req, res) => {
  try {
    if (!isResendConfigured()) {
      return res.status(503).json({ ok: false, error: 'Resend not configured (RESEND_API_KEY)' });
    }
    const to = (req.query.to as string) || (req.body?.to as string);
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Provide to=your@email.com in query or body' });
    }
    const result = await sendNoLogbookReminderEmail(to);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (e: any) {
    console.error('Cron no-logbook-reminder-test:', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
});

/**
 * POST /api/cron/blast-mobile-beta-test
 *
 * Send the mobile beta blast email to a single address (for testing).
 * Same CRON_SECRET. Query or body: to=your@email.com
 */
router.post('/blast-mobile-beta-test', verifyCronSecret, async (req, res) => {
  try {
    if (!isResendConfigured()) {
      return res.status(503).json({ ok: false, error: 'Resend not configured (RESEND_API_KEY)' });
    }
    const to = (req.query.to as string) || (req.body?.to as string);
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Provide to=your@email.com in query or body' });
    }
    const result = await sendNoLogbookReminderEmail(to);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, message: `Mobile beta test email sent to ${to}` });
  } catch (e: any) {
    console.error('Cron blast-mobile-beta-test:', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
});

/**
 * POST /api/cron/blast-mobile-beta
 *
 * One-time blast: send the "mobile beta is here" email to every user with an email.
 * Not a cron — call manually when you want to announce the mobile beta (e.g. curl with CRON_SECRET).
 * Requires CRON_SECRET in Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 */
router.post('/blast-mobile-beta', verifyCronSecret, async (req, res) => {
  try {
    if (!isResendConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Resend not configured (RESEND_API_KEY)',
        sent: 0,
      });
    }

    const emails: string[] = [];
    const perPage = 1000;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) {
        console.error('Cron blast-mobile-beta: listUsers error', error);
        return res.status(500).json({ ok: false, error: error.message, sent: 0 });
      }
      const users = data?.users ?? [];
      for (const u of users) {
        if (u.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) {
          emails.push(u.email);
        }
      }
      hasMore = users.length >= perPage;
      page += 1;
    }

    if (emails.length === 0) {
      return res.json({ ok: true, sent: 0, total: 0, message: 'No users with email found' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const email of emails) {
      const result = await sendNoLogbookReminderEmail(email);
      if (result.success) {
        sent += 1;
      } else {
        errors.push(`${email}: ${result.error || 'send failed'}`);
      }
      await delayForBatchSend();
    }

    res.json({
      ok: true,
      sent,
      total: emails.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) {
    console.error('Cron blast-mobile-beta:', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error', sent: 0 });
  }
});

export default router;
