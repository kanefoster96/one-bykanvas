/* Single source of truth for what each plan costs, shared by the checkout
   endpoint, the webhook and the account page. Prices are in pence.

   Requests are unlimited on every plan; what a plan buys is queue position
   (Max first, then Business) plus its extras. Pro is legacy - no longer
   sold anywhere, kept here so an existing Pro subscription still resolves
   to its price and label. The points numbers
   below are legacy: the requests table's check constraint still expects a
   points value on each row, so inserts keep writing one, but no money or
   allowance is derived from it anywhere any more. */
/* yearly = ten months' money for twelve months of service: "2 months
   free" framing rather than a percentage discount. pro has no yearly
   price because it is legacy and cannot be bought. */
const PLANS = {
  business: { label: 'Kanvas One — Business', amount: 5000,  yearly: 50000,  points: 1 },
  pro:      { label: 'Kanvas One — Pro',      amount: 12000,                 points: 3 },
  max:      { label: 'Kanvas One — Max',      amount: 25000,  yearly: 250000, points: 5 }
};

/* What a request costs, and what it would cost paid for on its own. */
const REQUEST_COST = {
  edit:    { points: 1, amount: 4000  },
  feature: { points: 3, amount: 12000 }
};

/* The code new leads are offered (created in Stripe: 50% off, 3 months).
   Shared by the your-site-is-ready email and the follow-up emails. */
const PREVIEW_OFFER = { code: 'WELCOME26' };

module.exports = { PLANS, REQUEST_COST, PREVIEW_OFFER };
