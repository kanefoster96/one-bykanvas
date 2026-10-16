/* The morning health check (vercel.json cron, 07:45 UTC). Looks for the
 * kinds of problem that broke this site silently before - a setting missing
 * from Vercel, a scheduled job that stopped, mail stuck in the queue, Stripe
 * unable to reach the webhook - and emails and pushes Kane a list if it finds
 * any. A healthy morning sends nothing.
 *
 * Guarded by CRON_SECRET, like the other scheduled jobs. ?dry=1 (with the
 * secret) returns the report without sending it.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { notifyAdmin } = require('./_notify.js');
const { beat } = require('./_health.js');

/* Every setting the site needs, and what stops without it. */
const NEEDED = {
  SUPABASE_URL: 'everything',
  SUPABASE_SERVICE_ROLE_KEY: 'everything on the server',
  SUPABASE_PUBLISHABLE_KEY: 'logins checked by the server',
  STRIPE_SECRET_KEY: 'payments',
  STRIPE_WEBHOOK_SECRET: 'plans going live after payment',
  RESEND_API_KEY: 'all email',
  EMAIL_FROM: 'all email',
  CRON_SECRET: 'follow-ups, request emails and this check',
  META_CAPI_TOKEN: 'Meta counting leads and sales from the server',
  ADMIN_EMAILS: 'admin access and alerts'
};

/* How long each job may go quiet before it counts as stopped. */
const JOBS = {
  followups: { every: 26 * 60 * 60 * 1000, what: 'The daily follow-up emails' },
  'request-mail': { every: 30 * 60 * 1000, what: 'Emails about customer requests (every 5 minutes)' }
};

async function check(db) {
  const problems = [];

  // 1. Settings.
  const missing = Object.keys(NEEDED).filter((k) => !String(process.env[k] || '').trim());
  missing.forEach((k) => problems.push(`${k} is not set in Vercel, so ${NEEDED[k]} won't work.`));

  // 2. Scheduled jobs still running.
  const { data: beats, error: bErr } = await db.from('health_beats').select('job, ok_at');
  if (bErr) problems.push('Could not read the job check-ins: ' + bErr.message);
  else {
    const seen = {};
    (beats || []).forEach((b) => { seen[b.job] = new Date(b.ok_at).getTime(); });
    Object.keys(JOBS).forEach((job) => {
      if (!seen[job]) return; // not reported yet: a fresh deploy, not a failure
      const quiet = Date.now() - seen[job];
      if (quiet > JOBS[job].every) {
        problems.push(`${JOBS[job].what} last finished ${Math.round(quiet / 3600000)} hours ago.`);
      }
    });
  }

  // 3. Request emails stuck in the queue.
  const { count: stuck } = await db.from('request_notes')
    .select('id', { count: 'exact', head: true })
    .is('emailed_at', null).eq('private', false)
    .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (stuck) problems.push(`${stuck} message${stuck === 1 ? '' : 's'} to customers about their requests ha${stuck === 1 ? 's' : 've'} waited over an hour to be emailed.`);

  // 4. Stripe: the key works, the webhook is on, and Stripe could deliver to it.
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const hooks = await stripe.webhookEndpoints.list({ limit: 20 });
      const ours = (hooks.data || []).filter((h) => /\/api\/stripe-webhook/.test(h.url));
      if (!ours.length) problems.push('Stripe has no webhook pointing at /api/stripe-webhook, so paid plans will not go live.');
      ours.filter((h) => h.status !== 'enabled').forEach((h) => problems.push(`The Stripe webhook to ${h.url} is ${h.status}.`));
      const failed = await stripe.events.list({ delivery_success: false, created: { gte: Math.floor(Date.now() / 1000) - 86400 }, limit: 20 });
      const n = (failed.data || []).length;
      if (n) problems.push(`${n}${failed.has_more ? '+' : ''} Stripe event${n === 1 ? '' : 's'} in the last day could not be delivered to the webhook (${Array.from(new Set(failed.data.map((e) => e.type))).slice(0, 4).join(', ')}).`);
    } catch (e) {
      problems.push('Could not check Stripe: ' + (e && e.message));
    }
  }

  // 5. Alerts that went off since yesterday morning, as a reminder.
  const { data: alerts } = await db.from('alert_throttle').select('key, last_at, suppressed')
    .gte('last_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  (alerts || []).forEach((a) => problems.push(`Alert "${a.key}" went off in the last day${a.suppressed ? ` (plus ${a.suppressed} repeats held back)` : ''}.`));

  return problems;
}

module.exports = async function handler(req, res) {
  const { CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!CRON_SECRET || (req.headers.authorization || '') !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Nothing else can be checked; say so the only way left.
    await sendEmail({ to: adminAddresses(), subject: 'Kanvas One problem: Supabase settings missing', text: 'The morning health check could not run: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in Vercel.' }).catch(() => {});
    return res.status(500).json({ error: 'Not configured.' });
  }
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const problems = await check(db);
    const dry = /(^|[?&])dry=1(&|$)/.test(String(req.url || '').split('?')[1] || '');
    if (problems.length && !dry) {
      const text = 'The morning check found ' + problems.length + ' thing' + (problems.length === 1 ? '' : 's') + ' to look at:\n\n'
        + problems.map((p) => '- ' + p).join('\n') + '\n\nThe Vercel logs for kanvas.one have the detail.';
      await sendEmail({ to: adminAddresses(), subject: `Kanvas One health: ${problems.length} problem${problems.length === 1 ? '' : 's'}`, text });
      await notifyAdmin(db, `Health check: ${problems.length} problem${problems.length === 1 ? '' : 's'}`, problems[0], '/admin.html').catch(() => {});
    }
    await beat(db, 'health', problems.length ? problems.length + ' problems' : 'ok');
    console.log('health: %d problems', problems.length);
    return res.status(200).json({ ok: problems.length === 0, problems });
  } catch (err) {
    console.error('health: check failed:', err && err.message);
    await sendEmail({ to: adminAddresses(), subject: 'Kanvas One problem: the health check crashed', text: 'The morning health check failed: ' + (err && err.message) }).catch(() => {});
    return res.status(500).json({ error: 'Check failed.' });
  }
};
