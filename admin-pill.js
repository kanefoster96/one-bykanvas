/* one — nav pills and the notification bell
 *
 * Puts an "Account" link in the header for anyone signed in, and an "Admin"
 * link as well for the admin specifically. Both are cosmetic and know it:
 * they read the session session.js has already found locally, so this costs
 * no request and works on the marketing pages, which do not load Supabase
 * at all.
 *
 * Signed-in visitors also get the notification bell here, on every page -
 * account.html and admin.html carry their own copy in the markup, so this
 * only adds one where none exists. The unread count is two small REST calls
 * with the stored token; if the token has gone stale they just fail quietly
 * and the bell shows without a number.
 *
 * Faking the value in localStorage shows you a link. It does not get you
 * data: /api/admin verifies the token and the email server-side before it
 * reads anything, RLS decides what the bell can count, and the account
 * pill just points at a page that itself requires a real session.
 */
(function () {
  'use strict';

  var ADMINS = ['kane@kanvas.one'];

  var BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/>'
    + '<path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>';

  function bell(bar, beforeEl) {
    // The pages with their own bell keep it; the notifications page IS the
    // bell's destination, so a bell there would only link to itself.
    if (document.getElementById('navBell')) return;
    if (/notifications/.test(location.pathname)) return;

    var a = document.createElement('a');
    a.id = 'navBell';
    a.className = 'nav-icon';
    a.href = '/notifications.html';
    a.setAttribute('aria-label', 'Notifications');
    a.innerHTML = BELL_SVG;
    var badge = document.createElement('span');
    badge.className = 'nav-count';
    badge.id = 'navBellCount';
    badge.hidden = true;
    a.appendChild(badge);
    bar.insertBefore(a, beforeEl || null);

    countUnread(badge);
  }

  /* Two calls, both scoped by RLS: when they last looked (their own profile
     row), then how many notifications are newer. Any failure - stale token,
     tables not there yet, offline - leaves the badge hidden. */
  async function countUnread(badge) {
    var cfg = window.ONE_SUPABASE || {};
    var token = window.ONE_SESSION.token && window.ONE_SESSION.token();
    if (!cfg.url || !cfg.publishableKey || !token) return;
    var headers = { apikey: cfg.publishableKey, Authorization: 'Bearer ' + token };

    try {
      var profRes = await fetch(cfg.url + '/rest/v1/profiles?select=notifications_seen_at', { headers: headers });
      if (!profRes.ok) return;
      var rows = await profRes.json();
      var seen = (rows && rows[0] && rows[0].notifications_seen_at) || '1970-01-01';

      var countRes = await fetch(cfg.url + '/rest/v1/notifications?select=id&created_at=gt.'
        + encodeURIComponent(seen), {
        method: 'HEAD',
        headers: Object.assign({ Prefer: 'count=exact' }, headers)
      });
      if (!countRes.ok) return;
      var range = countRes.headers.get('content-range') || '';
      var n = parseInt(range.split('/')[1], 10);
      if (Number.isFinite(n) && n > 0) {
        badge.textContent = String(n);
        badge.hidden = false;
      }
    } catch (e) { /* quiet - the bell without a number is still the bell */ }
  }

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

    /* The admin gets one pill, not two: Admin is where their day happens,
       and /account.html stays a typed-in URL for the rare visit. Everyone
       else gets Account. */
    if (ADMINS.indexOf(email) !== -1) {
      pill(bar, 'adminPill', 'admin-pill', '/admin.html', 'Admin');
    } else {
      pill(bar, 'accountPill', 'admin-pill', '/account.html', 'Account');
    }

    // The bell sits just left of whichever pill was added.
    bell(bar, document.getElementById('adminPill') || document.getElementById('accountPill'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', add);
  } else {
    add();
  }
})();
