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
const { shortfallFor } = require('./_billing.js');

const DEFAULT_ADMINS = ['kane.foster@ymail.com'];

function adminList() {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

/* Sets the request on hold for the customer's own sign-off and emails them
 * the one-click link, mailed straight to the address on their account -
 * no login, the token itself is the credential. Returns the pence amount so
 * the caller can say what was asked for. */
async function askForConfirmation(db, reqRow, shortfall) {
  const confirmToken = crypto.randomUUID();
  const amount = shortfall * REQUEST_COST.edit.amount; // £35/point, same rate either kind

  const { error: patchErr } = await db.from('requests')
    .update({ confirm_token: confirmToken, price_confirmed_at: null })
    .eq('id', reqRow.id);
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
      text: `Before we start on this - "${reqRow.detail}" - we wanted to check you're happy with the cost: `
          + `it comes to an extra £${(amount / 100).toFixed(0)} on top of what your plan covers this month.\n\n`
          + `Click below to confirm and we'll get started:\n${link}\n\n`
          + `If that doesn't sound right, just reply to this email.`
    });
    console.log('admin: confirmation email', result);
  }

  return amount;
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

      // Both active and retired, so a retired one can still be brought back
      // rather than needing to be typed out again.
      const { data: templates, error: tplError } = await db
        .from('templates')
        .select('id, kind, name, description, active, created_at')
        .order('created_at', { ascending: false });
      if (tplError) throw new Error(tplError.message);

      return res.status(200).json({ profiles: profiles || [], requests: shaped, templates: templates || [] });
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

    // ---- write: move a request along ------------------------------------
    //
    // Starting work is the one gate that matters: whichever way a request
    // got here - submitted that way, or reclassified into it - trying to
    // move it to in_progress is what decides whether the points cover it
    // (silent, nothing to do) or the customer needs to agree to pay the
    // difference first. Nothing is asked of them until this point, and
    // never twice for the same price - confirm_token is both the guard and
    // the trigger.
    if (action === 'setRequestStatus') {
      const id = String(body.requestId || '');
      const status = String(body.status || '');
      if (!id) return res.status(400).json({ error: 'Which request?' });
      if (!['new', 'accepted', 'in_progress', 'done', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
      }

      if (status === 'in_progress') {
        const { data: reqRow, error: curErr } = await db.from('requests').select('*').eq('id', id).maybeSingle();
        if (curErr) throw new Error(curErr.message);
        if (!reqRow) return res.status(404).json({ error: 'Request not found.' });

        if (reqRow.confirm_token) {
          return res.status(400).json({
            error: 'Waiting on the customer to confirm the price first.',
            awaitingConfirmation: true
          });
        }

        // Already accepted - either free, or already confirmed - so there is
        // nothing left to check.
        if (reqRow.status !== 'accepted') {
          const { shortfall } = await shortfallFor(db, reqRow.user_id, id);
          if (shortfall > 0) {
            const amount = await askForConfirmation(db, reqRow, shortfall);
            return res.status(400).json({
              error: 'Sent — asked them to confirm £' + (amount / 100).toFixed(0) + ' before this can start.',
              awaitingConfirmation: true
            });
          }
        }
      }

      const { error } = await db.from('requests').update({ status: status }).eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: change edit <-> feature. Any price question that raises
    //      is decided fresh the next time this is moved to in_progress,
    //      not asked here. ------------------------------------------------
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
      if (reqRow.kind === kind) return res.status(200).json({ ok: true, shortfall: 0 });

      // A confirmation already sent or given was for the old price - it does
      // not carry over to the new one.
      const patch = { kind, points: REQUEST_COST[kind].points, confirm_token: null, price_confirmed_at: null };
      // Already accepted or under way and turned out to be the other kind:
      // pull it back to Request rather than let it continue, or start,
      // against a price nobody has agreed to.
      if (reqRow.status === 'accepted' || reqRow.status === 'in_progress') patch.status = 'new';

      const { error: kindErr } = await db.from('requests').update(patch).eq('id', id);
      if (kindErr) throw new Error(kindErr.message);

      const { shortfall } = await shortfallFor(db, reqRow.user_id, id);
      return res.status(200).json({ ok: true, shortfall, amount: shortfall * REQUEST_COST.edit.amount });
    }

    // ---- write: save a finished request as a reusable template ----------
    if (action === 'saveTemplate') {
      const kind = String(body.kind || '').toLowerCase();
      const name = String(body.name || '').trim();
      const description = body.description == null ? null : String(body.description).trim() || null;
      if (!Object.prototype.hasOwnProperty.call(REQUEST_COST, kind)) {
        return res.status(400).json({ error: 'Unknown kind.' });
      }
      if (!name) return res.status(400).json({ error: 'Give the template a name.' });

      const { data, error } = await db.from('templates')
        .insert({ kind, name, description }).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, template: data });
    }

    // ---- write: retire or restore a template -----------------------------
    if (action === 'setTemplateActive') {
      const id = String(body.templateId || '');
      const active = Boolean(body.active);
      if (!id) return res.status(400).json({ error: 'Which template?' });
      const { error } = await db.from('templates').update({ active }).eq('id', id);
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
