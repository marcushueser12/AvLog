/**
 * Vercel Cron handler: proxies to the Railway backend so the inactive-reminder
 * job runs there (Supabase + Resend live on backend).
 *
 * Required Vercel env: CRON_SECRET, CRON_TARGET_URL (your Railway backend URL).
 */

const CRON_SECRET = process.env.CRON_SECRET;
const TARGET = process.env.CRON_TARGET_URL;

export const config = { maxDuration: 60 };

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!TARGET) {
    return new Response(
      JSON.stringify({ error: 'CRON_TARGET_URL not set in Vercel environment variables' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const url = `${TARGET.replace(/\/$/, '')}/api/cron/inactive-reminder`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
