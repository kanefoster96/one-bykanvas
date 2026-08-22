/* Shared Supabase client + helpers. Expects vendor/supabase.js and
   supabase-config.js to have loaded first. */
(function () {
  'use strict';

  var cfg = window.ONE_SUPABASE || {};
  var ready = Boolean(cfg.url && cfg.publishableKey && window.supabase);

  window.ONE = {
    ready: ready,
    db: ready ? window.supabase.createClient(cfg.url, cfg.publishableKey) : null,

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
      if (/rate limit|too many|for security purposes/i.test(msg)) return 'Too many attempts just now. Wait a minute and try again.';
      if (/failed to fetch|network/i.test(msg))     return 'Could not reach the server. Check your connection and try again.';
      return msg;
    }
  };
})();
