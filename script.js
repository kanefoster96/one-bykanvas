/* one — by Kanvas */
(function () {
  'use strict';

  /* ---------- Start at the top on reload ---------- */
  // Browsers restore the previous scroll position on reload, which drops you
  // mid-page instead of at the top.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Hero: the last word types itself ---------- */
  // "Websites for trades." — the trade holds for a moment, deletes
  // quickly and retypes as another kind of business. The markup ships with
  // "trades" already in place, so without JavaScript (or with reduced motion
  // switched on) the line still reads as a finished sentence. The hero is
  // centred text, so the line recenters itself as letters come and go.
  (function () {
    var word = document.getElementById('heroTrade');
    if (!word) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var TRADES = ['trades', 'salons', 'cafés', 'gyms', 'barbers', 'cleaners',
                  'florists', 'tutors', 'coaches', 'startups'];
    var i = 0;

    function type(text, at) {
      word.textContent = text.slice(0, at);
      if (at < text.length) setTimeout(function () { type(text, at + 1); }, 75);
      else setTimeout(erase, 1400);
    }
    function erase() {
      var t = word.textContent;
      if (t.length) {
        word.textContent = t.slice(0, -1);
        setTimeout(erase, 35);
      } else {
        i = (i + 1) % TRADES.length;
        setTimeout(function () { type(TRADES[i], 0); }, 260);
      }
    }
    // The first word is already on the page; let it sit, then start cycling.
    setTimeout(erase, 1600);
  })();

  /* ---------- Monthly / annual billing toggle ---------- */
  // Annual is ten months' money for twelve - "2 months free", never "-17%".
  // The choice is stashed so the wizard's payment step opens on the same
  // billing the plans page was showing when they decided.
  (function () {
    var toggles = document.querySelectorAll('.bill-toggle');
    if (!toggles.length) return;

    var KEY = 'one-billing';
    function current() {
      try { return localStorage.getItem(KEY) === 'annual' ? 'annual' : 'monthly'; }
      catch (e) { return 'monthly'; }
    }

    function apply(mode) {
      document.querySelectorAll('.bill-opt').forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.bill === mode);
      });
      document.querySelectorAll('.price[data-y]').forEach(function (p) {
        var amount = mode === 'annual' ? p.dataset.y : p.dataset.m;
        var per = mode === 'annual' ? '/year' : '/month';
        p.innerHTML = '<span class="cur">£</span>' + amount + '<span class="per">' + per + '</span>';
      });
    }

    toggles.forEach(function (t) {
      t.addEventListener('click', function (e) {
        var btn = e.target.closest('.bill-opt');
        if (!btn) return;
        try { localStorage.setItem(KEY, btn.dataset.bill); } catch (e2) {}
        apply(btn.dataset.bill);
      });
    });

    apply(current());
  })();

  /* ---------- Menu ---------- */
  // One source of truth for the nav. Pages only need an empty #menu element;
  // the header itself stays in the markup so it renders without JavaScript.
  var MENU = [
    { label: 'Try it free',     href: '/free.html' },
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
    items.forEach(function (el) {
      /* A block taller than the screen can never have 12% of itself visible,
         so the observer never fires and the whole thing stays invisible -
         which is how the terms and privacy pages went blank on phones.
         Anything that big just shows; the entrance animation only ever
         made sense for card-sized pieces. */
      if (el.getBoundingClientRect().height > window.innerHeight * 0.9) {
        el.classList.add('in');
        return;
      }
      io.observe(el);
    });
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

  /* ---------- Typed request demo ---------- */
  // Types example requests into the pill under "If you need it, we'll build
  // it", holds each one, deletes it and types the next - a preview of how
  // asking actually works. Decorative (the box is aria-hidden), paused while
  // off screen, and reduced motion gets the first request standing still.
  var typeEl = document.getElementById('typeDemo');
  if (typeEl) (function () {
    /* Deliberately a mix of big and small: a whole feature next to a
       ten-second edit teaches that both are things you just ask for. */
    var LINES = [
      'build a live food menu',
      'update my opening hours',
      'add a log in for customers',
      'take deposits for bookings',
      'set up online payments',
      "add this week's specials",
      'add a live chat feature',
      'show off my 5-star reviews',
      'add a gift voucher shop'
    ];

    /* Industry pages carry their own trade-specific requests in a data
       attribute; the list above is the default for the homepage. */
    try {
      var custom = JSON.parse(typeEl.getAttribute('data-lines') || 'null');
      if (custom && custom.length) LINES = custom;
    } catch (e) { /* malformed attribute: keep the defaults */ }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typeEl.textContent = LINES[0];
      return;
    }

    var line = 0, chars = 0, deleting = false;
    var visible = true, timer = null;

    function step() {
      var text = LINES[line];
      var delay;

      if (!deleting) {
        chars++;
        typeEl.textContent = text.slice(0, chars);
        if (chars === text.length) {
          deleting = true;
          delay = 1400;                              // read it
        } else {
          delay = 46 + Math.random() * 54;           // human-ish typing
        }
      } else {
        chars--;
        typeEl.textContent = text.slice(0, chars);
        if (chars === 0) {
          deleting = false;
          line = (line + 1) % LINES.length;
          delay = 480;                               // breath before the next
        } else {
          delay = 26;                                // deleting is quick
        }
      }

      timer = setTimeout(function () { if (visible) step(); else timer = null; }, delay);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && timer === null) step();
        // timer !== null: the pending tick sees visible and carries on.
      }, { threshold: 0.1 }).observe(typeEl.parentElement);
      timer = setTimeout(function () { if (visible) step(); else timer = null; }, 600);
    } else {
      step();
    }
  })();

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
  /* When the form first existed, so the endpoint can see how long it took to
     fill in. Read at load rather than at first keystroke: a bot may never
     dispatch one. */
  var formShownAt = Date.now();
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

    /* The plan <select> shows prices ("Max — £250/month"); the endpoint wants
       the plan key. Read the option's position rather than parsing its text,
       so a price change never quietly stops this matching. */
    var planEl = document.getElementById('plan');
    var PLAN_KEYS = ['business', 'max', 'unsure'];
    /* Read once, before form.reset() puts the select back to its first
       option - the tracking call below runs after the reset. */
    var pickedPlan = PLAN_KEYS[planEl.selectedIndex] || 'unsure';

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
          plan: pickedPlan,
          about: document.getElementById('about').value.trim(),
          website: (document.getElementById('lead_extra') || {}).value || '',
          elapsed: Date.now() - formShownAt
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
        content_category: pickedPlan
      });
    } catch (err) {
      note.textContent = err.message || 'Could not send that. Try again.';
      note.className = 'formnote bad';
    }
    if (btn) btn.disabled = false;
  });


  /* ---------- Hero clips ----------
   *
   * The frame shows still screenshots by default. Name a clip here and it
   * takes that slot instead, so a site's banner, ticker or flashing dot is
   * visible in the preview rather than frozen.
   *
   * One entry per shot, in the order they appear in the markup; an empty
   * string leaves that one as a still. Leave both lists empty - the default -
   * and nothing below runs and nothing extra is fetched.
   *
   * MP4, H.264, no audio track. Not GIF: five seconds of a page at any decent
   * frame rate is megabytes as a GIF and a couple of hundred kilobytes as a
   * video, for better colour.
   */
  var HERO_CLIPS = {
    wide:  ['', '', '', ''],
    phone: ['', '', '']
  };

  function heroClips() {
    var frame = document.querySelector('.device-shots');
    if (!frame) return;

    /* Reasons not to, all decided before a single byte is fetched. Someone who
       has asked for less motion, or is watching their data, gets the stills -
       which is the whole point of the stills still being here. */
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saving = navigator.connection && navigator.connection.saveData;
    if (still || saving) return;

    var swapped = [];

    Object.keys(HERO_CLIPS).forEach(function (set) {
      var holder = frame.querySelector('.shots-' + set);
      if (!holder) return;
      var shots = [].slice.call(holder.children);

      HERO_CLIPS[set].forEach(function (src, i) {
        var img = shots[i];
        if (!src || !img || img.tagName !== 'IMG') return;

        var video = document.createElement('video');
        /* The still becomes the poster, so the frame looks exactly as it does
           now until the clip has enough to play - and stays that way for good
           if the file is missing or the browser refuses to autoplay. Nothing
           to detect and nothing to fall back to: the fallback is the default. */
        video.poster = img.getAttribute('src');
        video.src = src;
        video.muted = true;              // required, or no browser will autoplay
        video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;        // iOS opens it fullscreen without this
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.setAttribute('aria-hidden', 'true');
        video.preload = 'none';          // the observer below decides when
        video.tabIndex = -1;

        img.parentNode.replaceChild(video, img);
        swapped.push(video);
      });
    });

    if (!swapped.length) return;

    /* Nothing loads or plays until the frame is actually on screen, and it all
       stops again when it is not. The hero is off screen for most of a visit,
       and four videos decoding behind the footer is battery spent on something
       nobody is looking at. */
    function start() {
      swapped.forEach(function (v) {
        v.preload = 'auto';
        var p = v.play();
        /* Low Power Mode on iOS refuses autoplay outright. That is not an
           error to report - it is the poster doing its job. */
        if (p && p.catch) p.catch(function () {});
      });
    }
    function stop() { swapped.forEach(function (v) { v.pause(); }); }

    if (!('IntersectionObserver' in window)) return start();
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.1 }).observe(frame);
  }

  heroClips();

  /* ---------- Year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
