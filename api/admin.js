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
const Stripe = require('stripe');
const { missingEnv } = require('./_env.js');
const { REQUEST_COST } = require('./_plans.js');

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
        .select('id, user_id, kind, points, detail, status, created_at, billed_at, billed_amount')
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

    // ---- write: charge the card on file for a request the points did not
    //      cover, once it is done. Never twice - billed_at is the guard. ----
    if (action === 'chargeRequest') {
      const { STRIPE_SECRET_KEY } = process.env;
      if (!STRIPE_SECRET_KEY) {
        console.error('admin: missing environment variables:', missingEnv(['STRIPE_SECRET_KEY']).join(', '));
        return res.status(500).json({ error: 'Payments are not configured yet.' });
      }

      const requestId = String(body.requestId || '');
      if (!requestId) return res.status(400).json({ error: 'Which request?' });

      const { data: reqRow, error: reqErr } = await db
        .from('requests').select('*').eq('id', requestId).maybeSingle();
      if (reqErr) throw new Error(reqErr.message);
      if (!reqRow) return res.status(404).json({ error: 'Request not found.' });
      if (reqRow.status !== 'done') return res.status(400).json({ error: 'Mark it done before charging for it.' });
      if (reqRow.billed_at) return res.status(400).json({ error: 'Already charged.' });

      const { data: profile, error: pErr } = await db
        .from('profiles').select('business_name, stripe_customer_id').eq('id', reqRow.user_id).maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!profile || !profile.stripe_customer_id) {
        return res.status(400).json({ error: 'No card on file for them yet.' });
      }

      const amount = REQUEST_COST[reqRow.kind].amount;
      const stripe = new Stripe(STRIPE_SECRET_KEY);

      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      let paymentMethodId = customer && customer.invoice_settings
        && customer.invoice_settings.default_payment_method;
      if (!paymentMethodId) {
        const pms = await stripe.paymentMethods.list({ customer: profile.stripe_customer_id, type: 'card' });
        paymentMethodId = pms.data[0] && pms.data[0].id;
      }
      if (!paymentMethodId) {
        return res.status(400).json({ error: 'No card on file for them — ask them to add one from their account page.' });
      }

      let pi;
      try {
        pi = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'gbp',
          customer: profile.stripe_customer_id,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: (reqRow.kind === 'feature' ? 'Feature request' : 'Edit request')
            + (profile.business_name ? ' — ' + profile.business_name : ''),
          metadata: { request_id: reqRow.id, supabase_user_id: reqRow.user_id }
        });
      } catch (err) {
        if (err && err.type === 'StripeCardError') {
          return res.status(400).json({ error: 'Card declined: ' + (err.message || 'ask them to update their card.') });
        }
        throw err;
      }

      if (pi.status !== 'succeeded') {
        return res.status(400).json({
          error: 'Payment did not complete (status: ' + pi.status + '). '
            + 'Ask them to confirm it from their end, or update their card.'
        });
      }

      const { error: updErr } = await db.from('requests').update({
        billed_at: new Date().toISOString(),
        billed_amount: amount,
        stripe_payment_intent_id: pi.id
      }).eq('id', requestId);
      if (updErr) throw new Error(updErr.message);

      return res.status(200).json({ ok: true, amount: amount });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('admin:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
