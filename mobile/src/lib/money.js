/* Words for the Money tab and the screens it opens. The numbers come
   from /api/admin (money, metrics, billing), worked out in api/_money.js. */
import { pounds } from './format';

export const PLAN_WORD = { starter: 'Starter', business: 'Business', pro: 'Pro', max: 'One' };

/* A charge's state, as a tag. */
export const CHARGE_WORD = { paid: 'Paid', failed: 'Failed', refunded: 'Refunded', partly_refunded: 'Part refunded', pending: 'Pending' };
export const CHARGE_TAG = { paid: 'done', failed: 'reply', refunded: 'cancelled', partly_refunded: 'plain', pending: 'plain' };

export const SOURCE_WORD = { admin: 'by you', portal: 'by them', payment_failed: 'payment failed', dispute: 'a dispute', stripe: 'in Stripe' };

export const DISPUTE_WORD = {
  fraudulent: 'Says they did not make it',
  subscription_canceled: 'Says they had cancelled',
  product_not_received: 'Says they did not get the service',
  product_unacceptable: 'Says it was not as described',
  duplicate: 'Says they were charged twice',
  credit_not_processed: 'Says a refund was not made',
  unrecognized: 'Does not recognise it',
  general: 'No reason given'
};

/* The reasons to pick from when a plan is set to end (the server sends
   the same list with each load; this is the fallback). */
export const REASONS = [
  { key: 'too_expensive', label: 'Too expensive' },
  { key: 'not_enough_value', label: 'Not getting enough value' },
  { key: 'not_using', label: 'Not using it' },
  { key: 'missing_feature', label: 'Missing something they need' },
  { key: 'switched', label: 'Moved to another provider' },
  { key: 'service', label: 'Unhappy with our service' },
  { key: 'closing', label: 'Closing or pausing the business' },
  { key: 'other', label: 'Something else' }
];
export function reasonWord(key, list) {
  const r = (list || REASONS).find((x) => x.key === key) || REASONS.find((x) => x.key === key);
  if (r) return r.label;
  return key === 'payment_failed' ? 'Payment failed for 14 days' : key === 'dispute' ? 'Disputed a payment' : 'No reason given';
}

export function money(pence) { return pounds(pence); }
/* "£250 a month", or "£41.67 a month" for a yearly plan. */
export function perMonth(pence) { return pounds(pence) + ' a month'; }

export function day(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
export function dayLong(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
}
export function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);
}
