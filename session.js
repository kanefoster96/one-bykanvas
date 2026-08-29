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

  window.ONE_SESSION = { email: email, logOut: logOut };
})();
