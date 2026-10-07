/* Kanvas One analytics beacon. One line on every site we build:
 *
 *   <script src="https://kanvas.one/beacon.js" data-site="<site id>" defer></script>
 *
 * Sends one hit per page view - the address, the referrer, and whether
 * the screen is a phone - to kanvas.one, where the site's owner sees it
 * in the One app, and one per button or link pressed: the words on it and
 * where it went, never anything typed. No cookie, nothing stored in the
 * browser beyond a random id for this tab that goes when the tab closes.
 * Nothing about the visitor is kept.
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

  /* What was pressed on the way: the words on the button or link and
     where it went. A form counts once it is sent (the browser has let it
     through), by the words on its send button. Nothing typed is read. */
  var CLICKABLE = 'a[href],button,[role="button"],input[type="submit"],input[type="button"],summary';
  var clicks = 0, lastClick = '', lastClickAt = 0;
  function words(node) {
    var t = node.getAttribute('aria-label') || node.innerText || node.value || node.title || '';
    if (!String(t).trim()) { var img = node.querySelector && node.querySelector('img[alt]'); if (img) t = img.alt; }
    return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function targetOf(node) {
    var href = node.getAttribute && node.getAttribute('href');
    if (!href || href.charAt(0) === '#') return '';
    if (/^tel:/i.test(href)) return 'phone';
    if (/^mailto:/i.test(href)) return 'email';
    if (/^(sms|whatsapp):/i.test(href)) return 'message';
    try {
      var u = new URL(href, location.href);
      return u.host === location.host ? (u.pathname || '/') : u.hostname.replace(/^www\./, '');
    } catch (e) { return ''; }
  }
  function click(label, target) {
    if (!counting || !label || clicks >= 100) return;
    var key = label + '|' + target, now = Date.now();
    if (key === lastClick && now - lastClickAt < 1500) return;
    lastClick = key; lastClickAt = now; clicks++;
    send({ site: site, type: 'click', session: sessionId(), path: location.pathname || '/', label: label, target: target || '' });
  }
  document.addEventListener('click', function (e) {
    var node = e.target && e.target.closest && e.target.closest(CLICKABLE);
    if (!node || node.disabled) return;
    if (/^skip to/i.test(words(node))) return;
    // A form's send button is counted when the form is actually sent.
    if (node.form && (node.type === 'submit' || (node.tagName === 'BUTTON' && !node.getAttribute('type')))) return;
    var target = targetOf(node);
    click(words(node) || target, target);
  }, true);
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var btn = e.submitter || form.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
    // A form that checks itself (novalidate) still comes here when a box
    // is empty; that is an attempt, not a send.
    var ok = true;
    try { ok = form.checkValidity(); } catch (err) { /* old browser: count it */ }
    click((btn && words(btn)) || form.getAttribute('aria-label') || 'Sent a form', ok ? 'form' : 'form-incomplete');
  }, true);

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
