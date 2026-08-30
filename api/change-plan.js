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

const ORDER = ['business', 'pro', 'max'];

function priceDataFor(plan) {
  return {
    currency: 'gbp',
    unit_amount: PLANS[plan].amount,
    recurring: { interval: 'month' },
    product_data: { name: PLANS[plan].label }
  };
}

/* What Stripe would bill right now for the change, in pence. Best effort:
   the SDK has renamed this call across versions and it is a nicety rather
   than something to fail the change over, so an error just means the page
   describes the change without an exact figure. */
async function previewAmount(stripe, sub, item, plan) {
  const args = {
    customer: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscription: sub.id,
    subscription_details: {
      items: [{ id: item.id, price_data: priceDataFor(plan), quantity: 1 }],
      proration_behavior: 'always_invoice'
    }
  };
  try {
    if (stripe.invoices.createPreview) {
      const inv = await stripe.invoices.createPreview(args);
      return inv.amount_due;
    }
    const inv = await stripe.invoices.retrieveUpcoming(args);
    return inv.amount_due;
  } catch (err) {
    console.error('change-plan: preview unavailable:', err && err.message);
    return null;
  }
}

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

    if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
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

    const current = profile.active_plan;
    if (current === plan) {
      return res.status(400).json({ error: 'That is already your plan.' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const item = sub.items && sub.items.data && sub.items.data[0];
    if (!item) {
      console.error('change-plan: subscription has no items:', sub.id);
      return res.status(500).json({ error: 'Could not read your subscription. Please get in touch.' });
    }

    /* Compare on price, not on the order of the list: the list is for display
       and the money is what the two behaviours actually differ on. */
    const currentAmount = PLANS[current] ? PLANS[current].amount : (item.price && item.price.unit_amount) || 0;
    const upgrading = PLANS[plan].amount > currentAmount;
    const renewsAt = sub.current_period_end;

    if (!apply) {
      return res.status(200).json({
        ok: true,
        preview: true,
        upgrading,
        from: current,
        to: plan,
        renewsAt,
        dueNow: upgrading ? await previewAmount(stripe, sub, item, plan) : 0
      });
    }

    const items = [{ id: item.id, price_data: priceDataFor(plan), quantity: 1 }];
    const metadata = Object.assign({}, sub.metadata, { plan, supabase_user_id: user.id });

    if (upgrading) {
      /* always_invoice bills the difference now rather than rolling it into
         the next renewal, so the extra points they are buying are paid for
         before they can be spent. error_if_incomplete makes a declined card
         fail here, loudly, instead of leaving a half-changed subscription. */
      delete metadata.plan_effective_at;
      await stripe.subscriptions.update(sub.id, {
        items,
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
        metadata
      });
    } else {
      /* No proration either way: they keep the plan they have paid for until
         the period they paid for runs out. plan_effective_at is what tells the
         webhook to hold their current allowance until then - without it the
         allowance would drop the moment they clicked. */
      metadata.plan_effective_at = String(renewsAt);
      await stripe.subscriptions.update(sub.id, {
        items,
        proration_behavior: 'none',
        metadata
      });
    }

    console.log('change-plan: %s %s -> %s (%s)', user.id, current, plan,
      upgrading ? 'upgraded now' : 'from next renewal');

    return res.status(200).json({ ok: true, upgrading, from: current, to: plan, renewsAt });
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
