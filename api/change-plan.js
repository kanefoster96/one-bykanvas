/* Moving between plans on a subscription that already exists.
 *
 * This is deliberately NOT /api/checkout. Checkout creates a subscription;
 * running it against a customer who already has one charges the new plan in
 * full and leaves them paying for both. Changing the plan means changing the
 * subscription that is already there.
 *
 * Which way they are moving decides what happens, because the two directions
 * are not symmetrical:
 *
 *   Upgrading   - they want more now, so it takes effect now. Stripe credits
 *                 the unused part of what they have already paid and invoices
 *                 the difference straight away.
 *   Downgrading - they have already paid for this month at the higher rate, so
 *                 nothing is charged or refunded and they keep what they paid
 *                 for. The lower price starts at the next renewal.
 *
 * The plan and its price come from _plans.js, never from the request, so the
 * amount cannot be tampered with from the browser.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { PLANS } = require('./_plans.js');
const { changePlan } = require('./_change_plan.js');

const ORDER = ['starter', 'business', 'pro', 'max'];

/* The new price keeps the customer's existing billing interval: an annual
   subscriber moving Business -> Max stays annual, and Stripe prorates
   within the year (the unused chunk of £500 credits against £2,500 for the
   remaining months). Without this, a plan change would silently convert an
   annual customer to monthly billing. */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('change-plan: missing environment variables:',
      missingEnv(['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                  'SUPABASE_PUBLISHABLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Payments are not configured yet.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const plan = String(body.plan || '').toLowerCase();
    const apply = body.action === 'apply';

    if (!Object.prototype.hasOwnProperty.call(PLANS, plan) || plan === 'pro') {
      return res.status(400).json({ error: 'Unknown plan.' });
    }

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in first.' });

    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return res.status(401).json({ error: 'Your session has expired. Log in and try again.' });
    }
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, active_plan, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    /* No live subscription means there is nothing to change - that is a first
       purchase, and checkout is the right door for it. */
    const live = profile && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing');
    if (!live || !profile.stripe_subscription_id) {
      return res.status(400).json({ error: 'There is no active plan to change yet.', needsCheckout: true });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    let out;
    try {
      out = await changePlan(stripe, admin, user.id, profile, plan, apply);
    } catch (e) {
      if (e && e.httpStatus) {
        return res.status(e.httpStatus).json(e.needsCheckout ? { error: e.message, needsCheckout: true } : { error: e.message });
      }
      throw e;
    }
    return res.status(200).json(out);
  } catch (err) {
    if (err && err.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Your card was declined, so the plan has not changed. '
             + 'Update your card and try again.'
      });
    }
    console.error('change-plan failed:', err && err.message);
    return res.status(500).json({ error: 'Could not change your plan. Please try again.' });
  }
};
