# Resend & no-logbook reminder — full setup guide

This guide walks you through setting up **Resend** for sending emails and the **no-logbook reminder** cron that emails users who signed up 3+ days ago and have never uploaded a logbook page (e.g. signed up on their phone and never used the app on laptop or iPad).

---

## What’s included

- **Resend** — transactional email (reusable for welcome emails, password resets, etc.).
- **No-logbook reminder** — one-time email per user: reminds them to use the app; mentions that the **mobile beta is now live** (laptop, iPad, or phone). Sent only to users who are 3+ days old and have zero verified scans.
- **Inactive reminder** — one-time email per user: reminds them they haven’t scanned a page in over a week; says the **mobile version is now live**. Sent to anyone who hasn’t scanned in 7+ days: users with scans (last scan 7+ days ago) or users with no scans (account 7+ days old).
- **Cron endpoints** — `POST /api/cron/no-logbook-reminder` (daily 9:00 UTC) and `POST /api/cron/inactive-reminder` (daily 10:00 UTC), protected by a secret.
- **One-time blast** — `POST /api/cron/blast-mobile-beta`: send the same "mobile beta is here" email to **every** user (manual trigger, not a cron). Use when you want to announce the mobile beta to everyone.

---

## Step 1: Run the database migration

You need a column on `user_profiles` to record when we sent the reminder (so we don’t email twice).

