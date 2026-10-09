/* Starter, paid first: the account comes after the money.
 *
 * The join page asks for the business name, an email, one of three free
 * web addresses and (optionally) a link to where the business already is
 * online and up to three screenshots of it - then sends them to Stripe for £9.99 a month or £99 a year. Only
 * once that is paid do they choose a password. Business and Max still go
 * through the get-started wizard, which makes the account first.
 *
 * Four actions, one endpoint:
 *
 *   lead     the business name and email have been given (step one): tells
 *            Meta, server side, under the event id the browser used, so the
 *            ads can learn who signs up. Nothing is stored.
 *   start    makes (or reuses) a password-less account for the email, writes
 *            what they told us onto the profile, and opens Stripe Checkout.
 *            The account is created by us, unconfirmed, with
 *            app_metadata.needs_password set; it cannot be logged into.
 *   status   given the Checkout Session id Stripe hands back on success,
 *            says whether it is paid and what we have, for the page that
 *            asks for the password.
 *   account  given that same paid session id, sets the password and marks
 *            the email confirmed, once. The session id is the proof: it is
 *            only ever in the payer's own browser (Stripe's redirect) and in
 *            the welcome email sent to the address they paid with.
 *
 * Narrow on purpose. An email that already has a real account is told to
 * log in rather than having anything done to it; only an account this flow
 * made, never paid for, is reused, so a second attempt after a cancelled
 * checkout just carries on.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { openCheckout, CheckoutError } = require('./_checkout_session.js');
const { isValidDomain, lookup } = require('./domains.js');
const { sendMetaEvent } = require('./_meta.js');

const LIVE = ['active', 'trialing', 'past_due', 'unpaid'];
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SHOT = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_SHOTS = 3, MAX_SHOT_BYTES = 1.5 * 1024 * 1024;

/* The screenshots from the join page: JPEGs the browser has already
   shrunk, as data URLs. Bytes, or null if any is not one. */
function shotsFrom(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX_SHOTS) return null;
  const out = [];
  for (const item of list) {
    const m = SHOT.exec(String(item || ''));
    if (!m) return null;
    const buf = Buffer.from(m[1], 'base64');
    if (!buf.length || buf.length > MAX_SHOT_BYTES || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    out.push(buf);
  }
  return out;
}


