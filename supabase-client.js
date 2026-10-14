/* Shared Supabase client + helpers. Expects vendor/supabase.js and
   supabase-config.js to have loaded first. */
(function () {
  'use strict';

  var cfg = window.ONE_SUPABASE || {};
  var ready = Boolean(cfg.url && cfg.publishableKey && window.supabase);

  /* A new session's expiry, counted on this device's clock rather than the
     server's. The token answer carries expires_at as a server timestamp and
     supabase-js compares it with Date.now(): on a phone whose clock runs an
     hour or more fast (a different time zone set by hand, as on App
     Review's iPad), a token made a second ago already looks expired, so
     every call refreshes it and the app stalls after signing in. Without
     expires_at, supabase-js uses now + expires_in on the device's own
     clock. The server still checks the token against its own clock, so
     nothing lasts longer. Same fix as the Kanvas Academy app. */
  function expiryOnDeviceClock(response) {
    if (!response.ok) return response;
    return response.clone().json().then(function (body) {
      if (!body || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number' || !('expires_at' in body)) return response;
      delete body.expires_at;
      var headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(JSON.stringify(body), { status: response.status, statusText: response.statusText, headers: headers });
    }, function () { return response; });
  }
  function authFetch(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var res = fetch(input, init);
    return url.indexOf('/auth/v1/') >= 0 ? res.then(expiryOnDeviceClock) : res;
  }

  window.ONE = {
    ready: ready,
    db: ready ? window.supabase.createClient(cfg.url, cfg.publishableKey, { global: { fetch: authFetch } }) : null,

    /* Surfaces a clear message rather than failing silently when unconfigured.
       Reads the public flag so there is one source of truth. */
    requireConfig: function (noteEl) {
      if (window.ONE.ready && window.ONE.db) return true;
      if (noteEl) {
        noteEl.textContent = window.supabase
          ? 'Accounts are not connected yet — add your Supabase URL and publishable key to supabase-config.js.'
          : 'Could not load the accounts library. Refresh the page and try again.';
        noteEl.className = 'note bad';
      }
      return false;
    },

    friendlyError: function (error) {
      var msg = (error && error.message) || 'Something went wrong. Please try again.';
      if (/invalid login credentials/i.test(msg))   return 'That email and password do not match an account.';
      if (/email not confirmed/i.test(msg))         return 'Check your inbox and confirm your email address first.';
      if (/already registered/i.test(msg))          return 'There is already an account with that email. Try logging in.';
      if (/password should be at least/i.test(msg)) return 'Passwords need to be at least 8 characters.';
      /* The mail limit is its own thing and clears in about an hour, so it must
         not share the generic "wait a minute" line: following that advice gets
         the same refusal ten minutes later with no idea why. */
      if (/email rate limit|over_email_send_rate_limit/i.test(msg))
        return 'We could not send your confirmation email just now. Try again in an hour, '
             + 'or email us and we will set you up by hand.';
      if (/email address .* is invalid|email_address_invalid/i.test(msg))
        return 'That email address was rejected. Check it is spelled correctly.';
      if (/rate limit|too many|for security purposes/i.test(msg)) return 'Too many attempts just now. Wait a minute and try again.';
      if (/failed to fetch|network/i.test(msg))     return 'Could not reach the server. Check your connection and try again.';
      return msg;
    }
  };
})();
