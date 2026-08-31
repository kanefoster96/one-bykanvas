/* one — by Kanvas */
(function () {
  'use strict';

  /* ---------- Start at the top on reload ---------- */
  // Browsers restore the previous scroll position on reload, which drops you
  // mid-page instead of at the top.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Menu ---------- */
  // One source of truth for the nav. Pages only need an empty #menu element;
  // the header itself stays in the markup so it renders without JavaScript.
  var MENU = [
    { label: 'How it works',    href: '/how-it-works.html' },
    { label: "What\u2019s included", href: '/whats-included.html' },
    { label: 'Features',        href: '/features.html' },
    { label: 'Reviews',         href: '/reviews.html' },
    { label: 'See all plans',   href: '/plans.html' },
    { label: 'Contact',         href: '/contact.html' }
  ];

  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  var scrim = document.getElementById('scrim');

  if (menu && !menu.children.length) {
    var here = location.pathname.replace(/\/index\.html$/, '/');
    var nav = document.createElement('nav');
    nav.className = 'menu-inner';
    nav.setAttribute('aria-label', 'Main');

    MENU.forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'menu-link';
      a.href = item.href;
      a.textContent = item.label;
      if (item.href === here) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });

    var actions = document.createElement('div');
    actions.className = 'menu-actions';

    var signedIn = window.ONE_SESSION && window.ONE_SESSION.email();
    actions.innerHTML = signedIn
      ? '<a class="btn btn-ghost" href="/account.html">Your account</a>' +
        '<button class="btn btn-primary" type="button" id="navLogout">Log out</button>'
      : '<a class="btn btn-ghost" href="/login.html">Log in</a>' +
        '<a class="btn btn-primary" href="/get-started.html">Get started</a>';
    nav.appendChild(actions);
    menu.appendChild(nav);

    var navLogout = document.getElementById('navLogout');
    if (navLogout) {
      navLogout.addEventListener('click', function () {
        navLogout.disabled = true;
        navLogout.textContent = 'Logging out…';
        Promise.resolve(window.ONE_SESSION.logOut()).then(function () {
          location.href = '/';
        });
      });
    }
  }

  if (burger && menu && scrim) {
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    scrim.hidden = !open;
    menu.classList.toggle('open', open);
    document.body.classList.toggle('locked', open);
  }

  burger.addEventListener('click', function () {
    setMenu(burger.getAttribute('aria-expanded') !== 'true');
  });
  scrim.addEventListener('click', function () { setMenu(false); });
  menu.addEventListener('click', function (e) {
    // Closes on any item. The items do nothing else yet — they are placeholders
    // until the pages exist.
    if (e.target.closest('button, a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      burger.focus();
    }
  });
  }

  /* ---------- Scroll reveal ---------- */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Feature marquee ---------- */
  // Four items per row is narrower than the screen, so each row is duplicated
  // until it is at least twice the viewport wide. The animation then shifts by
  // half the track, which lands exactly on a copy boundary and loops seamlessly.
  var SPEED = 26;   // pixels per second — slow enough to read

  function startMarquee() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.querySelectorAll('.mq-track').forEach(function (track) {
      var row = track.parentElement;
      var originals = Array.prototype.slice.call(track.children);
      if (!originals.length || track.dataset.built) return;

      var setWidth = track.scrollWidth;
      if (!setWidth || !row.offsetWidth) return;

      // enough copies to cover two screens, rounded up to an even number
      var copies = Math.ceil((row.offsetWidth * 2) / setWidth);
      if (copies % 2) copies++;
      copies = Math.max(copies, 2);

      for (var n = 1; n < copies; n++) {
        originals.forEach(function (el) {
          var clone = el.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');   // duplicates are decoration
          track.appendChild(clone);
        });
      }

      // same speed on every row regardless of how wide it ended up
      track.style.animationDuration = ((track.scrollWidth / 2) / SPEED) + 's';
      track.dataset.built = '1';
      track.classList.add('is-running');
    });
  }

  startMarquee();

  /* ---------- Review rail ---------- */
  var rail = document.getElementById('rail');
  if (rail) document.querySelectorAll('.rail-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = rail.querySelector('.quote');
      var step = card ? card.offsetWidth + 20 : rail.clientWidth * 0.8;
      rail.scrollBy({ left: step * Number(btn.dataset.dir), behavior: 'smooth' });
    });
  });

  /* ---------- FAQ: one open at a time ---------- */
  var faqs = document.querySelectorAll('.faq details');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqs.forEach(function (other) { if (other !== d) other.open = false; });
    });
  });

  /* ---------- Lead form ---------- */
  var form = document.getElementById('lead');
  var note = document.getElementById('formnote');

  if (form && note) form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var required = ['name', 'business', 'email'];
    var bad = false;

    required.forEach(function (id) {
      var el = document.getElementById(id);
      var ok = el.value.trim() !== '';
      if (id === 'email') ok = ok && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
      el.classList.toggle('err', !ok);
      if (!ok && !bad) { el.focus(); bad = true; }
    });

    if (bad) {
      note.textContent = 'Please fill in your name, business and a valid email.';
      note.className = 'formnote bad';
      return;
    }

    /* The plan <select> shows prices ("Pro — £120/month"); the endpoint wants
       the plan key. Read the option's position rather than parsing its text,
       so a price change never quietly stops this matching. */
    var planEl = document.getElementById('plan');
    var PLAN_KEYS = ['business', 'pro', 'max', 'unsure'];

    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    note.textContent = 'Sending…';
    note.className = 'formnote';

    try {
      var res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('name').value.trim(),
          business: document.getElementById('business').value.trim(),
          email: document.getElementById('email').value.trim(),
          plan: PLAN_KEYS[planEl.selectedIndex] || 'unsure',
          about: document.getElementById('about').value.trim(),
          wantApp: document.getElementById('wantapp').checked
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');

      note.textContent = 'Thanks — we’ll be in touch within one working day.';
      note.className = 'formnote ok';
      form.reset();

      /* Fires only if they accepted cookies; a no-op otherwise. No name or
         email goes with it - the plan is all Meta needs to optimise on. */
      if (window.oneTrack) window.oneTrack('Lead', {
        content_category: PLAN_KEYS[planEl.selectedIndex] || 'unsure'
      });
    } catch (err) {
      note.textContent = err.message || 'Could not send that. Try again.';
      note.className = 'formnote bad';
    }
    if (btn) btn.disabled = false;
  });

  /* ---------- Year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
