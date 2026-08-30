/* Catches an auth link that lands on the homepage instead of the page it was
 * meant for, and forwards it, tokens and all.
 *
 * Supabase only sends someone to the redirect_to a link was created with if
 * that exact address is on the project's allowlist. When it is not - a link
 * made before an address changed, a www that is no longer listed, a typo in
 * the dashboard - it silently falls back to the Site URL instead. The tokens
 * still arrive; there is just nothing here that knows what to do with them, so
 * a customer resetting a password gets the marketing page and no explanation.
 *
 * Rather than depend on a dashboard setting being right forever, the homepage
 * now recognises its own auth fragment and sends it on. A misconfigured
 * allowlist costs a redirect instead of costing someone their password.
 *
 * Deliberately runs before anything else on the page and does nothing at all
 * unless the fragment actually carries auth: an ordinary visit never notices.
 */
(function () {
  'use strict';

  var hash = String(location.hash || '').replace(/^#/, '');
  if (!hash) return;

  var p = new URLSearchParams(hash);
  var type = p.get('type');
  var hasToken = Boolean(p.get('access_token'));
  var hasError = Boolean(p.get('error') || p.get('error_code') || p.get('error_description'));
  if (!hasToken && !hasError) return;

  /* A recovery session can do one thing - set a password - so it belongs on
     the page built for that. Everything else that arrives with a session goes
     to the account page, which is where a confirmed signup was headed anyway.
     An error with no type cannot be placed, so it goes to the reset page too:
     that page explains a spent or expired link, which is what almost every
     one of these is. */
  var to = (type === 'recovery' || (hasError && !type)) ? '/reset.html' : '/account.html';

  location.replace(to + '#' + hash);
})();
