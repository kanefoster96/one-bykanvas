/* Single source of truth for what each plan costs and what it includes, shared
   by the checkout endpoint, the webhook and the account page. Prices are in
   pence.

   Points are how work is rationed after launch: an edit costs one, a feature
   three. Pricing them by effort rather than by count is what stops a month's
   allowance being spent entirely on features.

   account.js carries the same POINTS numbers for display. Change both. */
const PLANS = {
  business: { label: 'one — Business', amount: 5000,  points: 0 },
  pro:      { label: 'one — Pro',      amount: 9000,  points: 3 },
  max:      { label: 'one — Max',      amount: 15000, points: 5 }
};

/* What a request costs, and what it would cost paid for on its own. */
const REQUEST_COST = {
  edit:    { points: 1, amount: 3500  },
  feature: { points: 3, amount: 10500 }
};

module.exports = { PLANS, REQUEST_COST };