1. Open your **Supabase** project: [app.supabase.com](https://app.supabase.com) → your project.
2. Go to **SQL Editor**.
3. Open the file **`supabase/migration_no_logbook_reminder_sent.sql`** in this repo and copy its contents.
4. Paste into the SQL Editor and click **Run**.
5. Confirm there are no errors. This adds `no_logbook_reminder_sent_at` to `user_profiles`.
6. Run the **inactive reminder** migration: open **`supabase/migration_inactive_reminder_sent.sql`**, paste into the SQL Editor, and run. This adds `inactive_reminder_sent_at` to `user_profiles` (for the “haven’t scanned in 7+ days” reminder).

---

## Step 2: Create a Resend account and get an API key

1. Go to [resend.com](https://resend.com) and sign up (or log in).
2. In the dashboard, go to **API Keys** (or [resend.com/api-keys](https://resend.com/api-keys)).
3. Click **Create API Key**.
4. Give it a name (e.g. `LogExtract production`), leave permissions as **Sending access** (or Full access if you prefer).
5. Copy the key — it starts with `re_`. You won’t see it again; store it somewhere safe (e.g. password manager).
6. You’ll add this to your server env as `RESEND_API_KEY` in a later step.

---

## Step 3: (Production) Verify your domain in Resend

For testing you can use Resend’s default “from” address (`onboarding@resend.dev`). For production you should send from your own domain.

1. In Resend, go to **Domains** and click **Add Domain**.
2. Enter your domain (e.g. `yourdomain.com` or `logextract.com`).
3. Resend will show **DNS records** (SPF, DKIM, etc.). Add these in your DNS provider (e.g. Cloudflare, Namecheap, Vercel).
4. Wait until Resend shows the domain as **Verified** (can take a few minutes to a few hours).
5. When sending from this domain you’ll set `RESEND_FROM_EMAIL` (e.g. `LogExtract <hello@yourdomain.com>`).

---

## Step 4: Set environment variables on your backend

Your **backend** (e.g. Railway, or wherever the Express server runs) needs these variables.

### Required

| Variable           | Description |
|--------------------|-------------|
| `RESEND_API_KEY`   | Your Resend API key (starts with `re_`). |
| `CRON_SECRET`      | A long random secret used to protect the cron endpoint. Generate with: `openssl rand -hex 32`. |

### Optional but recommended (production)

| Variable              | Description |
|-----------------------|-------------|
| `RESEND_FROM_EMAIL`   | “From” address for emails, e.g. `LogExtract <hello@yourdomain.com>`. Must use a **verified** domain in Resend. If unset, defaults to `LogExtract <onboarding@resend.dev>` (Resend’s test sender). |
| `FRONTEND_URL`        | Full URL of your app (e.g. `https://logextract.com`). Used in the “Open LogExtract” button in the email. If unset, the email uses a fallback URL. |

### Where to set them

- **Railway:** Project → your service → **Variables** → Add each variable.
- **Vercel (if API runs there):** Project → **Settings** → **Environment Variables**.
- **Local:** In `.env` in the project root (do not commit `.env`; it’s in `.gitignore`).

Example `.env` snippet:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
CRON_SECRET=your_32_byte_hex_from_openssl_rand_hex_32
RESEND_FROM_EMAIL=LogExtract <hello@yourdomain.com>
FRONTEND_URL=https://logextract.com
```

Redeploy or restart the server after changing env vars.

---

## Step 5: Schedule the cron job (daily)

The reminder logic runs when something calls your cron endpoint **once per day**. The endpoint is:

- **URL:** `POST https://<YOUR_BACKEND_URL>/api/cron/no-logbook-reminder`
- **Authentication:** The request must include your cron secret in one of two ways:
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Query: `?secret=<CRON_SECRET>`

Replace `<YOUR_BACKEND_URL>` with your actual backend URL (e.g. `https://your-app.railway.app`).

### Option A: External cron service (e.g. cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) (or similar) and create an account / a new cron job.
2. Set the URL to:  
   `https://<YOUR_BACKEND_URL>/api/cron/no-logbook-reminder`
3. Set the schedule to **daily** (e.g. 9:00 AM UTC).
4. Set the **HTTP method** to **POST**.
5. Add a header:  
   `Authorization: Bearer <YOUR_CRON_SECRET>`  
   (use the same value as `CRON_SECRET` on your backend).
6. Save. The service will POST to your endpoint every day.

### Option B: Vercel Cron (backend on Railway) — implemented

If your **frontend** is on Vercel and your **API** is on Railway, the repo includes a Vercel serverless handler that proxies the cron to Railway.

1. In your Vercel project, add **Environment Variables** (Settings → Environment Variables):
   - **`CRON_SECRET`** — same value as on your Railway backend (you already added this).
   - **`CRON_TARGET_URL`** — your Railway backend URL, e.g. `https://your-app.railway.app` (no trailing slash).
2. The API routes **`api/cron/no-logbook-reminder.ts`** and **`api/cron/inactive-reminder.ts`** are in the repo. Vercel Cron in **`vercel.json`** calls no-logbook at 9:00 AM UTC and inactive-reminder at 10:00 AM UTC daily.

3. Deploy to Vercel. Crons run only on **production** deployments. To change schedules, edit the `crons` array in **vercel.json** (e.g. `0 9 * * *` = 9:00 AM UTC daily).

### Option C: Railway cron (if you use a cron add-on)

If your host supports cron (e.g. a Railway cron add-on or a separate worker), run a daily script that does:

```bash
curl -X POST "https://your-app.railway.app/api/cron/no-logbook-reminder" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in that environment and use the same value as on your backend.

**Inactive-reminder cron** (users who haven’t saved a scan in 7+ days):

- **URL:** `POST https://<YOUR_BACKEND_URL>/api/cron/inactive-reminder`
- **Auth:** Same (header or `?secret=`). Vercel runs this at 10:00 AM UTC if you use Option B.
- **Test:** `POST /api/cron/inactive-reminder-test?to=your@email.com` (sends one email, no DB change).

---

## Step 6: Verify the setup

1. **Resend**
   - In Resend dashboard, open **Logs** or **Emails**. After the first cron run, you should see sent emails (if there were eligible users).
2. **Cron endpoint**
   - Manual test (replace with your URL and secret):
     ```bash
     curl -X POST "https://YOUR_BACKEND_URL/api/cron/no-logbook-reminder" \
       -H "Authorization: Bearer YOUR_CRON_SECRET"
     ```
   - Expected: `200` and JSON like `{ "ok": true, "sent": 0, "eligible": 0 }` when there’s no one to email; or `sent`/`eligible` > 0 when there are users.
3. **Database**
   - In Supabase, **Table Editor** → `user_profiles`. After reminders are sent, those users should have `no_logbook_reminder_sent_at` set.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| `401 Unauthorized` on cron | `CRON_SECRET` must be set on the backend and the request must send the same value (header `Authorization: Bearer <secret>` or `?secret=<secret>`). |
| `503` or “Resend not configured” | `RESEND_API_KEY` must be set on the **backend** and the server restarted/redeployed. |
| Emails not received | Resend dashboard → Logs: check status (delivered / bounced / etc.). For production, ensure the “from” domain is verified and `RESEND_FROM_EMAIL` uses that domain. |
| No users get the email | Migration must be run (`no_logbook_reminder_sent_at` column exists). Users only get the email if: (1) profile created ≥ 3 days ago, (2) they have **no** rows in `verified_scans`, (3) `no_logbook_reminder_sent_at` is still null. |
| No users get inactive reminder | Run **`migration_inactive_reminder_sent.sql`**. Users are eligible if: they haven’t scanned in 7+ days (have scans and last scan was 7+ days ago, or have no scans and account is 7+ days old), and `inactive_reminder_sent_at` is still null. |

---

## One-time blast (mobile beta announcement)

To send a **one-time email to every user** (e.g. “mobile beta is live”), call the blast endpoint manually. This is **not** scheduled; you trigger it when you want.

- **URL:** `POST https://<YOUR_BACKEND_URL>/api/cron/blast-mobile-beta`
- **Auth:** Same as cron: `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`

**Test first** — send the same email to one address: `POST /api/cron/blast-mobile-beta-test?to=your@email.com`

```bash
curl -X POST "https://YOUR_BACKEND_URL/api/cron/blast-mobile-beta-test?to=your@email.com" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Then run the full blast:

```bash
curl -X POST "https://YOUR_BACKEND_URL/api/cron/blast-mobile-beta" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Response: `{ "ok": true, "sent": 42, "total": 42 }` (or partial success with `errors` array). Resend is throttled to avoid rate limits.

---

## Reusing Resend for other emails

All sending goes through **`server/services/resendService.ts`**:

- **Generic:** `sendEmail({ to, subject, html, from?, replyTo? })` for any one-off or campaign email.
- **Use-the-app / mobile beta:** `sendNoLogbookReminderEmail(toEmail)` — used by the no-logbook cron and by the blast endpoint.
- **Inactive reminder (7+ days no scan):** `sendInactiveReminderEmail(toEmail)` — used by the inactive-reminder cron.

**Test inactive reminder** (no DB updates):  
`POST /api/cron/inactive-reminder-test?to=your@email.com` with `Authorization: Bearer <CRON_SECRET>`.

You can add more helpers (e.g. `sendWelcomeEmail`, `sendPasswordReset`) in the same file and call them from your routes or jobs.
