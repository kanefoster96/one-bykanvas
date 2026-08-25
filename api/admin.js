/* Admin endpoint: everything the admin page can see or change goes through
 * here.
 *
 * The gate is in this file, not in the browser. The caller's Supabase token is
 * verified, the email on it is checked against the admin list, and only then is
 * the service role used. The pill in the site nav is cosmetic - it reads the
 * session the browser already has so the link appears for the right person -
 * and forging it gets you a link to a page that this endpoint refuses to feed.
 *
 * ADMIN_EMAILS (comma separated) overrides the default if it is ever more than
 * one person.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');

const DEFAULT_ADMINS = ['kane.foster@ymail.com'];

function adminList() {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('admin: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                  'SUPABASE_PUBLISHABLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    // ---- who is asking, and are they allowed? --------------------------
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in.' });

    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return res.status(401).json({ error: 'Your session has expired.' });
    }
    const me = userData.user;
    const email = String(me.email || '').toLowerCase();

    // A confirmed email as well as a matching one: an unconfirmed address is
    // not proof of anything.
    if (!adminList().includes(email) || !me.email_confirmed_at) {
      // Same response either way, so this cannot be used to probe for admins.
      return res.status(404).json({ error: 'Not found.' });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || '');

    // ---- read: every customer, newest first ----------------------------
    if (action === 'list') {
      const { data: profiles, error } = await db
        .from('profiles')
        .select('id, business_name, contact_name, business_type, active_plan, selected_plan, ' +
                'subscription_status, current_period_end, site_url, site_status, requested_domain, domain_owned, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);

      const { data: reqs, error: reqError } = await db
        .from('requests')
        .select('id, user_id, kind, points, detail, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (reqError) throw new Error(reqError.message);

      return res.status(200).json({ profiles: profiles || [], requests: reqs || [] });
    }

    // ---- write: the site address and whether it is live ----------------
    if (action === 'setSite') {
      const userId = String(body.userId || '');
      const siteUrl = body.siteUrl == null ? null : String(body.siteUrl).trim();
      const siteStatus = String(body.siteStatus || 'building');
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (!['building', 'live', 'paused'].includes(siteStatus)) {
        return res.status(400).json({ error: 'Unknown site status.' });
      }
      // A site cannot be live without an address to be live at.
      if (siteStatus === 'live' && !siteUrl) {
        return res.status(400).json({ error: 'Add the address before marking it live.' });
      }
      const { error } = await db
        .from('profiles')
        .update({ site_url: siteUrl || null, site_status: siteStatus })
        .eq('id', userId);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: move a request along --------------------------------
    if (action === 'setRequestStatus') {
      const id = String(body.requestId || '');
      const status = String(body.status || '');
      if (!id) return res.status(400).json({ error: 'Which request?' });
      if (!['new', 'in_progress', 'done', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
      }
      const { error } = await db.from('requests').update({ status: status }).eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('admin:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
