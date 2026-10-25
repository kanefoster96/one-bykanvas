/* Kanvas One's own money: what the admin app's Money tab, the monthly
 * numbers email and the dispute tools are built from.
 *
 *   Charges        every Stripe charge on a customer, kept in
 *                  billing_charges (plan payments for Starter, Business and
 *                  One, monthly or annual, and one-off request charges).
 *                  recordInvoice / recordCharge write one; reconcileCharges
 *                  catches up from Stripe's list (and, the first time,
 *                  fills in the whole history).
 *   Subscriptions  liveSubscriptions reads every subscription that has not
 *                  ended from Stripe and works out what each brings in a
 *                  month, at the price it will next charge.
 *   Overview       money in this month and last, fees, refunds, failures,
 *                  the recent payments list, and the care queue.
 *   Cancellations  noteCancellation keeps one row per subscription: why it
 *                  was set to end, by whom, and when it ended.
 *   Disputes       recordDispute mirrors a bank dispute; draftEvidence
 *                  writes the evidence from what we hold; submitEvidence
 *                  sends it to Stripe once the admin has read it.
 *   Metrics        churn, lifetime, lifetime value, cost per customer and
 *                  the three things to look at first.
 *   Monthly        the numbers email for the month just ended.
 *
 * Every Stripe call here goes through the SDK, so the shapes are the SDK's
 * pinned API version whatever version the webhook endpoint sends events in:
 * the webhook passes ids and this re-reads. Money is in pence throughout.
 */
const { PLANS } = require('./_plans.js');

const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 14;
const PLAN_WORD = { starter: 'Starter', business: 'Business', pro: 'Pro', max: 'One' };

function idOf(x) { return typeof x === 'string' ? x : (x && x.id) || null; }
function iso(unix) { return unix ? new Date(unix * 1000).toISOString() : null; }
function money(pence) {
  const n = Number(pence || 0) / 100;
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
/* The first moment of a month, in UK time, as a Date. offset 0 is this
   month, -1 last month. */
function monthStart(offset, from) {
  const now = from ? new Date(from) : new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(now);
  let y = Number(parts.find((p) => p.type === 'year').value);
  let m = Number(parts.find((p) => p.type === 'month').value) - 1 + (offset || 0);
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  /* Midnight in London: UTC midnight, less an hour in summer time. */
  const guess = new Date(Date.UTC(y, m, 1));
  const londonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(guess));
  return new Date(guess.getTime() - londonHour * 60 * 60 * 1000);
}
/* YYYY-MM of the UK month a month start belongs to (a day in, so the hour
   either side of midnight in summer time cannot tip it into the month
   before). The ad_spend rows are keyed the same way. */
function monthKey(start) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(new Date(start.getTime() + DAY));
  return parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value;
}
function monthLabel(d) { return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' }); }

/* ------------------------------------------------------------ profiles */

/* Every customer by Stripe customer id, and by id. Small enough to read in
   one go; paged past 1,000 anyway. */
async function profileIndex(db) {
  const byCustomer = new Map(), byId = new Map();
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await db.from('profiles')
      .select('id, business_name, contact_name, stripe_customer_id, stripe_subscription_id, active_plan, subscription_status, subscribed_at, canceled_at, current_period_end, site_url, site_status, created_at')
      .order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((p) => { byId.set(p.id, p); if (p.stripe_customer_id) byCustomer.set(p.stripe_customer_id, p); });
    if (!data || data.length < 1000) break;
  }
  return { byCustomer, byId };
}
function nameOf(p) { return (p && (p.business_name || p.contact_name)) || 'A customer'; }

/* When a customer started paying. subscribed_at is stamped by the webhook
   the first time a plan goes live; customers from before that column have
   none, so their sign-up date stands in if they are (or were) on a plan.
   Everyone else never paid and is not a customer for these numbers. */
function startOf(p) {
  if (p.subscribed_at) return p.subscribed_at;
  const was = p.canceled_at || p.active_plan || ['active', 'trialing', 'past_due', 'unpaid'].includes(p.subscription_status);
  return was ? p.created_at || null : null;
}
function customersOf(profiles) {
  return Array.from(profiles.byId.values()).map((p) => Object.assign({}, p, { started: startOf(p) })).filter((p) => p.started);
}

/* ------------------------------------------------------------- charges */

function chargeStatus(charge) {
  if (charge.status === 'failed') return 'failed';
  if (charge.status === 'pending') return 'pending';
  const refunded = charge.amount_refunded || 0;
  if (refunded >= charge.amount && charge.amount > 0) return 'refunded';
  if (refunded > 0) return 'partly_refunded';
  return 'paid';
}

/* One billing_charges row from a charge with its invoice and balance
   transaction expanded (either may be an id instead; then those columns
   are just left empty). */
