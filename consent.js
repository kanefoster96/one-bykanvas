/* one — cookie consent: the Meta pixel it gates, and our own visitor count
 * it lets people switch off.
 *
 * Two things are on the table, handled differently:
 *
 * - Our own visitor count (beacon.js): first party, no cookie, a random
 *   string for the tab that dies with it, nothing sent to anyone but us.
 *   Runs by default and stops the moment someone presses Reject (the
 *   k1nocount flag below, which beacon.js checks). That is the opt-out the
 *   first-party statistics exemption asks for.
 * - The Meta pixel: advertising, a third party, cookies that identify the
 *   browser. Never loaded until someone presses Accept. It is not a <script>
 *   tag anywhere in the HTML; it is injected here after a click, or not at
 *   all, and only once META_PIXEL_ID is set.
 *
 * Refusing has to be as easy as accepting, so Reject and Accept sit side by
 * side, styled the same weight. No "manage preferences" maze, no pre-ticked
 * anything, and the pill never blocks the page behind it.
 *
 * Meta Events Manager -> Data Sources -> your pixel; it is a 15-16 digit
 * number. Until it is set, Accept simply records the choice.
 */
(function () {
  'use strict';

  var META_PIXEL_ID = '1092399953329404';

  var KEY = 'one.consent';
  var NO_COUNT = 'k1nocount';      /* set on Reject; beacon.js stays quiet while it exists */
  var VERSION = 2;                 /* bump to re-ask everyone after a change */

  /* ?cookies=preview shows the pill on any page without a pixel ID, so the
     design can be checked on a real phone before there is a Meta account.
     Nothing is stored and nothing is loaded: a preview click must not leave a
     recorded choice behind that suppresses the real banner later. */
  var PREVIEW = /(^|[?&])cookies=preview($|&)/.test(location.search);

  /* ---------------------------------------------------------------- store */

  /* Some browsers (private windows, storage blocked) throw on localStorage.
     Without this the pill would come straight back after every click - the
     choice could never be recorded, so it could never stop being asked. The
     answer is held in memory instead: it lasts this page view only, which is
     the most such a browser allows, and the pill stays closed meanwhile. */
  var memChoice = null;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return memChoice;
      var v = JSON.parse(raw);
      /* A choice made against an older set of trackers is not a choice about
         this one, so a version bump re-asks rather than assuming yes. */
      if (!v || v.v !== VERSION) return memChoice;
      return v.choice === 'all' ? 'all' : 'essential';
    } catch (e) { return memChoice; }
  }

  function write(choice) {
    memChoice = choice === 'all' ? 'all' : 'essential';
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: VERSION, choice: choice, at: new Date().toISOString()
      }));
      /* Reject also switches off our own counting, from the next page on. */
      if (memChoice === 'essential') localStorage.setItem(NO_COUNT, '1');
      else localStorage.removeItem(NO_COUNT);
    } catch (e) { /* nothing we can do; the pixel simply will not persist */ }
  }

  /* Meta's cookies are first-party on our own domain, so withdrawing consent
     can actually remove them rather than just stopping new ones. */
  function clearAdCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var bare = host.split('.').slice(-2).join('.');
    if (bare !== host) domains.push('.' + bare);
    ['_fbp', '_fbc'].forEach(function (name) {
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' +
          (d ? '; domain=' + d : '');
      });
    });
  }

  /* ---------------------------------------------------------------- pixel */

  var loaded = false;

  function loadPixel() {
    if (loaded || !META_PIXEL_ID) return;
    loaded = true;

    /* Meta's own loader, written out rather than pasted, so it is readable.
       fbq queues calls until the real library arrives, which is why we can
       track immediately after init. */
    var fbq = window.fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);

    /* No advanced matching: passing a hashed email would send us past what
       "accept cookies" reasonably covers. Add it deliberately, if ever. */
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');

    /* Anything the page tried to track before the click still counts. */
    flush();
  }

  /* --------------------------------------------------------------- events */

  /* Queued rather than dropped: a visitor can submit the lead form and only
     then accept, and that lead is still the thing we wanted to measure. */
  var pending = [];

  function flush() {
    if (!loaded) return;
    while (pending.length) {
      var e = pending.shift();
      try {
        if (e[2]) window.fbq('track', e[0], e[1], { eventID: e[2] });
        else window.fbq('track', e[0], e[1]);
      } catch (err) {}
    }
  }

  /* The only tracking call the rest of the site makes. Safe to call anywhere:
     it does nothing at all unless consent has been given. An event id, when
     given, is the same one the server sends, so Meta counts the two once. */
  window.oneTrack = function (event, params, eventId) {
    if (read() !== 'all') return;
    pending.push([event, params || {}, eventId || null]);
    if (loaded) flush(); else loadPixel();
  };

  /* ---------------------------------------------------------------- banner */

  var pill = null;

  function close() {
    if (!pill) return;
    pill.remove();
    pill = null;
  }

  function choose(choice) {
    if (PREVIEW) { close(); return; }
    var before = read();
    write(choice);
    close();
    if (choice === 'all') {
      loadPixel();
    } else if (before === 'all') {
      /* They have changed their mind. Remove what was set, and reload so the
         pixel is gone from memory too, not just prevented from firing. */
      clearAdCookies();
      location.reload();
    }
  }

  function show() {
    if (pill) return;

    pill = document.createElement('div');
    pill.className = 'consent';
    pill.setAttribute('role', 'region');
    pill.setAttribute('aria-label', 'Cookies');

    /* A card at the foot of the screen: a title, one plain sentence on what
       the cookies do, the policy linked, and three buttons in one row.
       Customise goes to the cookie page, where every cookie is named and
       the same two choices are offered; Reject and Accept answer here. */
    var title = document.createElement('p');
    title.className = 'consent-title';
    title.textContent = 'Cookie settings';

    var text = document.createElement('p');
    text.className = 'consent-text';
    text.appendChild(document.createTextNode(
      'We use cookies to run the site and count visits. If you agree, they also help us improve our ads and learn how to get businesses like yours showing up first. You can read our cookie policy '));
    var link = document.createElement('a');
    link.href = '/cookies.html';
    link.textContent = 'here';
    text.appendChild(link);
    text.appendChild(document.createTextNode('.'));

    var actions = document.createElement('div');
    actions.className = 'consent-actions';

    var custom = document.createElement('a');
    custom.className = 'consent-btn';
    custom.href = '/cookies.html';
    custom.textContent = 'Customise';
    actions.appendChild(custom);

    [['Reject', 'essential'], ['Accept', 'all']].forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'consent-btn' + (b[1] === 'all' ? ' consent-btn-yes' : '');
      btn.textContent = b[0];
      btn.addEventListener('click', function () { choose(b[1]); });
      actions.appendChild(btn);
    });

    pill.appendChild(title);
    pill.appendChild(text);
    pill.appendChild(actions);
    document.body.appendChild(pill);

    requestAnimationFrame(function () { pill.classList.add('in'); });
  }

  /* Withdrawing has to be as easy as giving, so the cookie page and the
     footers call this to bring the choice back up. */
  window.oneConsent = {
    open: show,
    choice: read,
    configured: function () { return !!META_PIXEL_ID; }
  };

  /* ------------------------------------------------------------------ boot */

  /* Any control on the page that reopens the choice: the footer's Cookie
     settings and the button on the cookie page. */
  function wireOpeners() {
    var els = document.querySelectorAll('[data-consent-open], #cookieSettings');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        el.hidden = false;
        el.addEventListener('click', function (e) { e.preventDefault(); show(); });
      })(els[i]);
    }
  }

  function boot() {
    wireOpeners();
    if (PREVIEW) { show(); return; }
    var choice = read();
    if (choice === null) show();
    else if (choice === 'all') loadPixel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
