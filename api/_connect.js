/* Stripe Connect for One clubs: each club's own Stripe account, connected
 * to Kanvas One's. Parents pay the club (direct charges, made by the club's
 * own site with STRIPE_CONNECT_ACCOUNT); Stripe bills the club its card
 * fees and stands behind chargebacks; the club has the full Stripe
 * Dashboard. This file makes the account, its onboarding link and its
 * status, through Accounts v2.
 *
 * Plain fetch rather than the stripe package: the v2 endpoints need a
 * newer API version than the one the rest of this site's Stripe calls are
 * pinned to, and moving those is a separate job.
 */
const crypto = require('crypto');
const { ourSiteUrl } = require('./_env.js');

const API_VERSION = '2026-06-24.dahlia';
const ACCOUNT_RE = /^acct_[A-Za-z0-9]{6,64}$/;

async function v2(method, path, body) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { const e = new Error('Stripe is not configured.'); e.shown = true; throw e; }
  const res = await fetch('https://api.stripe.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Stripe-Version': API_VERSION, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || ('Stripe answered ' + res.status);
    const e = new Error('Stripe: ' + msg); e.shown = true; throw e;
  }
  return data;
}

/* A new connected account for a club: full Stripe Dashboard, Stripe bills
   them and is liable for negative balances, card payments requested. */
async function createClubAccount(profile) {
  const account = await v2('POST', '/v2/core/accounts', {
    display_name: String(profile.business_name || profile.contact_name || 'Club').slice(0, 100),
    ...(profile.email ? { contact_email: profile.email } : {}),
    dashboard: 'full',
    identity: { country: 'gb' },
    defaults: {
      currency: 'gbp',
      locales: ['en-GB'],
      responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' }
    },
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
    metadata: { kanvas_user: profile.id }
  });
  if (!ACCOUNT_RE.test(account.id || '')) throw new Error('Stripe returned no account id.');
  return account.id;
}

/* Where the club is up to. card_payments active means their site can take
   money; anything Stripe still needs from them is counted. */
async function accountStatus(accountId) {
  const a = await v2('GET', '/v2/core/accounts/' + encodeURIComponent(accountId)
    + '?include=configuration.merchant&include=requirements');
  const cap = a.configuration && a.configuration.merchant && a.configuration.merchant.capabilities
    && a.configuration.merchant.capabilities.card_payments;
  const entries = (a.requirements && a.requirements.entries) || [];
  const fromThem = entries.filter((e) => e.awaiting_action_from === 'user').length;
  return { account: accountId, cardPayments: (cap && cap.status) || 'pending', needsFromClub: fromThem };
}

/* The link we send stays good for ever: it leads to /api/stripe-onboard,
   which makes a fresh Stripe link each time (Stripe's own expire within
   minutes and work once). Signed so only the account it was made for can
   be onboarded through it. */
function linkToken(accountId) {
  return crypto.createHmac('sha256', String(process.env.STRIPE_SECRET_KEY || ''))
    .update('connect-onboard:' + accountId).digest('hex').slice(0, 32);
}
function tokenOk(accountId, token) {
  const want = Buffer.from(linkToken(accountId));
  const got = Buffer.from(String(token || ''));
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function setupLink(accountId) {
  return ourSiteUrl() + '/api/stripe-onboard?a=' + encodeURIComponent(accountId) + '&t=' + linkToken(accountId);
}

/* A Stripe-hosted onboarding page for the account, right now. */
async function onboardingUrl(accountId) {
  const back = setupLink(accountId);
  const link = await v2('POST', '/v2/core/account_links', {
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['merchant'],
        refresh_url: back,
        return_url: ourSiteUrl() + '/stripe-connected'
      }
    }
  });
  return link.url;
}

module.exports = { ACCOUNT_RE, createClubAccount, accountStatus, setupLink, tokenOk, onboardingUrl };
