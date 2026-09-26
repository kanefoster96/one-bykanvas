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
/* starter is the way in: a designed, hosted site with a contact form and
   click to call, a change a month, no setup fee. Every page and email leads
   with it. Business is the step up at checkout (+£25: bookings, payments,
   chat, unlimited changes), Max is add growth. */
const PLANS = {
  starter:  { label: 'Kanvas One — Starter',  amount: 2500,  yearly: 25000,  points: 1 },
  business: { label: 'Kanvas One — Business', amount: 5000,  yearly: 50000,  points: 1 },
  pro:      { label: 'Kanvas One — Pro',      amount: 12000,                 points: 3 },
  max:      { label: 'Kanvas One — Max',      amount: 25000,  yearly: 250000, points: 5 }
};

/* What a request costs, and what it would cost paid for on its own. */
const REQUEST_COST = {
  edit:    { points: 1, amount: 4000  },
  feature: { points: 3, amount: 12000 }
};

/* The code every new monthly customer gets (created in Stripe: 50% off,
   first month only). Applied by default at checkout on a monthly plan;
   never on annual, where the bonus is the Launch Boost instead. */
const PREVIEW_OFFER = { code: 'WELCOME26' };

/* What an annual plan gets on top of two months free: the first month
   after going live spent on being found. Work, not a ranking promise, and
   the same list every time so it can be handed to a builder. */
const LAUNCH_BOOST = {
  name: 'The Launch Boost',
  line: 'Pay for the year and your first month is spent getting you found.',
  items: [
    'Your Google Business Profile set up, verified and filled in',
    'A page for every service you offer and every town you cover',
    'Your details marked up the way Google and AI assistants read them',
    'Your site submitted to Google, and your first reviews asked for',
    'A note at the end of the month showing where you now show up'
  ]
};

module.exports = { PLANS, REQUEST_COST, PREVIEW_OFFER, LAUNCH_BOOST };
