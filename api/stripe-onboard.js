/* The Stripe set-up link a One club is sent: /api/stripe-onboard?a=acct_...&t=...
 * Each visit makes a fresh Stripe onboarding page and sends them to it, so
 * the link never expires; it is also Stripe's refresh_url, for when a page
 * times out half way. Once Stripe has switched card payments on there is
 * nothing to set up, so it goes to their Stripe dashboard instead. */
const { ACCOUNT_RE, tokenOk, accountStatus, onboardingUrl } = require('./_connect.js');
const { ourSiteUrl } = require('./_env.js');

function go(res, url) {
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

module.exports = async function handler(req, res) {
  const account = String((req.query && req.query.a) || '');
  const token = String((req.query && req.query.t) || '');
  if (!ACCOUNT_RE.test(account) || !tokenOk(account, token)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('This set-up link is not right. Ask Kane for a new one.');
  }
  try {
    const status = await accountStatus(account);
    if (status.cardPayments === 'active' && !status.needsFromClub) return go(res, 'https://dashboard.stripe.com');
    return go(res, await onboardingUrl(account));
  } catch (err) {
    console.error('stripe-onboard:', err.message);
    return go(res, ourSiteUrl() + '/stripe-connected?error=1');
  }
};
