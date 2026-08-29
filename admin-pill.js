/* one — nav pills
 *
 * Puts an "Account" link in the header for anyone signed in, and an "Admin"
 * link as well for the admin specifically. Both are cosmetic and know it:
 * they read the session session.js has already found locally, so this costs
 * no request and works on the marketing pages, which do not load Supabase
 * at all.
 *
 * Faking the value in localStorage shows you a link. It does not get you
 * data: /api/admin verifies the token and the email server-side before it
 * reads anything, and answers a plain 404 to everyone else. The account
 * pill just points at a page that itself requires a real session.
 */
(function () {
  'use strict';

  var ADMINS = ['kane.foster@ymail.com', 'kane@kanvas.one'];

  function pill(bar, id, cls, href, text) {
    if (document.getElementById(id)) return;
    var a = document.createElement('a');
    a.id = id;
    a.className = cls;
    a.href = href;
    a.textContent = text;
    /* Before whichever of these sits furthest right already, so that stays
       the rightmost thing in the header - the burger on marketing pages,
       "Your account" on admin.html. Appending would just tack the pill on
       after it instead. account.html has neither, so it falls through to
       appendChild below, landing after the logo same as everything else. */
    var anchor = bar.querySelector('.burger') || bar.querySelector('.nav-out');
    if (anchor) bar.insertBefore(a, anchor); else bar.appendChild(a);
  }

  function add() {
    var bar = document.querySelector('.nav-inner');
    if (!bar || !window.ONE_SESSION) return;
    var email = window.ONE_SESSION.email();
    if (!email) return;

    pill(bar, 'accountPill', 'admin-pill', '/account.html', 'Account');
    if (ADMINS.indexOf(email) !== -1) {
      pill(bar, 'adminPill', 'admin-pill', '/admin.html', 'Admin');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', add);
  } else {
    add();
  }
})();