function chargeRow(charge, profiles) {
  const inv = charge.invoice && typeof charge.invoice === 'object' ? charge.invoice : null;
  const bt = charge.balance_transaction && typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
  const customerId = idOf(charge.customer);
  const p = customerId && profiles ? profiles.byCustomer.get(customerId) : null;
  const line = inv && inv.lines && inv.lines.data && inv.lines.data[0];
  const price = line && (line.price || line.plan);
  const recurring = price && (price.recurring || (price.interval ? { interval: price.interval } : null));
  const meta = (inv && inv.subscription_details && inv.subscription_details.metadata) || {};
  return {
    charge_id: charge.id,
    invoice_id: inv ? inv.id : idOf(charge.invoice),
    payment_intent_id: idOf(charge.payment_intent),
    user_id: p ? p.id : (charge.metadata && /^[0-9a-f-]{36}$/i.test(charge.metadata.supabase_user_id || '') ? charge.metadata.supabase_user_id : null),
    stripe_customer_id: customerId,
    subscription_id: inv ? idOf(inv.subscription) || idOf(inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) : null,
    plan: meta.plan || (charge.metadata && charge.metadata.plan) || (p && p.active_plan) || null,
    kind: inv || charge.invoice ? 'plan' : 'extra',
    billing_reason: inv ? inv.billing_reason || null : null,
    interval: recurring ? recurring.interval || null : null,
    status: chargeStatus(charge),
    amount: charge.amount || 0,
    refunded: charge.amount_refunded || 0,
    fee: bt && typeof bt.fee === 'number' ? bt.fee : null,
    currency: charge.currency || 'gbp',
    failure_message: charge.status === 'failed' ? (charge.failure_message || charge.outcome && charge.outcome.seller_message || null) : null,
    disputed: Boolean(charge.disputed),
    charged_at: iso(charge.created) || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function upsertRows(db, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('billing_charges').upsert(rows.slice(i, i + 200), { onConflict: 'charge_id' });
    if (error) throw new Error('billing_charges: ' + error.message);
  }
}

/* A user id stays on a row once known: a customer later deleted from
   profiles leaves the charge, unlinked, rather than losing it. */
async function recordCharge(stripe, db, chargeId, profiles) {
  if (!/^ch_/.test(String(chargeId || ''))) return null;
  let charge;
  try { charge = await stripe.charges.retrieve(chargeId, { expand: ['invoice', 'balance_transaction'] }); }
  catch (e) { charge = await stripe.charges.retrieve(chargeId); }
  const row = chargeRow(charge, profiles || await profileIndex(db));
  await upsertRows(db, [row]);
  return row;
}

/* An invoice's charge: the payment if it was paid, the latest attempt if
   it failed. A £0 invoice (a 100% discount) has no charge and no row. */
async function recordInvoice(stripe, db, invoiceId, profiles) {
  if (!/^in_/.test(String(invoiceId || ''))) return null;
  const inv = await stripe.invoices.retrieve(invoiceId);
  let chargeId = idOf(inv.charge);
  if (!chargeId && inv.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(idOf(inv.payment_intent));
      chargeId = idOf(pi.latest_charge);
    } catch (e) { chargeId = null; }
  }
  return chargeId ? recordCharge(stripe, db, chargeId, profiles) : null;
}

/* Catches up from Stripe's own list: anything the webhook missed, refunds
   made in the Stripe dashboard, and fees that were not known yet. The
   first run (an empty table) reads the whole history. */
async function reconcileCharges(stripe, db, opts) {
  const { count } = await db.from('billing_charges').select('charge_id', { count: 'exact', head: true });
  const since = count ? Math.floor((Date.now() - ((opts && opts.days) || 40) * DAY) / 1000) : 0;
  const profiles = await profileIndex(db);
  let startingAfter, seen = 0;
  for (let page = 0; page < 60; page++) {
    const args = { limit: 100, expand: ['data.invoice', 'data.balance_transaction'] };
    if (since) args.created = { gte: since };
    if (startingAfter) args.starting_after = startingAfter;
    const list = await stripe.charges.list(args);
    const rows = (list.data || []).map((c) => chargeRow(c, profiles));
    await upsertRows(db, rows);
    seen += rows.length;
    if (!list.has_more || !list.data.length) break;
    startingAfter = list.data[list.data.length - 1].id;
  }
  return { seen, backfill: !count };
}

/* ------------------------------------------------------- subscriptions */

/* What one subscription brings in a month, at the price it will next
   charge: every item, normalised to a month (a year is a twelfth), less a
   discount still running at the next renewal. */
function monthlyOf(sub) {
  const items = (sub.items && sub.items.data) || [];
  let perInvoice = 0, months = 1;
  items.forEach((item) => {
    const price = item.price || item.plan || {};
    const unit = typeof price.unit_amount === 'number' ? price.unit_amount : (price.amount || 0);
    perInvoice += unit * (item.quantity || 1);
    const rec = price.recurring || (price.interval ? { interval: price.interval, interval_count: price.interval_count } : {});
    const n = rec.interval_count || 1;
    months = rec.interval === 'year' ? 12 * n : rec.interval === 'week' ? n * 12 / 52 : rec.interval === 'day' ? n * 12 / 365 : n;
  });
  const renews = nextRenewal(sub);
  const discounts = [];
  if (sub.discount) discounts.push(sub.discount);
  (sub.discounts || []).forEach((d) => { if (d && typeof d === 'object' && discounts.indexOf(d) === -1) discounts.push(d); });
  discounts.forEach((d) => {
    const c = d.coupon || (d.source && d.source.coupon) || {};
    if (d.end && renews && d.end * 1000 <= renews) return;
    if (c.duration === 'once') return;
    if (c.percent_off) perInvoice = Math.round(perInvoice * (1 - c.percent_off / 100));
    else if (c.amount_off) perInvoice = Math.max(0, perInvoice - c.amount_off);
  });
  return { perInvoice, monthly: Math.round(perInvoice / months), interval: months >= 12 ? 'year' : 'month' };
}

