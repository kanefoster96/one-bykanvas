/* Changing a customer's plan on Stripe: the customer's own account page
 * (api/change-plan.js) and the MCP membership_change_plan tool both come
 * here, so a plan change means the same thing from either side.
 *
 * Upgrades bill the difference now and reset the points window; downgrades
 * wait for the renewal. Errors that should be shown rather than logged
 * carry .httpStatus. */
const { PLANS } = require('./_plans.js');

function fail(status, message) { const e = new Error(message); e.httpStatus = status; return e; }

/* Subscription items cannot carry product_data the way a Checkout line item
   can: Stripe requires price_data.product, the id of a Product that already
   exists. So each plan has one Product, found by metadata.kanvas_plan and
   made the first time it is needed, then remembered for the life of the
   function instance. Checkout still uses inline product_data, which is
   allowed there. */
const productCache = {};

async function productFor(stripe, plan) {
  if (productCache[plan]) return productCache[plan];
  let startingAfter;
  for (let page = 0; page < 10; page++) {
    const args = { active: true, limit: 100 };
    if (startingAfter) args.starting_after = startingAfter;
    const list = await stripe.products.list(args);
    const rows = (list && list.data) || [];
    const hit = rows.find((p) => p.metadata && p.metadata.kanvas_plan === plan);
    if (hit) { productCache[plan] = hit.id; return hit.id; }
    if (!list.has_more || !rows.length) break;
    startingAfter = rows[rows.length - 1].id;
  }
  const made = await stripe.products.create({
    name: PLANS[plan].label,
    metadata: { kanvas_plan: plan }
  });
  productCache[plan] = made.id;
  return made.id;
}

/* What the plan costs on a given interval. A plan with no yearly price
   (legacy Pro) can only be monthly. */
function priceFor(plan, interval) {
  const annual = interval === 'year' && Number.isFinite(PLANS[plan].yearly);
  return { amount: annual ? PLANS[plan].yearly : PLANS[plan].amount, interval: annual ? 'year' : 'month' };
}

async function priceDataFor(stripe, plan, interval) {
  const p = priceFor(plan, interval);
  return {
    currency: 'gbp',
    product: await productFor(stripe, plan),
    unit_amount: p.amount,
    recurring: { interval: p.interval }
  };
}

function intervalOf(item) {
  return (item && item.price && item.price.recurring && item.price.recurring.interval) || 'month';
}

/* What Stripe would bill right now for the change, in pence. Best effort:
   the SDK has renamed this call across versions and it is a nicety rather
   than something to fail the change over, so an error just means the page
   describes the change without an exact figure. */
async function previewAmount(stripe, sub, item, priceData) {
  const args = {
    customer: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscription: sub.id,
    subscription_details: {
      items: [{ id: item.id, price_data: priceData, quantity: 1 }],
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

/* profile needs stripe_subscription_id, active_plan and subscription_status.
   apply=false previews; apply=true changes it. opts.interval ('month' or
   'year') moves the billing interval too - the admin page passes it; the
   customer's own page and MCP leave it out, which keeps the interval the
   subscription already has, so an annual subscriber stays annual. */
async function changePlan(stripe, admin, userId, profile, plan, apply, opts) {
  const live = profile && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing');
  if (!live || !profile.stripe_subscription_id) {
    const e = fail(400, 'There is no active plan to change yet.'); e.needsCheckout = true; throw e;
  }
  if (!PLANS[plan] || plan === 'pro') throw fail(400, 'Unknown plan.');
  const current = profile.active_plan;

  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const item = sub.items && sub.items.data && sub.items.data[0];
  if (!item) {
    console.error('change-plan: subscription has no items:', sub.id);
    throw fail(500, 'Could not read your subscription. Please get in touch.');
  }

  const fromInterval = intervalOf(item);
  const wanted = opts && (opts.interval === 'year' || opts.interval === 'month') ? opts.interval : fromInterval;
  if (wanted === 'year' && !Number.isFinite(PLANS[plan].yearly)) throw fail(400, 'That plan has no yearly price.');
  const target = priceFor(plan, wanted);
  const intervalChanging = target.interval !== fromInterval;

  if (current === plan && !intervalChanging) {
    throw fail(400, 'That is already your plan.');
  }

  /* Compare on price, not on the order of the list: the list is for display
     and the money is what the two behaviours actually differ on. A change
     of interval always takes effect now - Stripe restarts the billing
     period when the interval changes, so it cannot wait for the renewal -
     and so it goes down the upgrade path, which bills (or credits) the
     difference straight away. */
  const currentAmount = PLANS[current] ? PLANS[current].amount : (item.price && item.price.unit_amount) || 0;
  const upgrading = intervalChanging || PLANS[plan].amount > currentAmount;
  /* Newer API versions carry the period on the item rather than the
     subscription, and an account can be pinned to either. */
  const renewsAt = sub.current_period_end
    || (item.current_period_end || null);

  const priceData = await priceDataFor(stripe, plan, target.interval);

  if (!apply) {
    return {
      ok: true,
      preview: true,
      upgrading,
      from: current,
      to: plan,
      fromInterval,
      interval: target.interval,
      amount: target.amount,
      renewsAt,
      dueNow: upgrading ? await previewAmount(stripe, sub, item, priceData) : 0
    };
  }

  const items = [{ id: item.id, price_data: priceData, quantity: 1 }];
  const metadata = Object.assign({}, sub.metadata, { plan, supabase_user_id: userId });

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

    /* An upgrade is a fresh payment for a bigger allowance, so the allowance
       starts over: someone who has spent their single Business point and
       then pays for Pro gets three, not two. Stamped only after the charge
       has gone through, so a declined card cannot hand out free points.
       The webhook never moves this backwards, so it stands until the next
       renewal overtakes it. */
    const { error: stampErr } = await admin
      .from('profiles')
      .update({ points_reset_at: new Date().toISOString() })
      .eq('id', userId);
    if (stampErr) console.error('change-plan: points not reset:', stampErr.message);
  } else {
    /* No proration either way: they keep the plan they have paid for until
       the period they paid for runs out. plan_effective_at is what tells the
       webhook to hold their current allowance until then - without it the
       allowance would drop the moment they clicked. String(null) would
       store the word "null" and parse to NaN in the webhook, so when the
       renewal date could not be read the marker is left off entirely and
       the new plan simply applies at once - the safe direction, since a
       downgrade applying early only ever gives away less, never charges. */
    if (renewsAt != null) metadata.plan_effective_at = String(renewsAt);
    else delete metadata.plan_effective_at;
    await stripe.subscriptions.update(sub.id, {
      items,
      proration_behavior: 'none',
      metadata
    });
  }

  console.log('change-plan: %s %s/%s -> %s/%s (%s)', userId, current, fromInterval, plan, target.interval,
    upgrading ? 'now' : 'from next renewal');

  return { ok: true, upgrading, from: current, to: plan, fromInterval, interval: target.interval, amount: target.amount, renewsAt };
}

module.exports = { changePlan, priceDataFor, priceFor, productFor, intervalOf, _productCache: productCache };
