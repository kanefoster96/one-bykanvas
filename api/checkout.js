/* Creates a Stripe Checkout Session for the signed-in customer.
 *
 * The caller sends their Supabase access token; it is verified here before
 * anything is created, so nobody can start a subscription against someone
 * else's account. The plan comes from a fixed table rather than the request,
 * so the price cannot be tampered with from the browser.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { PLANS } = require('./_plans.js');

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
    console.error('checkout: missing environment variables');
    return res.status(500).json({ error: 'Payments are not configured yet.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const plan = String(body.plan || '').toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
      return res.status(400).json({ error: 'Unknown plan.' });
    }

    // ---- who is asking? -------------------------------------------------
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in first.' });

    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return res.status(401).json({ error: 'Your session has expired. Log in and try again.' });
    }
    const user = userData.user;

    // ---- reuse the Stripe customer if we already made one ---------------
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, business_name')
      .eq('id', user.id)
      .maybeSingle();

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    let customerId = profile && profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: (profile && profile.business_name) || undefined,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      await admin.from('profiles')
        .upsert({ id: user.id, stripe_customer_id: customerId }, { onConflict: 'id' });
    }

    // ---- the session ----------------------------------------------------
    const origin = process.env.SITE_URL
      || (req.headers.origin || `https://${req.headers.host}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: PLANS[plan].amount,
          recurring: { interval: 'month' },
          product_data: { name: PLANS[plan].label }
        }
      }],
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      metadata: { supabase_user_id: user.id, plan },
      success_url: `${origin}/account.html?checkout=success`,
      cancel_url: `${origin}/account.html?checkout=cancelled`,
      allow_promotion_codes: true
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout failed:', err && err.message);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
