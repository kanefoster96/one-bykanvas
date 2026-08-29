/* one — admin pill
 *
 * Puts an "Admin" link in the header when the browser is signed in as the
 * admin. This is cosmetic and it knows it: it reads the session session.js
 * has already found locally, so it costs no request and works on the
 * marketing pages, which do not load Supabase at all.
 *
 * Faking the value in localStorage shows you a link. It does not get you data:
 * /api/admin verifies the token and the email server-side before it reads
 * anything, and answers a plain 404 to everyone else.
 */
(function () {
  'use strict';

  var ADMINS = ['kane.foster@ymail.com', 'kane@kanvas.one'];

  function add() {
    var bar = document.querySelector('.nav-inner');
    if (!bar || document.getElementById('adminPill')) return;
    if (!window.ONE_SESSION) return;
    if (ADMINS.indexOf(window.ONE_SESSION.email()) === -1) return;

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