function nextRenewal(sub) {
  let end = sub.current_period_end || 0;
  ((sub.items && sub.items.data) || []).forEach((i) => { if (i.current_period_end > end) end = i.current_period_end; });
  return end ? end * 1000 : null;
}

function cardEnds(card) {
  return card && card.exp_year && card.exp_month ? Date.UTC(Number(card.exp_year), Number(card.exp_month), 1) : null;
}

/* Every subscription that has not ended, read from Stripe, with what it is
   worth and which bucket it is in: live, failing (past due, in the grace
   period), ending (set to cancel), or not counted (incomplete, paused). */
async function liveSubscriptions(stripe, profiles) {
  const out = [];
  let startingAfter;
  for (let page = 0; page < 20; page++) {
    /* The card: the subscription's own, else the customer's default
       (Checkout sets the first; a card changed in the portal can be the
       second). Four levels is as deep as Stripe expands. */
    const args = { limit: 100, expand: ['data.default_payment_method', 'data.customer.invoice_settings.default_payment_method'] };
    if (startingAfter) args.starting_after = startingAfter;
    let list;
    try { list = await stripe.subscriptions.list(args); }
    catch (e) { args.expand = ['data.default_payment_method', 'data.customer']; list = await stripe.subscriptions.list(args); }
    (list.data || []).forEach((sub) => {
      const customer = sub.customer && typeof sub.customer === 'object' ? sub.customer : null;
      const customerId = idOf(sub.customer);
      const p = profiles.byCustomer.get(customerId) || null;
      const custPm = customer && customer.invoice_settings && customer.invoice_settings.default_payment_method;
      const pm = (sub.default_payment_method && typeof sub.default_payment_method === 'object' && sub.default_payment_method)
        || (custPm && typeof custPm === 'object' && custPm) || null;
      const card = pm && pm.card;
      const value = monthlyOf(sub);
      const ending = Boolean(sub.cancel_at_period_end || sub.cancel_at);
      const bucket = ['incomplete', 'incomplete_expired', 'paused', 'canceled'].includes(sub.status) ? 'none'
        : ending ? 'ending'
        : ['past_due', 'unpaid'].includes(sub.status) ? 'failing'
        : 'live';
      const renews = nextRenewal(sub);
      out.push({
        id: sub.id,
        customerId,
        userId: p ? p.id : (sub.metadata && sub.metadata.supabase_user_id) || null,
        name: p ? nameOf(p) : (customer && (customer.name || customer.email)) || 'A customer',
        plan: (sub.metadata && sub.metadata.plan) || (p && p.active_plan) || null,
        status: sub.status,
        bucket,
        monthly: value.monthly,
        perInvoice: value.perInvoice,
        interval: value.interval,
        renewsAt: renews ? new Date(renews).toISOString() : null,
        endsAt: ending ? iso(sub.cancel_at) || (renews ? new Date(renews).toISOString() : null) : null,
        latestInvoice: idOf(sub.latest_invoice),
        card: card ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year } : null,
        cardExpiresBeforeRenewal: Boolean(card && renews && cardEnds(card) <= renews && !ending),
        startedAt: iso(sub.start_date || sub.created)
      });
    });
    if (!list.has_more || !list.data.length) break;
    startingAfter = list.data[list.data.length - 1].id;
  }
  return out;
}

function summarise(subs) {
  const sum = (b) => subs.filter((s) => s.bucket === b).reduce((a, s) => a + s.monthly, 0);
  const count = (b) => subs.filter((s) => s.bucket === b).length;
  const byPlan = {};
  /* Income counts every plan still paying, including one set to end, until
     it actually ends; what is at risk and what is ending are shown as parts
     of it. */
  subs.filter((s) => s.bucket !== 'none').forEach((s) => {
    const k = s.plan || 'other';
    byPlan[k] = byPlan[k] || { count: 0, monthly: 0, yearly: 0 };
    byPlan[k].count++; byPlan[k].monthly += s.monthly;
    if (s.interval === 'year') byPlan[k].yearly++;
  });
  return {
    mrr: sum('live') + sum('failing') + sum('ending'),
    atRisk: sum('failing'), failing: count('failing'),
    ending: sum('ending'), endingCount: count('ending'),
    paying: count('live') + count('failing') + count('ending'),
    byPlan
  };
}

/* ------------------------------------------------------------ overview */

function collectedOf(rows) {
  const ok = rows.filter((r) => r.status !== 'failed' && r.status !== 'pending');
  const gross = ok.reduce((a, r) => a + r.amount, 0);
  const refunds = ok.reduce((a, r) => a + (r.refunded || 0), 0);
  const fees = ok.reduce((a, r) => a + (r.fee || 0), 0);
  const plan = ok.filter((r) => r.kind === 'plan').reduce((a, r) => a + r.amount - (r.refunded || 0), 0);
  const extras = ok.filter((r) => r.kind === 'extra').reduce((a, r) => a + r.amount - (r.refunded || 0), 0);
  /* A failed invoice counts once however many retries it took, and not at
     all once a later attempt paid it. */
  const paidInvoices = new Set(ok.map((r) => r.invoice_id).filter(Boolean));
  const failedInvoices = new Set(rows.filter((r) => r.status === 'failed' && r.invoice_id && !paidInvoices.has(r.invoice_id)).map((r) => r.invoice_id));
  return { gross, refunds, fees, net: gross - refunds - fees, plan, extras, payments: ok.length, failed: failedInvoices.size };
}