function clean(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

/* No lookup-by-email in the admin API; the list is small enough to scan
   (the same approach as signup-reset.js). */
async function findUser(admin, email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = (data && data.users) || [];
    const found = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('join: missing environment variables:',
      missingEnv(['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Payments are not configured yet.' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Bad request.' });
  }
  const action = String(body.action || '');

  try {
    if (action === 'lead') return await lead();
    if (action === 'start') return await start();
    if (action === 'status' || action === 'account') return await afterPayment(action);
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    if (err instanceof CheckoutError) return res.status(err.status).json({ error: err.message });
    console.error('join %s failed:', action, err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  // ---- lead: step one done, for Meta ------------------------------------
  async function lead() {
    const email = clean(body.email, 254).toLowerCase();
    const eventId = clean(body.eventId, 80);
    if (!EMAIL.test(email) || !/^[A-Za-z0-9_-]{8,80}$/.test(eventId)) return res.status(400).json({ error: 'Bad request.' });
    const fbc = /^fb\.1\.\d{10,14}\.[A-Za-z0-9_-]{10,500}$/.test(String(body.fbc || '')) ? String(body.fbc) : undefined;
    const fbp = /^fb\.1\.\d{10,14}\.\d{5,25}$/.test(String(body.fbp || '')) ? String(body.fbp) : undefined;
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    await sendMetaEvent({
      name: 'Lead', eventId, email, fbc, fbp,
      url: `${ourSiteUrl()}/join`,
      ip: fwd || undefined, userAgent: req.headers['user-agent'] || undefined,
      custom: { content_category: 'join' }
    }).catch(() => {});
    return res.status(204).end();
  }

  // ---- start: the details, then Stripe ---------------------------------
  async function start() {
    // The same honeypot the other forms use: a person never fills it in.
    if (clean(body.website, 200)) return res.status(400).json({ error: 'Something went wrong. Please try again.' });

    const business = clean(body.business, 120);
    const email = clean(body.email, 254).toLowerCase();
    const domain = clean(body.domain, 253).toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const link = clean(body.link, 400);
    const billing = String(body.billing || '') === 'annual' ? 'annual' : 'monthly';

    if (business.length < 2) return res.status(400).json({ error: 'Add your business name.', field: 'business' });
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'That email does not look right.', field: 'email' });
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Pick a web address.', field: 'domain' });
    const shots = shotsFrom(body.shots);
    if (!shots) return res.status(400).json({ error: 'One of those screenshots could not be sent. Remove it and add it again.', field: 'shots' });

    /* Free a minute ago is not free now. Taken is a clear no; a registry
       that does not answer is not a reason to lose the sale - we register
       it by hand and sort it with them if it has gone. */
    if (await lookup(domain) === 'taken') {
      return res.status(409).json({ error: domain + ' has just been taken. Pick another.', field: 'domain', code: 'domain_taken' });
    }

    // ---- who is this? ---------------------------------------------------
    let user = await findUser(admin, email);
    if (user) {
      const am = user.app_metadata || {};
      const { data: had } = await admin
        .from('profiles').select('subscription_status').eq('id', user.id).maybeSingle();
      const paid = had && LIVE.includes(had.subscription_status);
      if (am.needs_password && paid) {
        return res.status(409).json({ code: 'paid',
          error: "You've already joined with that email. Check your inbox for the link to make your account." });
      }
      if (!am.needs_password || paid) {
        return res.status(409).json({ code: 'exists',
          error: 'You already have an account with that email. Log in to carry on.' });
      }
      // Ours, never paid for: a second go after a cancelled checkout.
    } else {
      const { data: made, error: makeErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { business_name: business },
        app_metadata: { joined_via: 'join', needs_password: true }
      });
      if (makeErr || !made || !made.user) throw new Error((makeErr && makeErr.message) || 'createUser returned nothing');
      user = made.user;
    }

    /* The screenshots, into their photos folder, as public links on the
       profile beside the link: the build card and the new-customer email
       both show "Already online". A failed upload never stops the payment;
       the welcome email asks for anything we are missing. */
    const shotUrls = [];
    for (let i = 0; i < shots.length; i++) {
      const path = `${user.id}/join-${Date.now()}-${i + 1}.jpg`;
      const { error: upErr } = await admin.storage.from('photos').upload(path, shots[i], { contentType: 'image/jpeg', upsert: false });
      if (upErr) { console.error('join: screenshot upload failed:', upErr.message); continue; }
      shotUrls.push(admin.storage.from('photos').getPublicUrl(path).data.publicUrl);
    }
    const online = [link, shotUrls.length ? 'Screenshots: ' + shotUrls.join(' ') : ''].filter(Boolean).join('\n');

    /* What they told us, straight onto the profile: nothing waits for a
       browser to come back and save it. */
    const row = {
      id: user.id,
      business_name: business,
      requested_domain: domain,
      domain_owned: false,
      existing_links: online || null,
      selected_plan: 'starter',
      onboarded_at: new Date().toISOString()
    };
    /* No business type from the ad they came through: an ad is not what
       they do. We ask them once their site is under way. */
    const { error: rowErr } = await admin.from('profiles').upsert(row, { onConflict: 'id' });
    if (rowErr) throw new Error(rowErr.message);

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, business_name, subscription_status, referred_by, partner_id')
      .eq('id', user.id)
      .maybeSingle();

    const origin = process.env.SITE_URL
      ? ourSiteUrl()
      : (req.headers.origin || `https://${req.headers.host}`);

    const session = await openCheckout({
      stripe, admin, user, profile, plan: 'starter', billing, origin,
      offer: body.offer, referralCode: body.referralCode,
      metadata: { source: 'join', billing },
      // Stripe fills in {CHECKOUT_SESSION_ID} itself.
      successUrl: `${origin}/join?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/join?cancelled=1`
    });

    /* The welcome email links back to the password step with this, for
       anyone who closes the tab after paying. */
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: Object.assign({}, user.app_metadata, { join_session: session.id })
    }).then(({ error }) => { if (error) console.error('join: could not stamp session:', error.message); });

    return res.status(200).json({ url: session.url });
  }

  // ---- after Stripe: status, then the password ---------------------------
  async function afterPayment(which) {
    const sessionId = String(body.session || '');
    if (!SESSION_ID.test(sessionId)) return res.status(400).json({ error: 'That link is not right.' });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      return res.status(404).json({ error: 'That link is not right.' });
    }
    const id = session && session.metadata && session.metadata.supabase_user_id;
    if (!id || session.metadata.source !== 'join') return res.status(404).json({ error: 'That link is not right.' });

    const { data: found } = await admin.auth.admin.getUserById(id);
    const user = found && found.user;
    if (!user) return res.status(404).json({ error: 'That link is not right.' });
    const am = user.app_metadata || {};
    const paid = session.status === 'complete';

    if (which === 'status') {
      const { data: p } = await admin
        .from('profiles').select('business_name, requested_domain').eq('id', id).maybeSingle();
      return res.status(200).json({
        paid,
        email: user.email,
        business: (p && p.business_name) || '',
        domain: (p && p.requested_domain) || '',
        annual: session.metadata.billing === 'annual',
        needsAccount: Boolean(am.needs_password),
        /* The id the webhook sends Meta its Purchase under, so the
           browser's copy of the same sale counts once. */
        sub: paid && typeof session.subscription === 'string' ? session.subscription : ''
      });
    }

    // account
    if (!paid) return res.status(402).json({ error: 'That payment has not gone through yet.' });
    if (!am.needs_password) {
      return res.status(409).json({ code: 'done', email: user.email,
        error: 'Your account is already made. Log in with your email and password.' });
    }
    const password = String(body.password || '');
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Use at least 8 characters.', field: 'password' });
    }
    const { error: setErr } = await admin.auth.admin.updateUserById(id, {
      password,
      email_confirm: true,
      app_metadata: Object.assign({}, am, { needs_password: false })
    });
    if (setErr) {
      /* Supabase's own password rules (length, leaked-password checks) come
         back here; their message is already written for a person. */
      console.error('join: set password failed:', setErr.message);
      return res.status(400).json({ error: setErr.message || 'Choose a different password.', field: 'password' });
    }
    return res.status(200).json({ ok: true, email: user.email });
  }
};
