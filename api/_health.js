/* Monitoring: the jobs that run on a schedule say when they last finished,
 * and anything that breaks money or sign-ups tells Kane straight away.
 *
 *   beat(db, 'followups')            - a scheduled job finished
 *   alertAdmin(db, key, title, body) - push and email Kane, at most once an
 *                                      hour per key (a failing webhook Stripe
 *                                      retries would otherwise send one per
 *                                      retry); the next alert says how many
 *                                      were held back.
 *
 * api/health.js reads the beats every morning. Everything here is best
 * effort and never throws: monitoring must not be the thing that breaks.
 */
const { notifyAdmin } = require('./_notify.js');
const { sendEmail, adminAddresses } = require('./_email.js');

const ALERT_EVERY_MS = 60 * 60 * 1000;

async function beat(db, job, detail) {
  try {
    const { error } = await db.from('health_beats')
      .upsert({ job, ok_at: new Date().toISOString(), detail: detail ? String(detail).slice(0, 300) : null }, { onConflict: 'job' });
    if (error) console.error('health: beat %s failed:', job, error.message);
  } catch (e) { console.error('health: beat %s failed:', job, e && e.message); }
}

async function alertAdmin(db, key, title, body) {
  try {
    const { data: row } = await db.from('alert_throttle').select('last_at, suppressed').eq('key', key).maybeSingle();
    if (row && Date.now() - new Date(row.last_at).getTime() < ALERT_EVERY_MS) {
      await db.from('alert_throttle').update({ suppressed: (row.suppressed || 0) + 1 }).eq('key', key);
      return 'held';
    }
    const held = (row && row.suppressed) || 0;
    await db.from('alert_throttle').upsert({ key, last_at: new Date().toISOString(), suppressed: 0 }, { onConflict: 'key' });
    const text = String(body || '') + (held ? `\n\n(${held} more like this in the last hour were held back.)` : '');
    await notifyAdmin(db, 'Problem: ' + title, text.slice(0, 480), '/admin.html').catch(() => {});
    await sendEmail({
      to: adminAddresses(),
      subject: 'Kanvas One problem: ' + String(title).replace(/[\r\n]+/g, ' ').slice(0, 120),
      text: text + '\n\nFull details are in the Vercel logs for kanvas.one.'
    }).catch(() => {});
    return 'sent';
  } catch (e) {
    console.error('health: alert %s failed:', key, e && e.message);
    return 'failed';
  }
}

/* For an error handler with no database client to hand. */
async function alertNow(key, title, body) {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return 'skipped';
    const { createClient } = require('@supabase/supabase-js');
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    return await alertAdmin(db, key, title, body);
  } catch (e) { return 'failed'; }
}

module.exports = { beat, alertAdmin, alertNow };
