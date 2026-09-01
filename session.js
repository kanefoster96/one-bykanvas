/* one — signed-in session, read from what Supabase already stored.
 *
 * No supabase-js here on purpose: this runs on every page, including the
 * marketing ones, and loading the full client just to answer "is anyone
 * signed in" would cost weight nobody asked for. Full sign-in/sign-up still
 * goes through supabase-client.js on the pages that need it.
 *
 * script.js reads email() to choose the nav actions, admin-pill.js reads it
 * to decide whether to show the admin link, and both call logOut() from a
 * page that never loaded the Supabase client.
 */
(function () {
  'use strict';

  /* supabase-js keeps the session under sb-<project-ref>-auth-token. The shape
     has moved around between versions, so this takes whichever of the known
     shapes is there. */
  function stored() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(key)) return { key: key, value: localStorage.getItem(key) };
      }
    } catch (e) { /* private mode can throw on access */ }
    return null;
  }

  function session() {
    var found = stored();
    if (!found || !found.value) return null;
    var parsed;
    try { parsed = JSON.parse(found.value); } catch (e) { return null; }
    if (Array.isArray(parsed)) parsed = parsed[0];
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) { return null; } }
    return (parsed && (parsed.currentSession || parsed)) || null;
  }

  function email() {
    var s = session();
    if (!s) return null;
    if (s.user && s.user.email) return String(s.user.email).toLowerCase();

    if (typeof s.access_token === 'string') {
      try {
        var part = s.access_token.split('.')[1];
        var json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        var mail = JSON.parse(json).email;
        return mail ? String(mail).toLowerCase() : null;
      } catch (e) { /* not a readable token */ }
    }
    return null;
  }

  /* Revokes the refresh token server-side, then clears what is local. Best
     effort: if the network call fails (offline, blocked), the local session
     is still cleared so the browser stops acting signed in. */
  async function logOut() {
    var found = stored();
    var s = session();
    var cfg = window.ONE_SUPABASE || {};

    if (s && s.access_token && cfg.url && cfg.publishableKey) {
      try {
        await fetch(cfg.url + '/auth/v1/logout?scope=local', {
          method: 'POST',
          headers: { apikey: cfg.publishableKey, Authorization: 'Bearer ' + s.access_token }
        });
      } catch (e) { /* still clear the local copy below */ }
    }
    if (found) { try { localStorage.removeItem(found.key); } catch (e) {} }
  }

  /* ---------------------------------------------------------- offer code
   *
   * An email cannot copy anything to a clipboard - no mail client runs
   * scripts - so the code travels in the link instead. Arrive from one and
   * the discount is remembered here, then handed to checkout, and there is
   * nothing to copy, type or mistype.
   *
   * Kept rather than applied: the code is only a claim until Stripe agrees,
   * and Stripe is asked at checkout. Anyone can put ?offer= on a URL, which
   * is exactly as true of typing one into the box on the payment page.
   */
  var OFFER_KEY = 'one.offer';

  function rememberOffer() {
    var code;
    try {
      code = new URLSearchParams(location.search).get('offer');
    } catch (e) { return; }
    if (!code) return;

    /* Codes are short and boring by nature; anything else is somebody
       playing, and there is no reason to carry it around. */
    code = String(code).trim().toUpperCase();
    if (!/^[A-Z0-9._-]{3,40}$/.test(code)) return;

    try { localStorage.setItem(OFFER_KEY, code); } catch (e) {}
  }

  function offerCode() {
    try { return localStorage.getItem(OFFER_KEY) || ''; } catch (e) { return ''; }
  }

  function clearOffer() {
    try { localStorage.removeItem(OFFER_KEY); } catch (e) {}
  }

  rememberOffer();

  /* The raw access token, for the one or two lightweight REST calls the
     marketing pages make themselves (the notification bell's unread count).
     Faking it locally buys nothing: Supabase verifies it on every request
     and RLS decides what it can see. */
  function token() {
    var s = session();
    return (s && typeof s.access_token === 'string') ? s.access_token : null;
  }

  window.ONE_SESSION = {
    email: email, token: token, logOut: logOut,
    offerCode: offerCode, clearOffer: clearOffer
  };
})();
