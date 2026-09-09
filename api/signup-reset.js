/* Clears a stale, never-confirmed account so the same email can sign up
 * again.
 *
 * Why: with email confirmation on, signing up an address that already has an
 * account hands the browser a decoy user id, not the real one. If that
 * account was never confirmed the customer cannot log in either, so they
 * would be stuck between an account they cannot use and a signup that will
 * not take. The wizard calls this when it hits that wall.
 *
 * Narrow on purpose: the account must be unconfirmed, older than the half
 * hour the pending-payment path allows (so nobody can wipe a signup that is
 * in progress), and never subscribed. Anything else is left alone.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');

const STALE_AFTER_MS = 30 * 60 * 1000;
const LIVE = ['active', 'trialing', 'past_due', 'unpaid'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('signup-reset: missing env:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'That email does not look right.' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    /* No lookup-by-email in the admin API; the list is small enough to scan. */
    let found = null;
    for (let page = 1; page <= 10 && !found; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      const users = (data && data.users) || [];
      found = users.find((u) => String(u.email || '').toLowerCase() === email) || null;
      if (users.length < 1000) break;
    }
    if (!found) return res.status(200).json({ ok: false, reason: 'none' });
    if (found.email_confirmed_at) return res.status(200).json({ ok: false, reason: 'confirmed' });

    const ageMs = Date.now() - new Date(found.created_at).getTime();
    if (!(ageMs >= STALE_AFTER_MS)) return res.status(200).json({ ok: false, reason: 'recent' });

    const { data: profile } = await admin
      .from('profiles').select('subscription_status').eq('id', found.id).maybeSingle();
    if (profile && LIVE.includes(profile.subscription_status)) {
      return res.status(200).json({ ok: false, reason: 'subscribed' });
    }

    const { error: delError } = await admin.auth.admin.deleteUser(found.id);
    if (delError) throw new Error(delError.message);
    console.log('signup-reset: cleared stale unconfirmed account for', email);
    return res.status(200).json({ ok: true, reset: true });
  } catch (err) {
    console.error('signup-reset:', err && err.message);
    return res.status(500).json({ error: 'Could not check that just now. Try again.' });
  }
};
