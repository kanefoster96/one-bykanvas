/* The homepage's own behaviour (home26.css draws it).
 *
 * 1. Things arrive once, then rest: cards rise in, icons pop, numbers count
 *    up, chips float in. Hidden only under html.h-anim, which the page sets
 *    before it paints, so with no JavaScript everything simply shows.
 * 2. The phone rises in once, floats gently, and on a computer leans a
 *    touch towards the pointer.
 * 3. The empty-spaces sum: two sliders, a grid of class spaces, and
 *    "Fill them" turning the empty ones green.
 * 4. Only one question open at a time.
 * Reduce Motion shows everything straight away and keeps the phone still.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gb = function (n) { return n.toLocaleString('en-GB'); };

  /* ---------- 1. Arrive once ---------- */
  function countUp(el) {
    var end = +el.getAttribute('data-count'), pre = el.getAttribute('data-pre') || '';
    if (reduce) { el.textContent = pre + gb(end); return; }
    var t0 = performance.now(), dur = 1200;
    (function tick(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + gb(Math.round(end * e));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function show(el) {
    var d = +(el.getAttribute('data-delay') || 0);
    setTimeout(function () {
      el.classList.add('h-is-in');
      [].forEach.call(el.querySelectorAll('.h-chips'), function (g, i) {
        setTimeout(function () { g.classList.add('h-chips-in'); }, 420 + i * 300);
      });
      [].forEach.call(el.querySelectorAll('[data-count]'), function (n, i) {
        setTimeout(function () { countUp(n); }, i * 220);
      });
    }, reduce ? 0 : d);
  }
  var items = [].slice.call(document.querySelectorAll('.h-reveal'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) {
      /* Taller than the screen: it could never be 15% in view, so it just shows. */
      if (el.getBoundingClientRect().height > window.innerHeight * 0.9) show(el);
      else io.observe(el);
    });
  } else {
    items.forEach(show);
  }

  /* ---------- 2. The phone ---------- */
  var art = document.querySelector('.h-hero-art'), tilt = document.querySelector('.h-phone-tilt');
  var hero = document.querySelector('.h-hero');
  if (art) setTimeout(function () { art.classList.add('h-in'); }, reduce ? 0 : 250);
  if (art && tilt && hero && !reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, ticking = false;
    var step = function () {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      tilt.style.transform = 'rotateY(' + cx.toFixed(2) + 'deg) rotateX(' + cy.toFixed(2) + 'deg)';
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) requestAnimationFrame(step);
      else ticking = false;
    };
    var aim = function (x, y) { tx = x; ty = y; if (!ticking) { ticking = true; requestAnimationFrame(step); } };
    var clamp = function (v) { return Math.max(-1, Math.min(1, v)); };
    hero.addEventListener('pointermove', function (e) {
      var r = art.getBoundingClientRect();
      aim(clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 1.5)) * 7,
          clamp(((r.top + r.height / 2) - e.clientY) / (r.height * 1.5)) * 5);
    });
    hero.addEventListener('pointerleave', function () { aim(0, 0); });
  }

  /* ---------- 3. The empty-spaces sum ---------- */
  var PRICE = 250, SEATS = 40;
  var empty = document.getElementById('hEmpty'), fee = document.getElementById('hFee');
  var seats = document.getElementById('hSeats'), resN = document.getElementById('hResN');
  var resLabel = document.getElementById('hResLabel'), fillBtn = document.getElementById('hFill');
  if (empty && fee && seats && resN && fillBtn) {
    var filled = false, shown = 0, raf = 0;
    for (var i = 0; i < SEATS; i++) { var s = document.createElement('span'); s.className = 'h-seat'; seats.appendChild(s); }
    var seatEls = [].slice.call(seats.children);
    var paintRange = function (r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); };
    var animateTo = function (val) {
      cancelAnimationFrame(raf);
      var from = shown, t0 = performance.now(), dur = reduce ? 0 : 500;
      (function tick(now) {
        var k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
        shown = Math.round(from + (val - from) * e);
        resN.textContent = (filled ? '+£' : '£') + gb(shown);
        if (k < 1) raf = requestAnimationFrame(tick);
      })(t0);
    };
    var update = function () {
      var e = +empty.value, f = +fee.value;
      document.getElementById('hEmptyOut').textContent = e;
      document.getElementById('hFeeOut').textContent = '£' + f;
      paintRange(empty); paintRange(fee);
      var n = Math.ceil(PRICE / f);
      document.getElementById('hPayback').textContent = n + ' new member' + (n === 1 ? '' : 's');
      seatEls.forEach(function (el, idx) {
        var isEmpty = idx >= SEATS - e;
        el.classList.toggle('h-empty', isEmpty && !filled);
        el.classList.toggle('h-won', isEmpty && filled);
        el.style.animationDelay = isEmpty && filled ? ((idx - (SEATS - e)) * 35) + 'ms' : '';
      });
      animateTo(e * f * 12);
    };
    fillBtn.addEventListener('click', function () {
      filled = !filled;
      fillBtn.textContent = filled ? 'Show me again' : 'Fill them';
      fillBtn.setAttribute('aria-pressed', String(filled));
      resLabel.textContent = filled ? 'Filled, that’s' : 'Empty spaces cost you';
      shown = 0; update();
    });
    empty.addEventListener('input', update);
    fee.addEventListener('input', update);
    update();
  }

  /* ---------- 4. One question open at a time ---------- */
  var ds = [].slice.call(document.querySelectorAll('.h-faq details'));
  ds.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) ds.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
})();
