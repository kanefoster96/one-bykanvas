/* Changing a customer's plan on Stripe: the customer's own account page
 * (api/change-plan.js) and the MCP membership_change_plan tool both come
 * here, so a plan change means the same thing from either side.
 *
 * Upgrades bill the difference now and reset the points window; downgrades
 * wait for the renewal. Errors that should be shown rather than logged
 * carry .httpStatus. */
const { PLANS } = require('./_plans.js');

function fail(status, message) { const e = new Error(message); e.httpStatus = status; return e; }

function priceDataFor(plan, interval) {
  const annual = interval === 'year' && Number.isFinite(PLANS[plan].yearly);
  return {
    currency: 'gbp',
    unit_amount: annual ? PLANS[plan].yearly : PLANS[plan].amount,
    recurring: { interval: annual ? 'year' : 'month' },
    product_data: { name: PLANS[plan].label + (annual ? ' — Annual (2 months free)' : '') }
  };
}

function intervalOf(item) {
  return (item && item.price && item.price.recurring && item.price.recurring.interval) || 'month';
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
      items: [{ id: item.id, price_data: priceDataFor(plan, intervalOf(item)), quantity: 1 }],
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
   apply=false previews; apply=true changes it. */
async function changePlan(stripe, admin, userId, profile, plan, apply) {
  const live = profile && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing');
  if (!live || !profile.stripe_subscription_id) {
    const e = fail(400, 'There is no active plan to change yet.'); e.needsCheckout = true; throw e;
  }
  const current = profile.active_plan;
  if (current === plan) {
    throw fail(400, 'That is already your plan.');
  }

  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const item = sub.items && sub.items.data && sub.items.data[0];
  if (!item) {
    console.error('change-plan: subscription has no items:', sub.id);
    throw fail(500, 'Could not read your subscription. Please get in touch.');
  }

  /* Compare on price, not on the order of the list: the list is for display
     and the money is what the two behaviours actually differ on. */
  const currentAmount = PLANS[current] ? PLANS[current].amount : (item.price && item.price.unit_amount) || 0;
  const upgrading = PLANS[plan].amount > currentAmount;
  /* Newer API versions carry the period on the item rather than the
     subscription, and an account can be pinned to either. */
  const renewsAt = sub.current_period_end
    || (item.current_period_end || null);

  if (!apply) {
    return {
      ok: true,
      preview: true,
      upgrading,
      from: current,
      to: plan,
      renewsAt,
      dueNow: upgrading ? await previewAmount(stripe, sub, item, plan) : 0
    };
  }

  const items = [{ id: item.id, price_data: priceDataFor(plan, intervalOf(item)), quantity: 1 }];
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

  console.log('change-plan: %s %s -> %s (%s)', userId, current, plan,
    upgrading ? 'upgraded now' : 'from next renewal');

  return { ok: true, upgrading, from: current, to: plan, renewsAt };
}

module.exports = { changePlan, priceDataFor, intervalOf };