async function chargesBetween(db, from, to) {
  const { data, error } = await db.from('billing_charges').select('*')
    .gte('charged_at', from.toISOString()).lt('charged_at', to.toISOString())
    .order('charged_at', { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  return data || [];
}

async function overview(stripe, db) {
  const profiles = await profileIndex(db);
  const subs = stripe ? await liveSubscriptions(stripe, profiles) : [];
  const now = new Date();
  const thisMonth = monthStart(0), lastMonth = monthStart(-1);
  const [rowsThis, rowsLast] = await Promise.all([chargesBetween(db, thisMonth, now), chargesBetween(db, lastMonth, thisMonth)]);

  const { data: recent } = await db.from('billing_charges').select('*').order('charged_at', { ascending: false }).limit(30);
  const { data: disputes } = await db.from('billing_disputes').select('*').order('opened_at', { ascending: false }).limit(50);
  const { data: cancels } = await db.from('billing_cancellations').select('*').order('updated_at', { ascending: false }).limit(200);

  const withName = (r) => Object.assign({}, r, { name: nameOf(profiles.byId.get(r.user_id) || profiles.byCustomer.get(r.stripe_customer_id)) });
  const cancelBySub = new Map((cancels || []).map((c) => [c.subscription_id, c]));

  /* When the current failure started: the first failed attempt on the
     subscription's open invoice. */
  const failing = subs.filter((s) => s.bucket === 'failing');
  const invIds = failing.map((s) => s.latestInvoice).filter(Boolean);
  const firstFail = new Map();
  if (invIds.length) {
    const { data: fails } = await db.from('billing_charges').select('invoice_id, charged_at, failure_message')
      .in('invoice_id', invIds).eq('status', 'failed').order('charged_at', { ascending: true });
    (fails || []).forEach((f) => { if (!firstFail.has(f.invoice_id)) firstFail.set(f.invoice_id, f); });
  }

  const care = [];
  failing.forEach((s) => {
    const f = firstFail.get(s.latestInvoice);
    const since = f ? new Date(f.charged_at).getTime() : null;
    const left = since ? Math.max(0, GRACE_DAYS - Math.floor((Date.now() - since) / DAY)) : null;
    care.push({ kind: 'failing', userId: s.userId, name: s.name, plan: s.plan, monthly: s.monthly,
      detail: f && f.failure_message ? f.failure_message : 'Card payment failed', since: f ? f.charged_at : null, graceDaysLeft: left });
  });
  subs.filter((s) => s.bucket === 'ending').forEach((s) => {
    const c = cancelBySub.get(s.id);
    care.push({ kind: 'ending', userId: s.userId, name: s.name, plan: s.plan, monthly: s.monthly, endsAt: s.endsAt,
      reason: c ? c.reason : null, note: c ? c.note : null, source: c ? c.source : null });
  });
  subs.filter((s) => s.cardExpiresBeforeRenewal && s.bucket === 'live').forEach((s) => {
    care.push({ kind: 'card', userId: s.userId, name: s.name, plan: s.plan, monthly: s.monthly, renewsAt: s.renewsAt, card: s.card });
  });
  (disputes || []).filter((d) => !d.closed_at).forEach((d) => {
    care.push({ kind: 'dispute', userId: d.user_id, name: nameOf(profiles.byId.get(d.user_id)), disputeId: d.dispute_id,
      amount: d.amount, reason: d.reason, status: d.status, dueBy: d.evidence_due_by, submitted: Boolean(d.submitted_at) });
  });
  const monthAgo = Date.now() - 30 * DAY;
  (cancels || []).filter((c) => c.ended_at && new Date(c.ended_at).getTime() > monthAgo).forEach((c) => {
    care.push({ kind: 'ended', userId: c.user_id, name: nameOf(profiles.byId.get(c.user_id)), plan: c.plan,
      endedAt: c.ended_at, reason: c.reason, note: c.note, source: c.source });
  });

  return {
    ok: true,
    stripe: Boolean(stripe),
    summary: summarise(subs),
    thisMonth: Object.assign({ label: monthLabel(thisMonth) }, collectedOf(rowsThis)),
    lastMonth: Object.assign({ label: monthLabel(lastMonth) }, collectedOf(rowsLast)),
    recent: (recent || []).map(withName),
    care,
    disputes: (disputes || []).map(withName),
    subscriptions: subs.filter((s) => s.bucket !== 'none')
  };
}

/* ------------------------------------------------------- cancellations */

/* Why someone left. The key is ours; feedback is the word Stripe keeps on
   the subscription (and what its portal asks), so either side reads it. */
const CANCEL_REASONS = {
  too_expensive:    { label: 'Too expensive', feedback: 'too_expensive' },
  not_enough_value: { label: 'Not getting enough value', feedback: 'low_quality' },
  not_using:        { label: 'Not using it', feedback: 'unused' },
  missing_feature:  { label: 'Missing something they need', feedback: 'missing_features' },
  switched:         { label: 'Moved to another provider', feedback: 'switched_service' },
  service:          { label: 'Unhappy with our service', feedback: 'customer_service' },
  closing:          { label: 'Closing or pausing the business', feedback: 'other' },
  other:            { label: 'Something else', feedback: 'other' },
  payment_failed:   { label: 'Payment failed for 14 days', feedback: null },
  dispute:          { label: 'Disputed a payment', feedback: null }
};
const FEEDBACK_TO_REASON = {
  too_expensive: 'too_expensive', low_quality: 'not_enough_value', unused: 'not_using',
  missing_features: 'missing_feature', switched_service: 'switched', customer_service: 'service',
  too_complex: 'not_enough_value', other: 'other'
};
function cleanReason(r) { return Object.prototype.hasOwnProperty.call(CANCEL_REASONS, r) ? r : null; }
function reasonLabel(r) { return (CANCEL_REASONS[r] && CANCEL_REASONS[r].label) || 'Not given'; }

/* One row per subscription. kind: scheduled (set to end), undone (set to
   carry on again), immediate (ended today by us), ended (Stripe says it
   has ended). A reason already on the row is kept unless a new one is
   given, so "ended" inherits the reason picked when it was set to end. */
async function noteCancellation(db, { subscriptionId, userId, plan, kind, reason, note, source, byEmail, endsAt }) {
  if (!subscriptionId) return null;
  const { data: had } = await db.from('billing_cancellations').select('*').eq('subscription_id', subscriptionId).maybeSingle();
  const now = new Date().toISOString();
  const row = Object.assign({}, had || {}, { subscription_id: subscriptionId, updated_at: now });
  if (userId) row.user_id = userId;
  if (plan) row.plan = plan;
  /* The end inherits the reason picked when it was set to end; only a
     failed payment or a dispute, which end it on their own, overrule it. */
  const why = cleanReason(reason);
  const forced = source === 'payment_failed' || source === 'dispute';
  if (why && (kind !== 'ended' || !row.reason || forced)) row.reason = why;
  if (note != null && String(note).trim()) row.note = String(note).trim().slice(0, 500);
  if (source && (kind !== 'ended' || !row.source || forced)) row.source = source;
  if (byEmail) row.by_email = byEmail;
  if (kind === 'scheduled') { row.scheduled_at = now; row.undone_at = null; if (endsAt) row.ends_at = endsAt; }
  if (kind === 'undone') { row.undone_at = now; }
  if (kind === 'immediate') { row.scheduled_at = row.scheduled_at || now; row.ends_at = now; row.undone_at = null; }
  if (kind === 'ended') { row.ended_at = row.ended_at || now; row.undone_at = null; }
  const { error } = await db.from('billing_cancellations').upsert(row, { onConflict: 'subscription_id' });
  if (error) throw new Error('billing_cancellations: ' + error.message);
  return row;
}

/* What Stripe says about why a subscription ended or is ending, as ours. */
function reasonFromStripe(sub) {
  const meta = (sub && sub.metadata) || {};
  const cd = (sub && sub.cancellation_details) || {};
  if (cleanReason(meta.cancel_reason)) return { reason: meta.cancel_reason, note: meta.cancel_note || cd.comment || null, source: 'admin' };
  if (cd.reason === 'payment_failed') return { reason: 'payment_failed', note: null, source: 'payment_failed' };
  if (cd.reason === 'payment_disputed') return { reason: 'dispute', note: null, source: 'dispute' };
  if (cd.feedback && FEEDBACK_TO_REASON[cd.feedback]) return { reason: FEEDBACK_TO_REASON[cd.feedback], note: cd.comment || null, source: 'portal' };
  return { reason: null, note: cd.comment || null, source: cd.reason === 'cancellation_requested' ? 'portal' : 'stripe' };
}

/* ------------------------------------------------------------ disputes */

async function recordDispute(stripe, db, dispute) {
  const chargeId = idOf(dispute.charge);
  let charge = null;
  if (chargeId) { try { charge = await recordCharge(stripe, db, chargeId); } catch (e) { charge = null; } }
  const closed = ['won', 'lost', 'warning_closed'].includes(dispute.status);
  const { data: had } = await db.from('billing_disputes').select('dispute_id, closed_at').eq('dispute_id', dispute.id).maybeSingle();
  const row = {
    dispute_id: dispute.id,
    charge_id: chargeId,
    invoice_id: charge ? charge.invoice_id : null,
    user_id: charge ? charge.user_id : null,
    amount: dispute.amount || 0,
    currency: dispute.currency || 'gbp',
    reason: dispute.reason || null,
    status: dispute.status || null,
    evidence_due_by: dispute.evidence_details && dispute.evidence_details.due_by ? iso(dispute.evidence_details.due_by) : null,
    opened_at: iso(dispute.created) || new Date().toISOString(),
    closed_at: closed ? ((had && had.closed_at) || new Date().toISOString()) : null,
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from('billing_disputes').upsert(row, { onConflict: 'dispute_id' });
  if (error) throw new Error('billing_disputes: ' + error.message);
  return { row, isNew: !had, justClosed: closed && !(had && had.closed_at) };
}

async function sweepDisputes(stripe, db) {
  const since = Math.floor((Date.now() - 120 * DAY) / 1000);
  const list = await stripe.disputes.list({ limit: 100, created: { gte: since } });
  const fresh = [];
  for (const d of list.data || []) {
    const out = await recordDispute(stripe, db, d);
    if (out.isNew) fresh.push(out.row);
  }
  return fresh;
}

const EVIDENCE_FIELDS = ['customer_name', 'customer_email_address', 'product_description', 'service_date',
  'access_activity_log', 'cancellation_policy_disclosure', 'cancellation_rebuttal', 'refund_policy_disclosure',
  'refund_refusal_explanation', 'uncategorized_text'];
const DISPUTE_WORDS = {
  fraudulent: 'They say they did not make this payment',
  subscription_canceled: 'They say they had cancelled',
  product_not_received: 'They say they did not receive the service',
  product_unacceptable: 'They say the service was not as described',
  duplicate: 'They say they were charged twice',
  credit_not_processed: 'They say a refund was promised and not made',
  unrecognized: 'They do not recognise the payment',
  general: 'No specific reason given'
};

/* The evidence, written from what we hold. Plain text in Stripe's text
   fields; the admin reads and edits it before anything is sent. */
async function draftEvidence(stripe, db, disputeId, site) {
  const { data: d } = await db.from('billing_disputes').select('*').eq('dispute_id', disputeId).maybeSingle();
  if (!d) throw Object.assign(new Error('No such dispute.'), { httpStatus: 404 });
  if (d.evidence) return { dispute: d, evidence: d.evidence, saved: true };
  const { data: p } = d.user_id ? await db.from('profiles').select('*').eq('id', d.user_id).maybeSingle() : { data: null };
  let user = null;
  if (d.user_id) { try { const r = await db.auth.admin.getUserById(d.user_id); user = r.data && r.data.user; } catch (e) { user = null; } }
  const { data: charges } = d.user_id
    ? await db.from('billing_charges').select('*').eq('user_id', d.user_id).order('charged_at', { ascending: true })
    : { data: [] };
  const { data: reqs } = d.user_id
    ? await db.from('requests').select('created_at, status, title').eq('user_id', d.user_id).order('created_at', { ascending: true })
    : { data: [] };
  const { data: cancel } = d.user_id
    ? await db.from('billing_cancellations').select('*').eq('user_id', d.user_id).order('updated_at', { ascending: false }).limit(1)
    : { data: [] };
  const day = (x) => x ? new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : 'unknown';
  const paid = (charges || []).filter((c) => c.status !== 'failed');
  const disputed = (charges || []).find((x) => x.charge_id === d.charge_id) || paid[paid.length - 1] || null;
  const planKey = (disputed && disputed.plan) || (p && p.active_plan) || null;
  const plan = PLAN_WORD[planKey] || null;
  const yearly = disputed && disputed.interval === 'year';
  const price = disputed && disputed.kind === 'plan' ? money(disputed.amount) + (yearly ? ' a year' : ' a month')
    : planKey && PLANS[planKey] ? money(PLANS[planKey].amount) + ' a month' : '';
  const c = cancel && cancel[0];

  const evidence = {
    customer_name: (p && (p.contact_name || p.business_name)) || '',
    customer_email_address: (user && user.email) || '',
    product_description: `${plan ? 'The ' + plan + ' plan from Kanvas One' : 'Kanvas One'}: a ${yearly ? 'yearly' : 'monthly'} subscription for a business website`
      + (planKey === 'max' ? ', branded app and advertising' : '')
      + `, built, hosted and run for the customer by Kanvas One (kanvas.one)${price ? ', at ' + price : ''}. `
      + `The customer signed up and paid on our website, where the price and our terms (${site}/terms) are shown before payment.`,
    service_date: p && startOf(p) ? day(startOf(p)) : '',
    access_activity_log: [
      user ? `Account created ${day(user.created_at)}; email confirmed ${day(user.email_confirmed_at)}; last signed in ${day(user.last_sign_in_at)}.` : '',
      p && p.site_url ? `Their website was built and is live at ${p.site_url}.` : '',
      (reqs || []).length ? `They sent us ${reqs.length} request${reqs.length === 1 ? '' : 's'} for changes through their account, the first on ${day(reqs[0].created_at)} and the latest on ${day(reqs[reqs.length - 1].created_at)}.` : ''
    ].filter(Boolean).join(' '),
    cancellation_policy_disclosure: `No contract. Customers can cancel at any time from their account, which ends the plan at the end of the period already paid for. Our terms: ${site}/terms#cancel`,
    cancellation_rebuttal: c && c.scheduled_at
      ? `The customer set their plan to end on ${day(c.scheduled_at)}${c.ends_at ? ', taking effect on ' + day(c.ends_at) : ''}. The disputed payment ${d.charge_id ? 'was taken before that took effect' : 'is for a period before that'}.`
      : 'The customer did not cancel before this payment. Their plan was active when it was charged, and cancelling is available at any time from their account.',
    refund_policy_disclosure: `Our terms (${site}/terms) are shown before payment. Payments are for a period of service already provided or under way.`,
    refund_refusal_explanation: '',
    uncategorized_text: [
      `Dispute reason given: ${DISPUTE_WORDS[d.reason] || d.reason || 'none'}.`,
      paid.length ? 'Payments from this customer: ' + paid.map((x) => `${day(x.charged_at)} ${money(x.amount)}${x.refunded ? ' (' + money(x.refunded) + ' refunded)' : ''}`).join('; ') + '.' : ''
    ].filter(Boolean).join('\n')
  };
  return { dispute: d, evidence, saved: false };
}

async function saveEvidence(db, disputeId, evidence) {
  const clean = {};
  EVIDENCE_FIELDS.forEach((k) => { if (evidence && evidence[k] != null) clean[k] = String(evidence[k]).slice(0, 18000); });
  const { error } = await db.from('billing_disputes').update({ evidence: clean, updated_at: new Date().toISOString() }).eq('dispute_id', disputeId);
  if (error) throw new Error(error.message);
  return clean;
}

async function submitEvidence(stripe, db, disputeId, evidence) {
  const clean = await saveEvidence(db, disputeId, evidence);
  const fields = {};
  Object.keys(clean).forEach((k) => { if (clean[k].trim()) fields[k] = clean[k].trim(); });
  const out = await stripe.disputes.update(disputeId, { evidence: fields, submit: true });
  await db.from('billing_disputes').update({ submitted_at: new Date().toISOString(), status: out.status || 'under_review', updated_at: new Date().toISOString() }).eq('dispute_id', disputeId);
  return { status: out.status };
}

/* ------------------------------------------------------------- metrics */

function monthsBetween(a, b) { return Math.max(0, (b - a) / (30.44 * DAY)); }

async function metrics(stripe, db) {
  const profiles = await profileIndex(db);
  const subs = stripe ? await liveSubscriptions(stripe, profiles) : [];
  const sum = summarise(subs);
  const all = customersOf(profiles);
  const now = Date.now();
  const start0 = monthStart(0).getTime(), start1 = monthStart(-1).getTime();
  const activeAt = (t) => all.filter((p) => new Date(p.started).getTime() <= t && (!p.canceled_at || new Date(p.canceled_at).getTime() > t)).length;
  const joinedIn = (a, b) => all.filter((p) => { const t = new Date(p.started).getTime(); return t >= a && t < b; }).length;
  const leftIn = (a, b) => all.filter((p) => { const t = p.canceled_at ? new Date(p.canceled_at).getTime() : 0; return t >= a && t < b; }).length;

  const active = stripe ? sum.paying : activeAt(now);
  const startLast = activeAt(start1);
  const churnLast = startLast ? leftIn(start1, start0) / startLast : null;
  const arpc = active ? Math.round(sum.mrr / active) : 0;

  /* Lifetime, in three stages as the data grows: while nobody has left,
     only a floor (how long they have stayed so far); then projected from
     the rate people leave; then measured, once 15 have left. */
  const left = all.filter((p) => p.canceled_at);
  const customerMonths = all.reduce((a, p) => a + monthsBetween(new Date(p.started).getTime(), p.canceled_at ? new Date(p.canceled_at).getTime() : now), 0);
  let stage, lifetime;
  if (!all.length) { stage = 'none'; lifetime = null; }
  else if (!left.length) { stage = 'floor'; lifetime = customerMonths / all.length; }
  else if (left.length < 15) { stage = 'projected'; lifetime = customerMonths / left.length; }
  else { stage = 'measured'; lifetime = left.reduce((a, p) => a + monthsBetween(new Date(p.started).getTime(), new Date(p.canceled_at).getTime()), 0) / left.length; }

  const { data: paidRows } = await db.from('billing_charges').select('user_id, amount, refunded, status, fee').neq('status', 'failed').neq('status', 'pending');
  const net = (paidRows || []).reduce((a, r) => a + r.amount - (r.refunded || 0), 0);
  const ltv = stage === 'floor' ? (all.length ? Math.round(net / all.length) : 0)
    : lifetime != null ? Math.round(arpc * lifetime) : null;

  /* Cost per customer over the last three full months, from what was
     typed in for ad spend. */
  const start3 = monthStart(-3).getTime();
  const { data: spend } = await db.from('ad_spend').select('month, amount').order('month', { ascending: false }).limit(24);
  const spendMap = new Map((spend || []).map((s) => [String(s.month).slice(0, 7), s.amount]));
  const spend3 = [-3, -2, -1].reduce((a, o) => a + (spendMap.get(monthKey(monthStart(o))) || 0), 0);
  const joined3 = joinedIn(start3, start0);
  const cac = spend3 && joined3 ? Math.round(spend3 / joined3) : null;
  const ltvCac = cac && ltv ? ltv / cac : null;

  /* Still here, by the month they joined. */
  const cohorts = [];
  for (let o = -11; o <= 0; o++) {
    const a = monthStart(o).getTime(), b = monthStart(o + 1).getTime();
    const group = all.filter((p) => { const t = new Date(p.started).getTime(); return t >= a && t < b; });
    if (!group.length) continue;
    cohorts.push({ month: monthLabel(new Date(a)), joined: group.length, stillHere: group.filter((p) => !p.canceled_at).length });
  }

  const { data: ended } = await db.from('billing_cancellations').select('reason, ended_at').not('ended_at', 'is', null)
    .gte('ended_at', new Date(now - 365 * DAY).toISOString());
  const reasons = {};
  (ended || []).forEach((c) => { const k = c.reason || 'unknown'; reasons[k] = (reasons[k] || 0) + 1; });

  /* Each measure against a target, then the three furthest off. */
  const board = [];
  const grade = (v, good, watch, lowerIsBetter) => v == null ? 'none'
    : lowerIsBetter ? (v <= good ? 'good' : v <= watch ? 'watch' : 'poor')
    : (v >= good ? 'good' : v >= watch ? 'watch' : 'poor');
  /* With only a handful of customers one leaving is a big percentage, so
     it is never more than "watch" until there are ten. */
  let churnGrade = grade(churnLast, 0.04, 0.07, true);
  if (churnGrade === 'poor' && startLast < 10) churnGrade = 'watch';
  board.push({ key: 'churn', label: 'Monthly churn', value: churnLast, shown: churnLast == null ? '—' : Math.round(churnLast * 1000) / 10 + '%', target: 'Under 4%', status: churnGrade,
    small: startLast < 10,
    fix: (startLast < 10 ? 'Early days: with ' + startLast + ' customer' + (startLast === 1 ? '' : 's') + ' at the start of last month, one leaving moves this a lot. ' : '')
      + 'Look at why people left (below), and message anyone in Care who is set to end before their date.' });
  const failShare = sum.mrr ? sum.atRisk / sum.mrr : null;
  board.push({ key: 'failing', label: 'Money on failing cards', value: failShare, shown: failShare == null ? '—' : Math.round(failShare * 1000) / 10 + '%', target: 'Under 2%', status: grade(failShare, 0.02, 0.05, true),
    fix: 'Message each failing customer in Care with their Update card link before the 14 days run out.' });
  const endShare = sum.mrr ? sum.ending / sum.mrr : null;
  board.push({ key: 'ending', label: 'Set to end', value: endShare, shown: endShare == null ? '—' : Math.round(endShare * 1000) / 10 + '%', target: 'Under 3%', status: grade(endShare, 0.03, 0.06, true),
    fix: 'Call the customers set to end: a change of plan often keeps them.' });
  board.push({ key: 'ltvcac', label: 'Lifetime value ÷ cost per customer', value: ltvCac, shown: ltvCac == null ? '—' : (Math.round(ltvCac * 10) / 10) + '×', target: '3× or more', status: grade(ltvCac, 3, 1.5, false),
    fix: ltvCac == null ? 'Enter last month’s ad spend below to see this.' : 'Raise the value of each customer (plan upgrades) or lower the ad cost per sign-up.' });
  const openDisputes = (await db.from('billing_disputes').select('dispute_id', { count: 'exact', head: true }).is('closed_at', null)).count || 0;
  board.push({ key: 'disputes', label: 'Open disputes', value: openDisputes, shown: String(openDisputes), target: 'None', status: openDisputes ? 'poor' : 'good',
    fix: 'Open the dispute in Care, check the drafted evidence and submit it before the deadline.' });
  const order = { poor: 0, watch: 1, good: 2, none: 3 };
  const focus = board.filter((b) => b.status === 'poor' || b.status === 'watch').sort((a, b) => order[a.status] - order[b.status]).slice(0, 3);

  return {
    ok: true,
    summary: sum,
    customers: { active, joinedThisMonth: joinedIn(start0, now), leftThisMonth: leftIn(start0, now), joinedLastMonth: joinedIn(start1, start0), leftLastMonth: leftIn(start1, start0) },
    churnLast, arpc,
    lifetime: { stage, months: lifetime == null ? null : Math.round(lifetime * 10) / 10, left: left.length },
    ltv, cac, ltvCac, spend3, joined3,
    adSpend: (spend || []).map((s) => ({ month: String(s.month).slice(0, 7), amount: s.amount })),
    cohorts, reasons: Object.keys(reasons).map((k) => ({ reason: k, label: k === 'unknown' ? 'Not given' : reasonLabel(k), count: reasons[k] })).sort((a, b) => b.count - a.count),
    board, focus
  };
}

/* ------------------------------------------------------------- monthly */

/* The numbers for the month that has just ended, next to the month before.
   `at` is any moment in the month after the one reported. */
async function monthlyNumbers(stripe, db, at) {
  const end = monthStart(0, at), start = monthStart(-1, at), prevStart = monthStart(-2, at);
  const profiles = await profileIndex(db);
  const subs = stripe ? await liveSubscriptions(stripe, profiles) : [];
  const sum = summarise(subs);
  const [rowsM, rowsP] = await Promise.all([chargesBetween(db, start, end), chargesBetween(db, prevStart, start)]);
  const m = collectedOf(rowsM), p = collectedOf(rowsP);
  const all = customersOf(profiles);
  const inRange = (t, a, b) => t && new Date(t) >= a && new Date(t) < b;
  const joined = all.filter((x) => inRange(x.started, start, end));
  const joinedPrev = all.filter((x) => inRange(x.started, prevStart, start)).length;
  const { data: ended } = await db.from('billing_cancellations').select('*').gte('ended_at', start.toISOString()).lt('ended_at', end.toISOString());
  const { data: endedPrev } = await db.from('billing_cancellations').select('subscription_id').gte('ended_at', prevStart.toISOString()).lt('ended_at', start.toISOString());
  return {
    month: monthLabel(start), prevMonth: monthLabel(prevStart),
    summary: sum, money: m, prevMoney: p,
    joined: joined.map((x) => ({ name: nameOf(x), plan: x.active_plan })), joinedPrev,
    ended: (ended || []).map((c) => ({ name: nameOf(profiles.byId.get(c.user_id)), plan: c.plan, reason: reasonLabel(c.reason) })),
    endedPrev: (endedPrev || []).length
  };
}

module.exports = {
  DAY, GRACE_DAYS, PLAN_WORD, CANCEL_REASONS, FEEDBACK_TO_REASON, EVIDENCE_FIELDS, DISPUTE_WORDS,
  money, monthStart, monthKey, monthLabel, profileIndex, nameOf,
  chargeRow, recordCharge, recordInvoice, reconcileCharges,
  monthlyOf, liveSubscriptions, summarise, collectedOf, overview,
  cleanReason, reasonLabel, noteCancellation, reasonFromStripe,
  recordDispute, sweepDisputes, draftEvidence, saveEvidence, submitEvidence,
  metrics, monthlyNumbers
};
