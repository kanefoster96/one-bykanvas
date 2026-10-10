/* one — join: paid first, four steps.
 *
 *   1. The business name, then a free web address for it: three suggestions,
 *      or one they type and check. Something real to own on the first page.
 *   2. What the site can do: Starter's features as cards to pick, all
 *      included, and a Business card below that upgrades the plan (everything
 *      picked so far is kept).
 *   3. What they already have, optional: their socials, a booking page or
 *      site, and up to 20 photos or screenshots, uploaded straight to storage
 *      as they are chosen.
 *   4. Their email (their login), and once it is in, the price and the pay
 *      button. Then Stripe, which sends them back here with ?paid=<session>,
 *      and a last card asks for a password: the account is made after the
 *      money, not before (api/join.js has the why).
 *
 * What they type is kept in sessionStorage, so a cancelled payment comes back
 * to a filled-in form rather than an empty one.
 */
(function () {
  'use strict';

  var KEEP = 'one.join';
  var LAST = 4;
  var MAX_FILES = 20;

  var $ = function (id) { return document.getElementById(id); };
  var track = $('track');
  var steps = Array.prototype.slice.call(track.querySelectorAll('.wiz-step'));
  var current = 1;
  var q = new URLSearchParams(location.search);

  function say(el, msg, kind) { el.textContent = msg || ''; el.className = 'note' + (kind ? ' ' + kind : ''); }

  /* How far this visit got, for the Analytics tab (beacon.js): an example
     page marks 1 and 2, this page 3 to 10. Once per visit each. */
  function step(n, label) { (window.k1q = window.k1q || []).push([n, label]); }
  function whenBeacon(fn) {
    if (window.k1 && window.k1.payment) { fn(); return; }
    window.addEventListener('load', function () { if (window.k1 && window.k1.payment) fn(); });
  }

  /* ---------------------------------------------------------- memory */
  var answers = {};
  try { answers = JSON.parse(sessionStorage.getItem(KEEP) || '{}') || {}; } catch (e) { answers = {}; }
  if (!Array.isArray(answers.features)) answers.features = [];
  if (!Array.isArray(answers.files)) answers.files = [];
  function keep() { try { sessionStorage.setItem(KEEP, JSON.stringify(answers)); } catch (e) {} }

  /* Their trade, from the ad (?trade=): only to suggest better addresses,
     never saved as what they do. */
  var trade = String(q.get('trade') || '').toLowerCase();
  if (!/^[a-z]{2,20}$/.test(trade)) trade = '';

  /* Meta's click id, when an ad lands straight here, kept as an fbc value
     for the Lead and Purchase the server sends. */
  try {
    var clickId = q.get('fbclid');
    if (clickId && !sessionStorage.getItem('one.fbc')) sessionStorage.setItem('one.fbc', 'fb.1.' + Date.now() + '.' + clickId);
  } catch (e) {}

  var fromLink = String(q.get('business') || '').trim().slice(0, 120);
  if (fromLink) answers.business = fromLink;

  /* A referral link (?ref=) or a partner's offer, carried exactly as the
     get-started wizard does, so a code from a link still counts here. */
  function referralCode() {
    try { return localStorage.getItem('one-ref') || ''; } catch (e) { return ''; }
  }
  function offerCode() {
    return (window.ONE_SESSION && window.ONE_SESSION.offerCode && window.ONE_SESSION.offerCode()) || '';
  }
  try {
    var ref = q.get('ref');
    if (ref) localStorage.setItem('one-ref', ref.toUpperCase().slice(0, 20));
  } catch (e) {}

  /* ---------------------------------------------------------- plans
     Prices as api/_plans.js has them. Business's first month is half price
     (the WELCOME26 code checkout applies to monthly Business). */
  var PRICES = {
    starter:  { month: 9.99, year: 99,  first: 9.99 },
    business: { month: 49,   year: 490, first: 24.5 }
  };
  function plan() { return answers.plan === 'business' ? 'business' : 'starter'; }
  function money(n) { return '£' + (n % 1 ? n.toFixed(2) : String(n)); }

  /* Starter's features: built on every site anyway, so picking them costs
     nothing and tells the team what to put first. Keys go to the server;
     api/join.js has the same list. */
  var FEATURES = [
    ['booking', 'Booking request form', 'Customers ask for a date and time'],
    ['quote', 'Free quote form', 'Job details and photos, sent to you'],
    ['contact', 'Contact page', 'Your details, hours and a map'],
    ['call', 'Click to call & email', 'One tap from any page'],
    ['services', 'Services & prices', 'What you do and what it costs'],
    ['reviews', 'Reviews', 'What your customers say about you'],
    ['team', 'Meet the team', 'The faces behind the business'],
    ['gallery', 'Photo gallery', 'Your best work, front and centre'],
    ['areas', 'Areas you cover', 'Every town you work in'],
    ['social', 'Social media links', 'Instagram, Facebook and TikTok']
  ];
  var BUSINESS = [
    'Booking calendar with automatic confirmations',
    'Take payments and deposits online',
    'Memberships and subscriptions',
    'Live chat on your site',
    'Reviews asked for automatically',
    'Changes made within 48 hours'
  ];

  /* ---------------------------------------------------------- navigation */
  function show(n) {
    current = n;
    steps.forEach(function (s) { s.hidden = Number(s.dataset.step) !== n; });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      track.classList.remove('slide');
      void track.offsetWidth;
      track.classList.add('slide');
    }
    $('wizTop').hidden = n > LAST;
    if (n <= LAST) {
      $('stepNow').textContent = String(n);
      $('bar').style.width = Math.round((n / LAST) * 100) + '%';
    }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.querySelectorAll('.join-steps li').forEach(function (li, i) {
      li.classList.toggle('is-on', i + 1 === n);
      li.classList.toggle('is-done', i + 1 < n);
    });
    if (n === 4) paintPay();
    if (window.oneGuide) guideChanged();
    /* The step's heading takes focus, not its first box: a box would pop
       the phone's keyboard up over the step before they have read it. */
    var head = steps[n - 1].querySelector('h1');
    if (head && n > 1) { try { head.focus({ preventScroll: true }); } catch (e) {} }
  }

  track.addEventListener('click', function (e) {
    if (e.target.closest('[data-back]')) { show(Math.max(1, current - 1)); return; }
    if (e.target.closest('[data-next]')) advance();
  });
  // Enter moves on rather than submitting from the first three steps.
  track.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    if (e.target.id === 'domOwn') { e.preventDefault(); checkTyped(); return; }
    if (current > 3) return;
    e.preventDefault();
    advance();
  });

  function advance() {
    if (current === 1) {
      var biz = $('j_business').value.trim();
      if (biz.length < 2) { say($('note1'), 'Add your business name.', 'bad'); $('j_business').focus(); return; }
      if (!answers.domain) { say($('note1'), 'Pick a web address, or type the one you want.', 'bad'); return; }
      say($('note1'), '');
      answers.business = biz;
      keep();
      tellMetaLead();
      step(4, 'Picked a web address');
      show(2);
      return;
    }
    if (current === 2) {
      keep();
      step(5, plan() === 'business' ? 'Chose Business' : 'Chose their features');
      show(3);
      return;
    }
    if (current === 3) {
      answers.social = $('j_social').value.trim();
      answers.link = $('j_link').value.trim();
      keep();
      if (answers.social || answers.link || answers.files.length) step(6, 'Shared links or photos');
      show(4);
    }
  }

  /* A name and a web address chosen is a lead: Meta hears it from the
     browser (with cookies accepted) and from our server (always), under one
     event id so it counts once. Once per visit. The click id from the ad
     (fbclid, kept by ex.js or above) lets Meta tie it to the ad. */
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function tellMetaLead() {
    try { if (sessionStorage.getItem('one.join-lead')) return; sessionStorage.setItem('one.join-lead', '1'); } catch (e) {}
    var id = 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    if (window.oneTrack) window.oneTrack('Lead', { content_category: 'join' }, id);
    var fbc = cookie('_fbc');
    if (!fbc) { try { fbc = sessionStorage.getItem('one.fbc') || ''; } catch (e) {} }
    try {
      fetch('/api/join', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lead', eventId: id, fbc: fbc, fbp: cookie('_fbp') })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------------------------------------------------------- 1. addresses
     Three free ones for the name as they type it, or one they type. */
  var domainsFor = '';
  var domTimer = null;

  function domainRow(domain, checked) {
    var label = document.createElement('label');
    label.className = 'pick-row' + (checked ? ' is-on' : '');
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'domain';
    input.value = domain;
    input.checked = Boolean(checked);
    var main = document.createElement('span');
    main.className = 'pick-main';
    var head = document.createElement('span');
    head.className = 'pick-head';
    var b = document.createElement('b');
    b.textContent = domain;
    var em = document.createElement('em');
    em.className = 'dom-free';
    em.textContent = 'Free';
    head.appendChild(b);
    head.appendChild(em);
    main.appendChild(head);
    label.appendChild(input);
    label.appendChild(main);
    return label;
  }

  function paintDomains(list) {
    var wrap = $('domList');
    wrap.textContent = '';
    wrap.removeAttribute('aria-busy');
    if (answers.domain && list.indexOf(answers.domain) === -1) list = [answers.domain].concat(list).slice(0, 3);
    list.forEach(function (d, i) {
      wrap.appendChild(domainRow(d, answers.domain ? d === answers.domain : i === 0));
    });
    var on = wrap.querySelector('input:checked');
    answers.domain = on ? on.value : '';
    keep();
  }

  function noDomains(message) {
    var wrap = $('domList');
    wrap.textContent = '';
    wrap.removeAttribute('aria-busy');
    $('domState').textContent = message;
    $('domState').hidden = false;
  }

  function askDomains(name) {
    if (domainsFor === name) return;
    domainsFor = name;
    $('domBlock').hidden = false;
    $('domState').hidden = true;
    var wrap = $('domList');
    wrap.setAttribute('aria-busy', 'true');
    wrap.innerHTML = '<div class="pick-row is-waiting"><span class="dom-bar"></span><span class="dom-searching">Finding free addresses&hellip;</span></div>'
      + '<div class="pick-row is-waiting"><span class="dom-bar"></span></div>'
      + '<div class="pick-row is-waiting"><span class="dom-bar"></span></div>';
    fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'suggest', business: name, business_type: trade })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (domainsFor !== name) return;   // they have typed on since
        var list = (res.ok && res.d && res.d.suggestions) || [];
        if (list.length) { paintDomains(list.slice(0, 3)); return; }
        noDomains(res.d && res.d.reachable === false
          ? 'We could not check addresses just now. Type the one you want below.'
          : 'The obvious ones are taken. Type the address you want below and we will check it.');
      })
      .catch(function () {
        if (domainsFor !== name) return;
        domainsFor = '';
        noDomains('We could not check addresses just now. Type the one you want below.');
      });
  }

  $('j_business').addEventListener('input', function () {
    var name = this.value.trim();
    clearTimeout(domTimer);
    say($('note1'), '');
    if (name.length < 2) return;
    /* A new name asks for new addresses: the old three were for the old
       name. One they typed themselves stays. */
    if (answers.business !== name && !answers.ownDomain) answers.domain = '';
    answers.business = name;
    keep();
    domTimer = setTimeout(function () { askDomains(name); }, 600);
  });

  $('domList').addEventListener('change', function (e) {
    if (!e.target.matches('input[name="domain"]')) return;
    answers.domain = e.target.value;
    keep();
    $('domList').querySelectorAll('.pick-row').forEach(function (r) {
      r.classList.toggle('is-on', r.querySelector('input').checked);
    });
    say($('note1'), '');
  });

  function tidy(raw) {
    return String(raw || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').replace(/\s+/g, '');
  }

  function checkTyped() {
    var d = tidy($('domOwn').value);
    var note = $('domOwnNote');
    if (!d) { note.textContent = 'Type an address first, like yourbusiness.co.uk.'; return; }
    if (d.indexOf('.') === -1) d += '.co.uk';
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,63})+$/.test(d)) { note.textContent = 'That does not look like a web address.'; return; }
    note.textContent = 'Checking ' + d + '…';
    $('domCheck').disabled = true;
    fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', domain: d })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.state === 'taken') { note.textContent = d + ' is taken. Try another.'; return; }
        if (res.state === 'pricey') { note.textContent = res.message || 'That ending is not included. Try .co.uk, .com or .uk.'; return; }
        note.textContent = res.state === 'free'
          ? d + ' is free. It’s yours, included with your website.'
          : 'We could not confirm ' + d + ' just now. We will check it by hand before we register it.';
        var list = Array.prototype.map.call($('domList').querySelectorAll('input[name="domain"]'), function (i) { return i.value; });
        answers.domain = d;
        answers.ownDomain = true;
        paintDomains([d].concat(list.filter(function (x) { return x !== d; })).slice(0, 3));
        $('domState').hidden = true;
        say($('note1'), '');
      })
      .catch(function () { note.textContent = 'We could not check just now. Try again in a moment.'; })
      .then(function () { $('domCheck').disabled = false; });
  }
  $('domCheck').addEventListener('click', checkTyped);

  /* ---------------------------------------------------------- 2. features */
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function paintFeatures() {
    var grid = $('featGrid');
    grid.innerHTML = '';
    FEATURES.forEach(function (f) {
      var on = answers.features.indexOf(f[0]) >= 0;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'feat' + (on ? ' is-on' : '');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.dataset.key = f[0];
      b.innerHTML = '<span class="feat-tick">' + TICK + '</span><b></b><small></small><em>Free</em>';
      b.querySelector('b').textContent = f[1];
      b.querySelector('small').textContent = f[2];
      grid.appendChild(b);
    });
  }
  $('featGrid').addEventListener('click', function (e) {
    var b = e.target.closest('.feat');
    if (!b) return;
    var k = b.dataset.key, i = answers.features.indexOf(k);
    if (i >= 0) answers.features.splice(i, 1); else answers.features.push(k);
    var on = i < 0;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    keep();
  });

  function paintBusiness() {
    var list = $('bizList');
    if (!list.children.length) BUSINESS.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; list.appendChild(li); });
    var on = plan() === 'business';
    $('bizCard').classList.toggle('is-on', on);
    $('bizBtn').setAttribute('aria-checked', on ? 'true' : 'false');
    $('bizState').textContent = on ? 'On · first month £24.50' : 'Everything you picked stays';
  }
  $('bizBtn').addEventListener('click', function () {
    answers.plan = plan() === 'business' ? 'starter' : 'business';
    keep();
    paintBusiness();
  });

  /* ---------------------------------------------------------- 3. uploads
     Each photo goes straight to storage as it is chosen, through a one-off
     upload link from /api/join, so twenty phone photos never pass through
     one request. Big photos are shrunk first. The list is kept for the
     visit and sent with the details when they press pay. */
  var FT = 'one.join.ft';
  var fileToken = '';
  try { fileToken = sessionStorage.getItem(FT) || ''; } catch (e) {}
  if (!/^[a-z0-9]{24}$/.test(fileToken)) {
    fileToken = '';
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789', buf = new Uint8Array(24);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
    for (var ci = 0; ci < 24; ci++) fileToken += chars[(buf[ci] || Math.floor(Math.random() * 256)) % chars.length];
    try { sessionStorage.setItem(FT, fileToken); } catch (e) {}
  }
  var uploading = 0;

  function paintFiles() {
    var grid = $('upGrid');
    grid.innerHTML = '';
    answers.files.forEach(function (f, i) {
      var cell = document.createElement('div');
      cell.className = 'shot';
      var img = document.createElement('img');
      img.src = f.url; img.alt = f.name || ('Photo ' + (i + 1)); img.loading = 'lazy';
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'shot-x'; del.setAttribute('aria-label', 'Remove ' + (f.name || 'photo ' + (i + 1))); del.textContent = '×';
      del.addEventListener('click', function () { answers.files.splice(i, 1); keep(); paintFiles(); });
      cell.appendChild(img); cell.appendChild(del);
      grid.appendChild(cell);
    });
    var left = MAX_FILES - answers.files.length - uploading;
    document.querySelector('.up-drop').hidden = left <= 0;
    $('upCount').textContent = answers.files.length
      ? answers.files.length + ' added · ' + Math.max(0, left) + ' more allowed'
      : 'Up to 20, from your camera roll';
  }

  /* Photos over 2.5 MB or 2400px come down to a JPEG that size; small ones,
     logos with see-through backgrounds included, go as they are. */
  function prepare(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 2.5 * 1024 * 1024) { resolve(file); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 2400 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function uploadOne(file) {
    return prepare(file).then(function (f) {
      return fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload', token: fileToken, type: f.type || 'image/jpeg' })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Could not upload.');
          if (!(window.ONE && window.ONE.db)) throw new Error('Could not upload.');
          return window.ONE.db.storage.from('photos').uploadToSignedUrl(res.d.path, res.d.token, f, { contentType: f.type || 'image/jpeg' })
            .then(function (out) {
              if (out.error) throw new Error(out.error.message);
              return { path: res.d.path, url: res.d.url, name: String(file.name || '').slice(0, 80) };
            });
        });
    });
  }

  $('j_files').addEventListener('change', function () {
    var room = MAX_FILES - answers.files.length - uploading;
    var picked = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!picked.length) return;
    var files = picked.slice(0, Math.max(0, room));
    var over = picked.length - files.length;
    if (!files.length) { say($('note3'), 'That’s 20 already, the most we take here. Send any more after you join.', 'bad'); return; }
    uploading += files.length;
    $('next3').disabled = true;
    say($('note3'), 'Uploading ' + files.length + (files.length === 1 ? ' photo…' : ' photos…'));
    paintFiles();
    var failed = 0;
    /* Two at a time: quick on wifi, kind to a phone on 4G. */
    var queue = files.slice();
    function next() {
      var f = queue.shift();
      if (!f) return Promise.resolve();
      return uploadOne(f)
        .then(function (done) { answers.files.push(done); keep(); }, function () { failed++; })
        .then(function () { uploading--; paintFiles(); return next(); });
    }
    Promise.all([next(), next()]).then(function () {
      $('next3').disabled = false;
      var bits = [];
      if (failed) bits.push(failed + (failed === 1 ? ' photo' : ' photos') + ' could not be uploaded. Try them again, or send them after you join.');
      if (over) bits.push('We took the first 20.');
      say($('note3'), bits.join(' '), failed ? 'bad' : '');
    });
  });

  /* ---------------------------------------------------------- 4. email, then pay */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function paintPay() {
    var biz = plan() === 'business';
    var save = Math.round((PRICES[plan()].month * 12 - PRICES[plan()].year) * 100) / 100;
    $('billPick').querySelector('.pill-save').textContent = 'Save ' + money(save);
    setBilling(answers.billing);
    var n = answers.features.length;
    var sum = [answers.business, answers.domain, biz ? 'Business' : (n ? n + (n === 1 ? ' feature' : ' features') : 'Starter')].filter(Boolean);
    $('joinSum').textContent = sum.join(' · ');
    emailChanged();
  }
  /* Monthly or yearly: a pill switch, and one price under it for the
     choice, so there is only ever one number to read. */
  function setBilling(which) {
    answers.billing = which === 'annual' ? 'annual' : 'monthly';
    var yearly = answers.billing === 'annual';
    $('billPick').querySelectorAll('[data-bill]').forEach(function (b) {
      b.setAttribute('aria-checked', b.dataset.bill === answers.billing ? 'true' : 'false');
    });
    var p = PRICES[plan()], biz = plan() === 'business';
    $('priceNow').textContent = money(yearly ? p.year : p.month);
    $('priceUnit').textContent = yearly ? '/year' : '/month';
    $('priceNote').textContent = yearly
      ? 'Works out at ' + money(Math.round(p.year / 12 * 100) / 100) + ' a month. One payment, two months free.'
      : biz ? 'First month ' + money(p.first) + ', then ' + money(p.month) + '. Cancel any month.'
        : money(Math.round(p.month * 1200) / 100) + ' a year. Cancel any month.';
    $('payBtn').textContent = 'Pay ' + money(yearly ? p.year : p.first) + ' and go live';
  }
  $('billPick').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bill]');
    if (b) { setBilling(b.dataset.bill); keep(); }
  });
  $('billPick').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setBilling(answers.billing === 'annual' ? 'monthly' : 'annual');
    keep();
    $('billPick').querySelector('[aria-checked="true"]').focus();
  });
  /* The price and the button appear once the email looks right: the email
     first, then the money, one thing at a time. */
  var emailMarked = false;
  function emailChanged() {
    var v = $('j_email').value.trim();
    var ok = EMAIL.test(v);
    $('payBox').hidden = !ok;
    if (ok) {
      answers.email = v;
      keep();
      if (!emailMarked) { emailMarked = true; step(7, 'Entered their email'); }
    }
  }
  $('j_email').addEventListener('input', emailChanged);

  var paying = false;
  track.addEventListener('submit', function (e) {
    e.preventDefault();
    if (current !== 4 || paying) return;
    var email = $('j_email').value.trim();
    if (!EMAIL.test(email)) { say($('note4pay'), 'That email does not look right.', 'bad'); $('j_email').focus(); return; }
    answers.email = email;
    keep();
    paying = true;
    var btn = $('payBtn');
    var was = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Opening secure payment…';
    say($('note4pay'), '');
    step(8, 'Pressed pay');
    var p = PRICES[plan()];
    if (window.oneTrack) {
      window.oneTrack('InitiateCheckout', { content_category: plan(), currency: 'GBP', value: answers.billing === 'annual' ? p.year : p.month });
    }
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        business: answers.business, email: email, domain: answers.domain,
        plan: plan(), features: answers.features,
        social: answers.social || '', link: answers.link || '',
        files: answers.files.map(function (f) { return f.path; }),
        billing: answers.billing || 'monthly',
        offer: offerCode(), referralCode: referralCode(),
        website: $('j_website').value
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); })
      .then(function (res) {
        if (res.ok && res.d.url) { location.href = res.d.url; return; }
        paying = false;
        btn.disabled = false;
        btn.textContent = was;
        var d = res.d;
        if (d.field === 'business' || d.field === 'domain') {
          if (d.code === 'domain_taken') { answers.domain = ''; answers.ownDomain = false; domainsFor = ''; askDomains(answers.business); }
          show(1);
          say($('note1'), d.error, 'bad');
          return;
        }
        if (d.field === 'files') { show(3); say($('note3'), d.error, 'bad'); return; }
        say($('note4pay'), d.error || 'Something went wrong. Please try again.', 'bad');
        if (d.code === 'exists' || d.code === 'paid') $('note4pay').insertAdjacentHTML('beforeend', ' <a href="/login.html">Log in</a>');
      })
      .catch(function () {
        paying = false;
        btn.disabled = false;
        btn.textContent = was;
        say($('note4pay'), 'We could not reach payments just now. Check your connection and try again.', 'bad');
      });
  });

  /* ---------------------------------------------------------- after Stripe */
  var sessionId = String(q.get('paid') || '');
  var accountEmail = '';

  /* Confetti, once, when they have paid. */
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = document.createElement('div');
    box.className = 'join-confetti';
    var colours = ['#1a7f37', '#34c17a', '#5fd18f', '#1d1d1f', '#f5b83d', '#e5484d', '#4f7cff'];
    for (var i = 0; i < 70; i++) {
      var c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colours[i % colours.length];
      c.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (Math.random() * 0.5) + 's';
      c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      c.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      if (i % 3 === 0) { c.style.width = '8px'; c.style.height = '8px'; c.style.borderRadius = '50%'; }
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 4500);
  }

  function afterPayment() {
    show(5);
    $('doneEmail').textContent = 'your email';
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', session: sessionId })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); })
      .then(function (res) {
        var d = res.d;
        if (!res.ok) {
          $('doneHead').textContent = 'We couldn’t find that payment.';
          $('doneSub').textContent = d.error || 'If you have paid, check your email for your welcome message.';
          $('accountBox').hidden = true;
          $('doneLogin').hidden = false;
          return;
        }
        accountEmail = d.email || '';
        $('doneEmail').textContent = accountEmail;
        var paidPlan = d.plan === 'business' ? 'business' : 'starter';
        var price = PRICES[paidPlan];
        if (d.paid) {
          confetti();
          step(9, 'Paid');
          // The payment, tied to this visit in Analytics; the ref keeps a
          // reloaded page to one. What Stripe actually took, discounts and all.
          whenBeacon(function () {
            var pence = typeof d.amount === 'number' ? d.amount : Math.round((d.annual ? price.year : price.month) * 100);
            window.k1.payment({ amount: pence, ref: d.sub || sessionId, email: accountEmail, description: (paidPlan === 'business' ? 'Business' : 'Starter') + ', ' + (d.annual ? 'yearly' : 'monthly') });
          });
        }
        if (d.domain) {
          $('doneSub').textContent = '';
          $('doneSub').append('Our team is building your site. It goes live at ');
          var b = document.createElement('b');
          b.textContent = d.domain;
          $('doneSub').append(b, ' within 24 hours. We’ll email you the moment it is.');
        }
        if (!d.needsAccount) {
          $('accountBox').hidden = true;
          $('doneLogin').hidden = false;
        }
        /* Ad conversion, once per payment however often the page loads. */
        if (d.paid && window.oneTrack) {
          var seen;
          try { seen = localStorage.getItem('one.join-tracked'); } catch (e) {}
          if (seen !== sessionId) {
            try { localStorage.setItem('one.join-tracked', sessionId); } catch (e) {}
            // The same event and id the server sends (stripe-webhook.js), so
            // Meta counts the sale once whether or not cookies were accepted.
            window.oneTrack('Purchase', { currency: 'GBP', value: d.annual ? price.year : price.month, content_name: paidPlan }, d.sub || sessionId);
          }
        }
        try { sessionStorage.removeItem(KEEP); sessionStorage.removeItem(FT); } catch (e) {}
      })
      .catch(function () {
        $('doneSub').textContent = 'Your payment went through. If this page will not load, check your email for your welcome message.';
      });
  }

  $('acctBtn').addEventListener('click', function () {
    var pw = $('j_password').value;
    var note = $('note5');
    if (pw.length < 8) { say(note, 'Use at least 8 characters.', 'bad'); $('j_password').focus(); return; }
    var btn = $('acctBtn');
    btn.disabled = true;
    say(note, 'Making your account…');
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'account', session: sessionId, password: pw })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); })
      .then(function (res) {
        if (!res.ok) {
          btn.disabled = false;
          say(note, res.d.error || 'Something went wrong. Please try again.', 'bad');
          if (res.d.code === 'done') { $('accountBox').hidden = true; $('doneLogin').hidden = false; }
          return;
        }
        step(10, 'Made their account');
        if (!(window.ONE && window.ONE.ready)) { location.href = '/login.html'; return; }
        return window.ONE.db.auth.signInWithPassword({ email: res.d.email || accountEmail, password: pw })
          .then(function (out) {
            location.href = out && !out.error ? '/account.html' : '/login.html';
          });
      })
      .catch(function () {
        btn.disabled = false;
        say(note, 'We could not reach the server. Try again in a moment.', 'bad');
      });
  });
  $('j_password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('acctBtn').click(); }
  });

  /* ---------------------------------------------------------- Dot
     He sits above each step and watches the box you are in (his eyes turn
     to it). oneGuide is his tip for the step, for the chat (chat.js). */
  function look(el) {
    var s = steps[current - 1];
    var eyes = s && s.querySelector('.join-face .dot-eyes');
    if (!eyes) return;
    if (!el) { eyes.classList.remove('is-aiming'); eyes.style.transform = ''; return; }
    var f = eyes.getBoundingClientRect(), t = el.getBoundingClientRect();
    var dx = (t.left + t.width / 2) - (f.left + f.width / 2);
    var dy = (t.top + t.height / 2) - (f.top + f.height / 2);
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    eyes.classList.add('is-aiming');
    eyes.style.transform = 'translate(' + (dx / d * 6).toFixed(1) + 'px,' + (dy / d * 5).toFixed(1) + 'px)';
  }
  track.addEventListener('focusin', function (e) { if (e.target.matches('input, button')) look(e.target); });
  track.addEventListener('focusout', function () { setTimeout(function () { if (!track.contains(document.activeElement)) look(null); }, 0); });

  window.oneGuide = function () {
    if (current === 1) return { text: 'Type your business name and I’ll find you a free web address. Want a different one? Type it underneath and I’ll check it’s free.',
      actions: [['Show me the name box', null, '#j_business']] };
    if (current === 2) return { text: 'Tap the features you want on your site. They’re all free and included, and our team builds them for you. Need payments or a booking calendar? That’s Business, at the bottom.',
      actions: [['Show me the features', null, '#featGrid']] };
    if (current === 3) return { text: 'Optional, but our designers love it: your Instagram or Facebook, a booking link, and any photos or screenshots, your logo too. Nothing to hand? Skip it and send it later.',
      actions: [['Show me the photo button', null, '.up-drop']] };
    if (current === 4) return { text: 'Your email is your login, so you can ask for free unlimited edits once your site is live. Pay monthly, or yearly to get two months free.',
      actions: [['Show me the email box', null, '#j_email']] };
    return { text: 'You’re in, and our team has your details. Choose a password to see your site and ask them for changes.',
      actions: [['Show me the password box', null, '#j_password']] };
  };
  function guideChanged() { try { window.dispatchEvent(new Event('one:guide')); } catch (e) {} }

  /* ---------------------------------------------------------- start */
  function fill() {
    if (answers.business) $('j_business').value = answers.business;
    if (answers.social) $('j_social').value = answers.social;
    if (answers.link) $('j_link').value = answers.link;
    if (answers.email) $('j_email').value = answers.email;
    if (answers.business && answers.business.length >= 2) {
      if (answers.domain) { domainsFor = answers.business; $('domBlock').hidden = false; paintDomains([answers.domain]); }
      else askDomains(answers.business);
    }
  }
  fill();
  paintFeatures();
  paintBusiness();
  paintFiles();
  if (/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    afterPayment();
  } else if (q.get('cancelled') && answers.business && answers.email && answers.domain) {
    show(4);
    say($('note4pay'), 'Payment cancelled. Nothing was taken. Pay when you’re ready.');
  } else {
    show(1);
    step(3, 'Opened the join form');
  }
})();
