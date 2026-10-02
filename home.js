/* one — the homepage's own behaviour, on top of script.js and hero.js.
 *
 * 1. The nav follows the tone of the section under it (dark glass over the
 *    dark sections, white glass over the light ones), and its pill is
 *    outlined while the hero is on screen, filled after.
 * 2. Any rail with [data-rail] steps by a card when its prev and next
 *    buttons are pressed (the review rail keeps its own code in script.js).
 * 3. The "any trade" search types through the trades, lighting the
 *    matching pill; typing filters the pills; Enter opens the match.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. The nav's tone ---------- */
  var nav = document.getElementById('nav');
  var hero = document.querySelector('.hh');
  if (nav) {
    var toned = [].slice.call(document.querySelectorAll('main [data-tone], footer[data-tone]'));
    var ticking = false;
    function paintNav() {
      ticking = false;
      var line = nav.offsetHeight + 1;
      var tone = 'light';
      for (var i = 0; i < toned.length; i++) {
        var r = toned[i].getBoundingClientRect();
        if (r.top <= line && r.bottom > line) { tone = toned[i].getAttribute('data-tone') === 'dark' ? 'dark' : 'light'; break; }
      }
      if (nav.getAttribute('data-tone') !== tone) nav.setAttribute('data-tone', tone);
      if (hero) {
        var hr = hero.getBoundingClientRect();
        nav.classList.toggle('is-hero', hr.bottom > line + 80);
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paintNav); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    paintNav();
  }

  /* ---------- 2. Rails with their own buttons ---------- */
  document.querySelectorAll('[data-rail]').forEach(function (rail) {
    var section = rail.closest('section') || document;
    section.querySelectorAll('[data-rail-dir]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = rail.firstElementChild;
        var step = card ? card.getBoundingClientRect().width + 22 : rail.clientWidth * 0.8;
        rail.scrollBy({ left: step * Number(btn.dataset.railDir), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  });

  /* ---------- 3. Any trade ---------- */
  var form = document.getElementById('abSearch');
  var input = document.getElementById('abInput');
  var pills = [].slice.call(document.querySelectorAll('#abPills .pill'));
  if (form && input && pills.length) (function () {
    var TRADES = ['Barbers', 'Salons', 'Trades', 'Coffee shops', 'Gyms', 'Cleaners', 'Tutors', 'Photographers', 'Gardeners', 'Dance schools'];
    var i = 0, typing = true, timer = null, visible = false;

    function match(text) {
      var q = String(text || '').trim().toLowerCase();
      if (!q) return null;
      for (var k = 0; k < pills.length; k++) {
        var hay = (pills[k].textContent + ' ' + (pills[k].dataset.trade || '')).toLowerCase();
        if (hay.indexOf(q) !== -1) return pills[k];
      }
      return null;
    }
    function light(el, filter) {
      pills.forEach(function (p) {
        p.classList.toggle('is-on', p === el);
        p.classList.toggle('is-off', !!filter && !!input.value.trim() && p !== el && !((p.textContent + ' ' + (p.dataset.trade || '')).toLowerCase().indexOf(input.value.trim().toLowerCase()) !== -1));
      });
    }

    /* The demo: the placeholder types itself, one trade after another, and
       the matching pill lights. It stops the moment someone types. */
    function type(text, at) {
      if (!typing) return;
      input.placeholder = text.slice(0, at);
      if (at === 1) light(match(text));
      if (at < text.length) timer = setTimeout(function () { type(text, at + 1); }, 70);
      else timer = setTimeout(erase, 1500);
    }
    function erase() {
      if (!typing) return;
      var t = input.placeholder;
      if (t.length) { input.placeholder = t.slice(0, -1); timer = setTimeout(erase, 32); }
      else { i = (i + 1) % TRADES.length; timer = setTimeout(function () { type(TRADES[i], 0); }, 300); }
    }
    function start() {
      if (reduce || !typing || timer) return;
      form.classList.add('is-typing');
      timer = setTimeout(erase, 1400);
    }
    function stop() {
      typing = false;
      clearTimeout(timer); timer = null;
      form.classList.remove('is-typing');
      input.placeholder = 'Type your trade';
    }
    light(match(input.placeholder));
    if (!reduce) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          visible = es[0].isIntersecting;
          if (visible) start();
        }, { threshold: 0.3 }).observe(form);
      } else { start(); }
    }

    input.addEventListener('focus', stop);
    input.addEventListener('input', function () {
      stop();
      light(match(input.value), true);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var hit = match(input.value);
      if (hit) { location.href = hit.getAttribute('href'); return; }
      /* No page for that trade yet: straight to the free-page form, with
         what they typed as the start of the name. */
      var name = document.getElementById('newName');
      var free = document.getElementById('newFree');
      if (free) free.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      if (name && !name.value) name.value = '';
      setTimeout(function () { if (name) name.focus({ preventScroll: true }); }, 500);
    });
    /* Hovering a pill lights it, the way the typed one is lit. */
    pills.forEach(function (p) {
      p.addEventListener('mouseenter', function () { if (!typing) light(p); });
    });
  })();
})();
