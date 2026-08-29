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
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { missingEnv } = require('./_env.js');
const { REQUEST_COST } = require('./_plans.js');
const { sendEmail, adminAddresses } = require('./_email.js');

const DEFAULT_ADMINS = ['kane.foster@ymail.com'];
const PLAN_POINTS = { business: 0, pro: 3, max: 5 }; // must match admin.js and account.js

function adminList() {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

/* How many of one request's points its owner's plan did not cover, worked
 * out fresh from the database rather than trusted from anywhere else - the
 * same reason checkout.js prices a plan from PLANS rather than the request
 * body. Shared by chargeRequest and reclassifyRequest so the two can never
 * disagree about what a request is actually worth.
 *
 * Mirrors periodStart() in admin.js and account.js exactly, so the period
 * boundary this measures against is never a few hours off from what the
 * customer and admin page both already show.
 */
async function shortfallFor(db, userId, requestId) {
  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('business_name, stripe_customer_id, active_plan, current_period_end')
    .eq('id', userId).maybeSingle();
  if (pErr) throw new Error(pErr.message);

  const allowance = PLAN_POINTS[profile && profile.active_plan] || 0;
  const end = profile && profile.current_period_end ? new Date(profile.current_period_end) : null;
  let start;
  if (end && !isNaN(end)) {
    start = new Date(end);
    start.setMonth(start.getMonth() - 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const { data: periodReqs, error: prErr } = await db
    .from('requests')
    .select('id, points, created_at')
    .eq('user_id', userId)
    .neq('status', 'declined')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });
  if (prErr) throw new Error(prErr.message);

  let used = 0, shortfall = 0;
  for (const r of (periodReqs || [])) {
    const covered = Math.max(0, Math.min(r.points, allowance - used));
    if (r.id === requestId) { shortfall = r.points - covered; break; }
    used += r.points;
  }
  return { profile, shortfall };
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
        .select('id, user_id, kind, points, detail, status, created_at, billed_at, billed_amount, confirm_token')
        .order('created_at', { ascending: false })
        .limit(500);
      if (reqError) throw new Error(reqError.message);

      // The token itself is only ever the customer's to have, mailed straight
      // to them - the admin page only needs to know one is outstanding.
      const shaped = (reqs || []).map(({ confirm_token, ...r }) =>
        Object.assign(r, { awaitingConfirmation: Boolean(confirm_token) }));

      return res.status(200).json({ profiles: profiles || [], requests: shaped });
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
      if (status === 'in_progress') {
        const { data: cur, error: curErr } = await db
          .from('requests').select('confirm_token').eq('id', id).maybeSingle();
        if (curErr) throw new Error(curErr.message);
        if (cur && cur.confirm_token) {
          return res.status(400).json({ error: 'Waiting on the customer to confirm the new price first.' });
        }
      }
      const { error } = await db.from('requests').update({ status: status }).eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: change edit <-> feature, and hold for the customer's
    //      sign-off if that raised what they owe --------------------------
    if (action === 'reclassifyRequest') {
      const id = String(body.requestId || '');
      const kind = String(body.kind || '').toLowerCase();
      if (!id) return res.status(400).json({ error: 'Which request?' });
      if (!Object.prototype.hasOwnProperty.call(REQUEST_COST, kind)) {
        return res.status(400).json({ error: 'Unknown kind.' });
      }

      const { data: reqRow, error: reqErr } = await db.from('requests').select('*').eq('id', id).maybeSingle();
      if (reqErr) throw new Error(reqErr.message);
      if (!reqRow) return res.status(404).json({ error: 'Request not found.' });
      if (reqRow.status === 'done' || reqRow.status === 'declined') {
        return res.status(400).json({ error: 'Too late to reclassify a finished request.' });
      }
      if (reqRow.billed_at) return res.status(400).json({ error: 'Already charged — cannot reclassify.' });
      if (reqRow.kind === kind) return res.status(200).json({ ok: true, needsConfirmation: false });

      const { error: kindErr } = await db.from('requests')
        .update({ kind, points: REQUEST_COST[kind].points }).eq('id', id);
      if (kindErr) throw new Error(kindErr.message);

      const { profile, shortfall } = await shortfallFor(db, reqRow.user_id, id);

      // Covered by their points even under the new kind - nothing to hold for.
      if (shortfall <= 0) {
        const { error: clearErr } = await db.from('requests')
          .update({ confirm_token: null }).eq('id', id);
        if (clearErr) throw new Error(clearErr.message);
        return res.status(200).json({ ok: true, needsConfirmation: false });
      }

      const confirmToken = crypto.randomUUID();
      const amount = shortfall * REQUEST_COST.edit.amount; // £35/point, same rate either kind
      const patch = { confirm_token: confirmToken, price_confirmed_at: null };
      // Already under way and turned out bigger than booked: it must wait
      // for confirmation before continuing, not carry on unpaid-for.
      if (reqRow.status === 'in_progress') patch.status = 'new';

      const { error: patchErr } = await db.from('requests').update(patch).eq('id', id);
      if (patchErr) throw new Error(patchErr.message);

      // Telling them is best effort - the hold itself already took effect via
      // confirm_token, so a failed send delays them finding out, not the hold.
      const { data: who } = await db.auth.admin.getUserById(reqRow.user_id);
      const customerEmail = who && who.user && who.user.email;
      if (customerEmail) {
        const site = process.env.SITE_URL || 'https://one-bykanvas.vercel.app';
        const link = site + '/api/confirm-request?token=' + confirmToken;
        const result = await sendEmail({
          to: customerEmail,
          subject: 'Please confirm the price for your request',
          text: `Looking at what you asked for — "${reqRow.detail}" — this is actually `
              + `${kind === 'feature' ? 'a new feature' : 'an edit'} rather than what it was booked as, `
              + `which comes to an extra £${(amount / 100).toFixed(0)} on top of what your plan covers.\n\n`
              + `We won't start until you've confirmed you're happy with that:\n${link}\n\n`
              + `If that doesn't sound right, just reply to this email.`
        });
        console.log('admin: reclassify confirmation email', result);
      }

      return res.status(200).json({ ok: true, needsConfirmation: true, amount: amount });
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

      const { profile, shortfall } = await shortfallFor(db, reqRow.user_id, reqRow.id);
      if (!profile || !profile.stripe_customer_id) {
        return res.status(400).json({ error: 'No card on file for them yet.' });
      }
      if (shortfall <= 0) {
        return res.status(400).json({ error: 'This request is covered by their points — nothing to charge.' });
      }

      const amount = shortfall * REQUEST_COST.edit.amount; // £35/point, same rate either kind
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
