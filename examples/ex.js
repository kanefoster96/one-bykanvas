/* The example websites: Kanvas One's layer on top of each one.
 *
 * - Every link and button on the example (href="#preview", or
 *   data-preview) opens the preview pop-up: this is how your site could
 *   look, and a button to /free for this trade. The press is still a
 *   click in the journey (beacon.js), and so is the pop-up's button.
 * - The pill names the example, opens a list of the others, and closes
 *   back to /free.
 * - The few parts of an example that do something on the spot: the
 *   treatment chips, the polish swatches, the valeting price and the
 *   before-and-after handle.
 */
(function () {
  'use strict';

  /* Where they came from, kept for the visit, as script.js does on every
     other page: an ad can land here and the lead, filled in on /free a page
     later, still says which ad it was. First page wins. */
  try {
    if (!sessionStorage.getItem('one.from')) {
      var q = new URLSearchParams(location.search);
      var bits = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
        .map(function (k) { return String(q.get(k) || '').trim().slice(0, 40); })
        .filter(Boolean);
      if (!bits.length && q.get('fbclid')) bits.push('facebook');
      if (bits.length) sessionStorage.setItem('one.from', (bits.join(' / ') + ' · ' + location.pathname.replace(/\.html$/, '')).slice(0, 200));
    }
  } catch (e) { /* private mode: the lead simply has no campaign */ }

  /* ---------- the preview pop-up ---------- */
  var modal = document.getElementById('k1Modal');
  var opener = null;
  function show() {
    if (!modal) return;
    opener = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('k1-locked');
    var go = modal.querySelector('.k1-modal-go');
    if (go) go.focus({ preventScroll: true });
  }
  function hide() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('k1-locked');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('a[href="#preview"], [data-preview]');
    if (t) { e.preventDefault(); show(); return; }
    if (modal && !modal.hidden && (e.target === modal || (e.target.closest && e.target.closest('[data-k1-close]')))) hide();
  });
  document.addEventListener('keydown', function (e) {
    if (!modal || modal.hidden) return;
    if (e.key === 'Escape') { hide(); return; }
    // Keep Tab inside the pop-up while it is open.
    if (e.key === 'Tab') {
      var f = modal.querySelectorAll('a[href],button');
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- the pill ---------- */
  var pill = document.getElementById('k1Pill');
  var btn = document.getElementById('k1Switch');
  var menu = document.getElementById('k1Menu');
  if (!pill || !btn || !menu) return;

  function open(yes) {
    menu.hidden = !yes;
    btn.setAttribute('aria-expanded', yes ? 'true' : 'false');
    if (yes) { var cur = menu.querySelector('a'); if (cur) cur.focus({ preventScroll: true }); }
  }
  btn.addEventListener('click', function () { open(menu.hidden); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !pill.contains(e.target)) open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });

  /* The cookie strip sits at the bottom too: lift the pill above it while
     it is showing, and let it back down when it goes. */
  function lift() {
    var c = document.querySelector('.consent');
    var h = c && !c.hidden && getComputedStyle(c).display !== 'none' ? c.getBoundingClientRect().height + 10 : 0;
    pill.style.setProperty('--k1-lift', h + 'px');
  }
  new MutationObserver(lift).observe(document.body, { childList: true });
  window.addEventListener('resize', lift);
  lift();

  /* The header is see-through over the hero and turns to frosted glass
     once the page scrolls under it. */
  var nav = document.getElementById('xNav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* The services row's arrows, on a computer: one card along each press. */
  document.querySelectorAll('.x-rail-wrap').forEach(function (wrap) {
    var rail = wrap.querySelector('.x-rail');
    wrap.querySelectorAll('[data-rail]').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = rail.querySelector('.x-card');
        var step = card ? card.getBoundingClientRect().width + 14 : 300;
        rail.scrollBy({ left: step * Number(b.getAttribute('data-rail')), behavior: 'smooth' });
      });
    });
  });

  /* Buttons in a group where one is picked: the treatment chips, the
     swatches, the car size and the clean. */
  function pick(group, b) {
    group.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
  }
  document.querySelectorAll('.x-chips').forEach(function (g) {
    g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) pick(g, b); });
  });

  /* The swatches paint the nails. */
  document.querySelectorAll('.x-swatches').forEach(function (g) {
    var hero = g.closest('.x-hero');
    g.addEventListener('click', function (e) {
      var b = e.target.closest('[data-polish]');
      if (!b) return;
      pick(g, b);
      hero.style.setProperty('--polish', b.getAttribute('data-polish'));
    });
  });

  /* The valeting price: the clean's price plus the car's size. */
  document.querySelectorAll('[data-quote]').forEach(function (q) {
    var out = q.querySelector('[data-q-out]');
    function total() {
      var sum = 0;
      q.querySelectorAll('.x-seg button[aria-pressed="true"]').forEach(function (b) { sum += Number(b.getAttribute('data-v')) || 0; });
      out.textContent = '\u00a3' + sum;
    }
    q.querySelectorAll('.x-seg').forEach(function (g) {
      g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { pick(g, b); total(); } });
    });
  });

  /* Before and after: the range under the picture moves the line. */
  document.querySelectorAll('.x-ba').forEach(function (ba) {
    var r = ba.querySelector('input[type="range"]');
    r.addEventListener('input', function () { ba.style.setProperty('--pos', r.value + '%'); });
  });
})();
