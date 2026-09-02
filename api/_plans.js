/* Single source of truth for what each plan costs, shared by the checkout
   endpoint, the webhook and the account page. Prices are in pence.

   Requests are unlimited on every plan; what a plan buys is queue position
   (Max first, then Pro, then Business) plus its extras. The points numbers
   below are legacy: the requests table's check constraint still expects a
   points value on each row, so inserts keep writing one, but no money or
   allowance is derived from it anywhere any more. */
const PLANS = {
  business: { label: 'Kanvas One — Business', amount: 5000,  points: 1 },
  pro:      { label: 'Kanvas One — Pro',      amount: 12000, points: 3 },
  max:      { label: 'Kanvas One — Max',      amount: 25000, points: 5 }
};

/* What a request costs, and what it would cost paid for on its own. */
const REQUEST_COST = {
  edit:    { points: 1, amount: 4000  },
  feature: { points: 3, amount: 12000 }
};

module.exports = { PLANS, REQUEST_COST };
