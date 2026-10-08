/* Refunding one of a customer's payments: shared by the admin page
 * (api/admin.js `refund`) and the MCP `refund` tool, so the checks are the
 * same from either side.
 *
 * Two steps, both against Stripe's live record rather than anything the
 * browser sent:
 *   prepareRefund  resolves an invoice / payment intent / charge id to its
 *                  charge, refuses one that is not this customer's, and works
 *                  out how much is still refundable.
 *   runRefund      re-reads the charge (it may have been part-refunded since
 *                  the preview), checks the same things again, then refunds.
 *
 * Errors meant for a person carry .shown = true and an .httpStatus; one that
 * is about ownership also carries .code = 'PERMISSION_DENIED'. */

function fail(message, status) { const e = new Error(message); e.shown = true; e.httpStatus = status || 400; return e; }
function denied(message) { const e = fail(message || 'Permission denied: that payment is not on this account.', 403); e.code = 'PERMISSION_DENIED'; return e; }
function money(pence) { return '£' + (Number(pence || 0) / 100).toFixed(2); }

const REASONS = ['duplicate', 'fraudulent', 'requested_by_customer'];

/* An invoice (in_), payment intent (pi_) or charge (ch_) id -> its charge. */
async function chargeFor(stripe, paymentId) {
  const id = String(paymentId || '').trim();
  if (/^ch_/.test(id)) return stripe.charges.retrieve(id);
  if (/^pi_/.test(id)) {
    const pi = await stripe.paymentIntents.retrieve(id);
    const ch = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge && pi.latest_charge.id);
    if (!ch) throw fail('That payment has no charge to refund yet.');
    return stripe.charges.retrieve(ch);
  }
  if (/^in_/.test(id)) {
    const inv = await stripe.invoices.retrieve(id);
    const ch = typeof inv.charge === 'string' ? inv.charge : (inv.charge && inv.charge.id);
    if (ch) return stripe.charges.retrieve(ch);
    const piId = typeof inv.payment_intent === 'string' ? inv.payment_intent : (inv.payment_intent && inv.payment_intent.id);
    if (piId) return chargeFor(stripe, piId);
    throw fail('That invoice has not been paid, so there is nothing to refund.');
  }
  throw fail('payment_id should be an invoice (in_), payment intent (pi_) or charge (ch_) id.');
}

function customerOf(charge) {
  return typeof charge.customer === 'string' ? charge.customer : (charge.customer && charge.customer.id);
}

function leftOn(charge) { return charge.amount - (charge.amount_refunded || 0); }

/* customerId is the Stripe customer on the profile we are acting for. */
async function prepareRefund(stripe, { paymentId, customerId, amount, reason }) {
  if (!customerId) throw fail('This account has no Stripe customer, so there is nothing to refund.');
  const charge = await chargeFor(stripe, paymentId);
  if (customerOf(charge) !== customerId) throw denied();
  const left = leftOn(charge);
  if (left <= 0) throw fail('That payment of ' + money(charge.amount) + ' is already fully refunded.');
  const pence = amount == null || amount === '' ? left : Math.round(Number(amount));
  if (!Number.isFinite(pence) || pence <= 0) throw fail('The amount needs to be a whole number of pence.');
  if (pence > left) throw fail('Only ' + money(left) + ' of ' + money(charge.amount) + ' is left to refund.');
  const why = REASONS.includes(reason) ? reason : 'requested_by_customer';
  return { charge, amount: pence, left, reason: why };
}

async function runRefund(stripe, { chargeId, customerId, amount, reason }) {
  if (!/^ch_/.test(String(chargeId || ''))) throw fail('Which charge?');
  const charge = await stripe.charges.retrieve(chargeId);
  if (!customerId || customerOf(charge) !== customerId) throw denied();
  const left = leftOn(charge);
  if (!(amount > 0) || amount > left) {
    throw fail('Only ' + money(left) + ' is left to refund now, so nothing was refunded. Ask for a fresh preview.');
  }
  const r = await stripe.refunds.create({
    charge: chargeId, amount, reason: REASONS.includes(reason) ? reason : 'requested_by_customer'
  });
  return { refund_id: r.id, amount: r.amount, status: r.status };
}

module.exports = { chargeFor, prepareRefund, runRefund, money, REASONS };
