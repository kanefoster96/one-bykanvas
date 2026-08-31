/* one — cookie consent, and the Meta pixel it gates.
 *
 * The rule this file exists to enforce: nothing that identifies a visitor is
 * stored or sent until they have said yes. UK PECR allows exactly one
 * exception - storage that is strictly necessary for a service the visitor
 * asked for - and advertising is not that. So the pixel is not a <script> tag
 * anywhere in the HTML. It is injected here, after a click, or not at all.
 *
 * Refusing has to be as easy as accepting, so there are two buttons, side by
 * side, styled the same weight. No "manage preferences" maze, no pre-ticked
 * anything, and the pill never blocks the page behind it.
 *
 * TO GO LIVE: put your pixel ID in META_PIXEL_ID below. Until you do, the
 * banner does not appear, because there would be nothing to consent to and
 * asking anyway would be theatre. Meta Events Manager -> Data Sources -> your
 * pixel; it is a 15-16 digit number.
 */
(function () {
  'use strict';

  var META_PIXEL_ID = '';          /* <- your pixel ID goes here */

  var KEY = 'one.consent';
  var VERSION = 1;                 /* bump to re-ask everyone after a change */

  /* ---------------------------------------------------------------- store */

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      /* A choice made against an older set of trackers is not a choice about
         this one, so a version bump re-asks rather than assuming yes. */
      if (!v || v.v !== VERSION) return null;
      return v.choice === 'all' ? 'all' : 'essential';
    } catch (e) { return null; }       /* private mode: treat as undecided */
  }

  function write(choice) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: VERSION, choice: choice, at: new Date().toISOString()
      }));
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
      try { window.fbq('track', e[0], e[1]); } catch (err) {}
    }
  }

  /* The only tracking call the rest of the site makes. Safe to call anywhere:
     it does nothing at all unless consent has been given. */
  window.oneTrack = function (event, params) {
    if (read() !== 'all') return;
    pending.push([event, params || {}]);
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

    var text = document.createElement('p');
    text.className = 'consent-text';
    text.innerHTML = 'We use cookies to measure our ads. ' +
      '<a href="/cookies.html">Details</a>';

    var actions = document.createElement('div');
    actions.className = 'consent-actions';

    [['Essential only', 'essential'], ['Accept all', 'all']].forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'consent-btn' + (b[1] === 'all' ? ' consent-btn-yes' : '');
      btn.textContent = b[0];
      btn.addEventListener('click', function () { choose(b[1]); });
      actions.appendChild(btn);
    });

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

  /* Any control on the page that reopens the choice. Hidden when there is
     nothing to choose, so the footer does not offer settings that do not
     exist. */
  function wireOpeners() {
    var els = document.querySelectorAll('[data-consent-open], #cookieSettings');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        if (!META_PIXEL_ID) { el.hidden = true; return; }
        el.hidden = false;
        el.addEventListener('click', function (e) { e.preventDefault(); show(); });
      })(els[i]);
    }
  }

  function boot() {
    wireOpeners();
    if (!META_PIXEL_ID) return;      /* nothing to ask about yet */
    var choice = read();
    if (choice === 'all') loadPixel();
    else if (choice === null) show();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
