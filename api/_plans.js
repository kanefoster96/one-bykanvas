/* Single source of truth for what each plan costs, shared by the checkout
   endpoint and the webhook. Prices are in pence. */
const PLANS = {
  business: { label: 'one — Business', amount: 5000 },
  pro:      { label: 'one — Pro',      amount: 9000 },
  max:      { label: 'one — Max',      amount: 15000 }
};

module.exports = { PLANS };
