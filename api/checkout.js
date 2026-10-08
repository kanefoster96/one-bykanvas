/* Creates a Stripe Checkout Session for the signed-in customer.
 *
 * The caller sends their Supabase access token; it is verified here before
 * anything is created, so nobody can start a subscription against someone
 * else's account. The plan comes from a fixed table rather than the request,
 * so the price cannot be tampered with from the browser.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { PLANS } = require('./_plans.js');
const { openCheckout, CheckoutError } = require('./_checkout_session.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    STRIPE_SECRET_KEY,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_PUBLISHABLE_KEY
  } = process.env;

  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('checkout: missing environment variables:',
      missingEnv(['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                  'SUPABASE_PUBLISHABLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Payments are not configured yet.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const plan = String(body.plan || '').toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
      return res.status(400).json({ error: 'Unknown plan.' });
    }
    /* pro stays in PLANS so old subscriptions resolve, but it is legacy -
       nothing sells it any more, including a hand-crafted request. */
    if (plan === 'pro') {
      return res.status(400).json({ error: 'That plan is no longer sold.' });
    }

    // ---- who is asking? -------------------------------------------------
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let user = null;

    if (token) {
      const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
      const { data: userData, error: userError } = await anon.auth.getUser(token);
      if (userError || !userData || !userData.user) {
        return res.status(401).json({ error: 'Your session has expired. Log in and try again.' });
      }
      user = userData.user;
    } else {
      /* No session. With email confirmation switched on there is none until the
       * customer clicks the link in their inbox, and making them do that before
       * they can pay loses signups. So a brand-new account may pay using the id
       * signUp handed its own browser.
       *
       * That id is the proof. It is a random UUID that only the browser which
       * created the account ever sees, and this path is narrowed so it cannot be
       * used for anything else: the address must match, the account must still
       * be unconfirmed, it must have been created in the last half hour, and it
       * must not already be subscribed. Anyone with a confirmed account has a
       * session and comes through the branch above.
       */
      const pendingId = String(body.pendingUserId || '');
      const claimed = String(body.email || '').trim().toLowerCase();
      if (!/^[0-9a-f-]{36}$/i.test(pendingId) || !claimed) {
        return res.status(401).json({ error: 'Please log in first.' });
      }

      const { data: found, error: findError } = await admin.auth.admin.getUserById(pendingId);
      const candidate = found && found.user;
      if (findError || !candidate) {
        return res.status(401).json({ error: 'Please log in first.' });
      }
      if (String(candidate.email || '').toLowerCase() !== claimed) {
        return res.status(401).json({ error: 'Please log in first.' });
      }
      if (candidate.email_confirmed_at) {
        // Confirmed accounts have a session; this path is not for them.
        return res.status(401).json({ error: 'Log in and try again.' });
      }
      const ageMs = Date.now() - new Date(candidate.created_at).getTime();
      if (!(ageMs >= 0 && ageMs < 30 * 60 * 1000)) {
        return res.status(401).json({ error: 'That took too long. Log in and try again.' });
      }
      const { data: already } = await admin
        .from('profiles').select('subscription_status').eq('id', pendingId).maybeSingle();
      if (already && (already.subscription_status === 'active' || already.subscription_status === 'trialing')) {
        return res.status(400).json({ error: 'There is already a plan on this account.' });
      }
      user = candidate;
    }
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, business_name, subscription_status, referred_by, partner_id')
      .eq('id', user.id)
      .maybeSingle();

    /* The signed-in path needs the same guard the unconfirmed path has: a
       second checkout on an already-subscribed account would create a second
       subscription billing alongside the first. Plan changes go through
       change-plan.js, which swaps the price on the existing subscription. */
    if (profile && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing')) {
      return res.status(400).json({ error: 'There is already a plan on this account. You can change plan from your account page.' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    /* ourSiteUrl() falls back to the custom domain, so only reach for the
       request's own host when SITE_URL is genuinely unset. */
    const origin = process.env.SITE_URL
      ? ourSiteUrl()
      : (req.headers.origin || `https://${req.headers.host}`);

    const session = await openCheckout({
      stripe, admin, user, profile, plan, origin,
      billing: body.billing, offer: body.offer, referralCode: body.referralCode
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err instanceof CheckoutError) return res.status(err.status).json({ error: err.message });
    console.error('checkout failed:', err && err.message);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
