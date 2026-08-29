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
const { sendEmail } = require('./_email.js');
const { shortfallFor } = require('./_billing.js');

const DEFAULT_ADMINS = ['kane.foster@ymail.com'];

function adminList() {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

/* Charges the card on file off-session, for a shortfall already worked out
 * by the caller. Shared by accepting a request (the normal path - before any
 * work starts) and the legacy done-stage charge button. Throws a plain Error
 * with .httpStatus set on anything the caller should show rather than a 500 -
 * no card on file, a decline, or a payment that did not complete. */
async function chargeCardForRequest(stripe, profile, reqRow, amount) {
  if (!profile || !profile.stripe_customer_id) {
    const e = new Error('No card on file for them yet.'); e.httpStatus = 400; throw e;
  }

  const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
  let paymentMethodId = customer && customer.invoice_settings
    && customer.invoice_settings.default_payment_method;
  if (!paymentMethodId) {
    const pms = await stripe.paymentMethods.list({ customer: profile.stripe_customer_id, type: 'card' });
    paymentMethodId = pms.data[0] && pms.data[0].id;
  }
  if (!paymentMethodId) {
    const e = new Error('No card on file for them — ask them to add one from their account page.');
    e.httpStatus = 400; throw e;
  }

  let pi;
  try {
    pi = await stripe.paymentIntents.create({
      amount, currency: 'gbp',
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
      const e = new Error('Card declined: ' + (err.message || 'ask them to update their card.'));
      e.httpStatus = 400; throw e;
    }
    throw err;
  }

  if (pi.status !== 'succeeded') {
    const e = new Error('Payment did not complete (status: ' + pi.status + '). '
      + 'Ask them to confirm it from their end, or update their card.');
    e.httpStatus = 400; throw e;
  }

  return pi;
}

/* Tells a customer a feature on their site was added or updated - best
   effort, same reasoning as everywhere else email is sent here: the change
   itself already took effect, so a failed send delays them finding out
   rather than blocking anything. */
async function notifyFeatureEmail(db, userId, name, verb) {
  const { data: who } = await db.auth.admin.getUserById(userId);
  const customerEmail = who && who.user && who.user.email;
  if (!customerEmail) return;

  const site = process.env.SITE_URL || 'https://one-bykanvas.vercel.app';
  const result = await sendEmail({
    to: customerEmail,
    subject: `A feature on your site was ${verb}`,
    text: `We've ${verb} a feature on your site: "${name}".\n\n`
        + `See it on your account page:\n${site}/account.html`
  });
  console.log('admin: feature notify email', result);
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
        .select('id, business_name, contact_name, phone, business_type, active_plan, selected_plan, ' +
                'subscription_status, current_period_end, site_url, site_status, requested_domain, domain_owned, ' +
                'address, service_area, opening_hours, services, site_goals, site_uses, existing_links, ' +
                'admin_notes, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);

      const { data: reqs, error: reqError } = await db
        .from('requests')
        .select('id, user_id, kind, points, detail, status, created_at, billed_at, billed_amount, confirm_token, attachment_paths')
        .order('created_at', { ascending: false })
        .limit(500);
      if (reqError) throw new Error(reqError.message);

      // The bucket is private, so a plain path is useless to the browser -
      // one short-lived signed URL per screenshot, generated with the
      // service role since our own admin session has no storage access to
      // a customer's folder.
      const allPaths = (reqs || []).flatMap((r) => r.attachment_paths || []);
      let signedByPath = {};
      if (allPaths.length) {
        const { data: signedList, error: signErr } = await db.storage
          .from('request-attachments').createSignedUrls(allPaths, 3600);
        if (signErr) throw new Error(signErr.message);
        (signedList || []).forEach((s) => { if (s.signedUrl) signedByPath[s.path] = s.signedUrl; });
      }

      // confirm_token is a legacy field - nothing sets it any more, so it is
      // left out of the response rather than surfaced as anything to react to.
      const shaped = (reqs || []).map(({ confirm_token, attachment_paths, ...r }) =>
        Object.assign(r, {
          attachments: (attachment_paths || []).map((p) => signedByPath[p]).filter(Boolean)
        }));

      // Both active and retired, so a retired one can still be brought back
      // rather than needing to be typed out again.
      const { data: templates, error: tplError } = await db
        .from('templates')
        .select('id, kind, name, description, active, created_at')
        .order('created_at', { ascending: false });
      if (tplError) throw new Error(tplError.message);

      // Logged history of monthly SEO updates for Max customers - enough
      // rows to tell whether this billing period already has one, and to
      // show the log itself on a customer's page.
      const { data: seoUpdates, error: seoError } = await db
        .from('seo_updates')
        .select('id, user_id, note, created_at')
        .order('created_at', { ascending: false })
        .limit(300);
      if (seoError) throw new Error(seoError.message);

      // Everything a customer's site can do - updated_at (not created_at) is
      // what the 30-day NEW pill is measured against, bumped by "mark as
      // updated" as well as on insert.
      const { data: siteFeatures, error: sfError } = await db
        .from('site_features')
        .select('id, user_id, name, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (sfError) throw new Error(sfError.message);

      return res.status(200).json({
        profiles: profiles || [], requests: shaped, templates: templates || [],
        seoUpdates: seoUpdates || [], siteFeatures: siteFeatures || []
      });
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

    // ---- write: admin's own notes about a customer - never shown to them ----
    if (action === 'setAdminNotes') {
      const userId = String(body.userId || '');
      const notes = body.notes == null ? null : String(body.notes).trim() || null;
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      const { error } = await db.from('profiles').update({ admin_notes: notes }).eq('id', userId);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: add something to a customer's "features on your site"
    //      list by hand - the same list a finished feature request also
    //      lands on. Tells them about it, same as marking one updated. ----
    if (action === 'addSiteFeature') {
      const userId = String(body.userId || '');
      const name = String(body.name || '').trim().slice(0, 200);
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (!name) return res.status(400).json({ error: 'Name the feature.' });

      const { data, error } = await db.from('site_features')
        .insert({ user_id: userId, name }).select().single();
      if (error) throw new Error(error.message);

      await notifyFeatureEmail(db, userId, name, 'added');
      return res.status(200).json({ ok: true, feature: data });
    }

    // ---- write: refresh a feature's 30-day NEW pill without renaming it -
    //      for when something existing gets reworked, not replaced. --------
    if (action === 'markFeatureUpdated') {
      const id = String(body.featureId || '');
      if (!id) return res.status(400).json({ error: 'Which feature?' });

      const { data, error } = await db.from('site_features')
        .update({ updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: 'Feature not found.' });

      await notifyFeatureEmail(db, data.user_id, data.name, 'updated');
      return res.status(200).json({ ok: true, feature: data });
    }

    // ---- write: remove one - no email, nothing to tell them about ----
    if (action === 'removeSiteFeature') {
      const id = String(body.featureId || '');
      if (!id) return res.status(400).json({ error: 'Which feature?' });
      const { error } = await db.from('site_features').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: log a Max customer's SEO update for this billing period ----
    if (action === 'logSeoUpdate') {
      const userId = String(body.userId || '');
      const note = String(body.note || '').trim();
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (!note || note.length > 2000) return res.status(400).json({ error: 'Say what was actually changed.' });
      const { data, error } = await db.from('seo_updates')
        .insert({ user_id: userId, note }).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, entry: data });
    }

    // ---- write: move a request along ------------------------------------
    //
    // Accepting is the one gate that matters: it is the moment points get
    // redeemed or the card on file gets charged for whatever they don't
    // cover - never automatically, always this admin choosing to (and,
    // for a shortfall, choosing how much - see chargeCardForRequest). Once
    // accepted, nothing is charged twice for the same request, and nothing
    // can skip straight from a fresh Request to in_progress or done without
    // going through this first.
    if (action === 'setRequestStatus') {
      const { STRIPE_SECRET_KEY } = process.env;
      const id = String(body.requestId || '');
      const status = String(body.status || '');
      if (!id) return res.status(400).json({ error: 'Which request?' });
      if (!['new', 'accepted', 'in_progress', 'done', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
      }

      const { data: reqRow, error: curErr } = await db.from('requests').select('*').eq('id', id).maybeSingle();
      if (curErr) throw new Error(curErr.message);
      if (!reqRow) return res.status(404).json({ error: 'Request not found.' });

      // Legacy safety net: a request still carrying an old email-confirmation
      // token (from before accepting moved to this admin action) cannot move
      // on until that is resolved. Nothing new ever sets this token any more.
      if ((status === 'in_progress' || status === 'done') && reqRow.confirm_token) {
        return res.status(400).json({ error: 'Still waiting on their price confirmation email.' });
      }
      if ((status === 'in_progress' || status === 'done') && reqRow.status === 'new') {
        return res.status(400).json({ error: 'Accept the request first.' });
      }

      let amount = 0;
      if (status === 'accepted' && reqRow.status === 'new') {
        const { profile, shortfall } = await shortfallFor(db, reqRow.user_id, id);
        const computed = shortfall * REQUEST_COST.edit.amount; // £40/point, same rate either kind
        // The admin can override the computed amount - a discount on a request
        // that turned out easier than its points suggest, say. Never asked of
        // the customer; this admin decides it before the charge goes through.
        amount = body.amount == null ? computed : Math.max(0, Math.round(Number(body.amount)));

        if (amount > 0) {
          if (!STRIPE_SECRET_KEY) {
            console.error('admin: missing environment variables:', missingEnv(['STRIPE_SECRET_KEY']).join(', '));
            return res.status(500).json({ error: 'Payments are not configured yet.' });
          }
          const stripe = new Stripe(STRIPE_SECRET_KEY);
          let pi;
          try {
            pi = await chargeCardForRequest(stripe, profile, reqRow, amount);
          } catch (err) {
            if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
            throw err;
          }

          const { error: billErr } = await db.from('requests').update({
            billed_at: new Date().toISOString(), billed_amount: amount, stripe_payment_intent_id: pi.id
          }).eq('id', id);
          if (billErr) throw new Error(billErr.message);
        }
      }

      const { error } = await db.from('requests').update({ status: status }).eq('id', id);
      if (error) throw new Error(error.message);

      // Turned live just now - a finished feature becomes something their
      // site has, added to the same list a feature can also be added to by
      // hand, and told about the same way. Edits don't get one: nothing new
      // to list.
      if (status === 'done' && reqRow.status !== 'done' && reqRow.kind === 'feature') {
        const { error: featErr } = await db.from('site_features')
          .insert({ user_id: reqRow.user_id, name: reqRow.detail });
        if (featErr) throw new Error(featErr.message);
        await notifyFeatureEmail(db, reqRow.user_id, reqRow.detail, 'added');
      }

      return res.status(200).json({ ok: true, amount });
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

      const patch = { kind, points: REQUEST_COST[kind].points };
      // Already accepted or under way and turned out to be the other kind:
      // pull it back to Request rather than let it continue, or start,
      // against a price nobody has agreed - or paid - to yet. Accepting it
      // again is what works out the new shortfall, fresh.
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
    //      cover. Normally settled the moment it is accepted (above) - this
    //      stays as a fallback for anything that reached done without being
    //      charged. Never twice - billed_at is the guard. ----
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
      if (shortfall <= 0) {
        return res.status(400).json({ error: 'This request is covered by their points — nothing to charge.' });
      }

      const amount = shortfall * REQUEST_COST.edit.amount; // £40/point, same rate either kind
      const stripe = new Stripe(STRIPE_SECRET_KEY);

      let pi;
      try {
        pi = await chargeCardForRequest(stripe, profile, reqRow, amount);
      } catch (err) {
        if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
        throw err;
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
