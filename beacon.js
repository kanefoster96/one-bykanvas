/* Kanvas One analytics beacon. One line on every site we build:
 *
 *   <script src="https://kanvas.one/beacon.js" data-site="<site id>" defer></script>
 *
 * Sends one hit per page view - the path, the referrer, and whether the
 * screen is a phone - to kanvas.one, where the site's owner sees it in
 * the One app. No cookie, nothing stored in the browser beyond a random
 * id for this tab that goes when the tab closes. Nothing about the
 * visitor is kept.
 *
 * A site that takes payments adds one call on its thank-you page, and
 * the payment is counted against this visit in the Analytics tab:
 *
 *   k1.payment({ amount: 4500, ref: 'order_123' })
 *
 * amount in pence. ref is the order or payment id, so a refreshed page
 * does not count twice. Optional: email, name, description, currency.
 */
(function () {
  'use strict';
  var me = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var site = me && me.getAttribute('data-site');
  var base = ((me && me.getAttribute('data-host')) || (me && me.src ? me.src.replace(/\/beacon\.js.*$/, '') : '') || 'https://kanvas.one').replace(/\/+$/, '');
  var url = base + '/api/beacon';

  // The owner looking at their own dashboard is not a visitor.
  var counting = !!site && !/\/(admin|dashboard)(\/|$)/.test(location.pathname);
  // Someone who pressed Decline on the site's cookie pill is not counted.
  try { if (localStorage.getItem('k1nocount')) counting = false; } catch (e) { /* storage blocked: count as normal */ }

  function sessionId() {
    if (!counting) return null;
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

  function send(data) {
    var body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
    } catch (e) { /* fall through to fetch */ }
    try { fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }); } catch (e) { /* nothing to do */ }
  }

  var last = '';
  function hit() {
    if (!counting) return;
    var path = location.pathname || '/';
    if (path === last) return;
    last = path;
    send({ site: site, session: sessionId(), path: path, url: location.href, referrer: document.referrer || '', width: window.innerWidth || 0 });
  }

  /* A payment the site took. Counted whether or not the visit is, since
     it is the business's own record; the visit is tied to it only when
     the visitor is being counted. */
  function payment(p) {
    if (!site || !p) return;
    var amount = Math.round(Number(p.amount));
    if (!(amount >= 0)) return;
    send({
      site: site, type: 'payment', session: sessionId(), amount: amount,
      currency: p.currency || 'gbp', ref: p.ref || p.id || '', email: p.email || '', name: p.name || '', description: p.description || ''
    });
  }

  var api = window.k1 || {};
  api.payment = payment;
  api.session = sessionId;
  window.k1 = api;

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
