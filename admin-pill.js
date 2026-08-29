/* one — admin pill
 *
 * Puts an "Admin" link in the header when the browser is signed in as the
 * admin. This is cosmetic and it knows it: it reads the session Supabase has
 * already stored locally, so it costs no request and works on the marketing
 * pages, which do not load Supabase at all.
 *
 * Faking the value in localStorage shows you a link. It does not get you data:
 * /api/admin verifies the token and the email server-side before it reads
 * anything, and answers a plain 404 to everyone else.
 */
(function () {
  'use strict';

  var ADMINS = ['kane.foster@ymail.com', 'kane@kanvas.one'];

  /* supabase-js keeps the session under sb-<project-ref>-auth-token. The shape
     has moved around between versions, so take the email from whichever of the
     known shapes is there, and fall back to the JWT itself. */
  function signedInEmail() {
    var raw = null;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(key)) { raw = localStorage.getItem(key); break; }
      }
    } catch (e) { return null; }        // private mode can throw on access
    if (!raw) return null;

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (Array.isArray(parsed)) parsed = parsed[0];
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) { return null; } }
    if (!parsed) return null;

    var session = parsed.currentSession || parsed;
    var email = session && session.user && session.user.email;

    if (!email && session && typeof session.access_token === 'string') {
      try {
        var part = session.access_token.split('.')[1];
        var json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        email = JSON.parse(json).email;
      } catch (e) { /* not a readable token */ }
    }
    return email ? String(email).toLowerCase() : null;
  }

  function add() {
    var bar = document.querySelector('.nav-inner');
    if (!bar || document.getElementById('adminPill')) return;
    if (ADMINS.indexOf(signedInEmail()) === -1) return;

    var pill = document.createElement('a');
    pill.id = 'adminPill';
    pill.className = 'admin-pill';
    pill.href = '/admin.html';
    pill.textContent = 'Admin';
    // Before the burger, so the burger stays hard against the right edge.
    var burger = bar.querySelector('.burger');
    if (burger) bar.insertBefore(pill, burger); else bar.appendChild(pill);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', add);
  } else {
    add();
  }
})();
