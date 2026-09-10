/* Kanvas One analytics beacon. One line on every site we build:
 *
 *   <script src="https://kanvas.one/beacon.js" data-site="<site id>" defer></script>
 *
 * Sends one hit per page view - the path, the referrer, and whether the
 * screen is a phone - to kanvas.one, where the site's owner sees it in
 * the One app. No cookie, nothing stored in the browser beyond a random
 * id for this tab that goes when the tab closes. Nothing about the
 * visitor is kept.
 */
(function () {
  'use strict';
  var me = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var site = me && me.getAttribute('data-site');
  if (!site) return;
  var base = (me.getAttribute('data-host') || (me.src ? me.src.replace(/\/beacon\.js.*$/, '') : '') || 'https://kanvas.one').replace(/\/+$/, '');
  // The owner looking at their own dashboard is not a visitor.
  if (/\/(admin|dashboard)(\/|$)/.test(location.pathname)) return;

  function sessionId() {
    var key = 'k1s';
    try {
      var s = sessionStorage.getItem(key);
      if (s) return s;
      s = '';
      var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      var buf = new Uint8Array(16);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
      for (var i = 0; i < 16; i++) s += chars[(buf[i] || Math.floor(Math.random() * 256)) % chars.length];
      sessionStorage.setItem(key, s);
      return s;
    } catch (e) { return 'x' + String(Math.random()).slice(2, 18); }
  }

  var last = '';
  function hit() {
    var path = location.pathname || '/';
    if (path === last) return;
    last = path;
    var body = JSON.stringify({
      site: site, session: sessionId(), path: path, url: location.href,
      referrer: document.referrer || '', width: window.innerWidth || 0
    });
    var url = base + '/api/beacon';
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
    } catch (e) { /* fall through to fetch */ }
    try { fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }); } catch (e) { /* nothing to do */ }
  }

  /* Sites that change the URL without a reload (menus, galleries) count
     each screen once. */
  ['pushState', 'replaceState'].forEach(function (name) {
    var orig = history[name];
    if (!orig) return;
    history[name] = function () { var r = orig.apply(this, arguments); setTimeout(hit, 0); return r; };
  });
  window.addEventListener('popstate', function () { setTimeout(hit, 0); });
  hit();
})();
