/* one — join: Starter, paid first.
 *
 * Three steps: the business name and email, one of three free web addresses,
 * and a link to where they are online now with monthly or yearly. Then
 * Stripe. Stripe sends them back here with ?paid=<session id>, and the last
 * card asks for a password: the account is made after the money, not
 * before (api/join.js has the why).
 *
 * What they type is kept in sessionStorage, so a cancelled payment comes
 * back to a filled-in form rather than an empty one.
 */
(function () {
  'use strict';

  var KEEP = 'one.join';
  var LAST = 3;

  var $ = function (id) { return document.getElementById(id); };
  var track = $('track');
  var steps = Array.prototype.slice.call(track.querySelectorAll('.wiz-step'));
  var current = 1;
  var q = new URLSearchParams(location.search);

  function say(el, msg, kind) { el.textContent = msg || ''; el.className = 'note' + (kind ? ' ' + kind : ''); }

  /* ---------------------------------------------------------- memory */
  var answers = {};
  try { answers = JSON.parse(sessionStorage.getItem(KEEP) || '{}') || {}; } catch (e) { answers = {}; }
  function keep() { try { sessionStorage.setItem(KEEP, JSON.stringify(answers)); } catch (e) {} }

  /* Their trade, from the ad (?trade=) or the /free page earlier in the
     visit, so the profile already says what they do. */
  var trade = String(q.get('trade') || '').toLowerCase();
  if (!/^[a-z]{2,20}$/.test(trade)) {
    try { trade = sessionStorage.getItem('one.trade') || ''; } catch (e) { trade = ''; }
  }
  if (trade) answers.trade = trade;

  var fromLink = String(q.get('business') || '').trim().slice(0, 120);
  if (fromLink) answers.business = fromLink;

  function fill() {
    if (answers.business) $('j_business').value = answers.business;
    if (answers.email) $('j_email').value = answers.email;
    if (answers.link) $('j_link').value = answers.link;
    if (answers.billing === 'annual') setBilling('annual');
  }

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

  /* ---------------------------------------------------------- the preview
     Their site, above the card, filling in as they go: the name and its
     first letter, the address once picked, and their trade in its own
     colour when the ad or page told us what they do. */
  var LOOK = {
    hair: ['Hairdresser', '#2f2e2d', '#fbf7f4'], lash: ['Lash artist', '#7a4a5d', '#fbf5f7'],
    mua: ['Makeup artist', '#8a5a44', '#fbf6f2'], nails: ['Nail tech', '#9c3d64', '#fcf4f8'],
    cake: ['Cake maker', '#b4566b', '#fdf6f3'], kids: ['Kids\u2019 club', '#e07a1f', '#fffaf1'],
    elec: ['Electrician', '#1f4fd1', '#f5f8ff'], boiler: ['Heating engineer', '#d0461f', '#fff7f3'],
    valet: ['Mobile car valeter', '#0f6e8c', '#f2fafc'], driving: ['Driving instructor', '#1a7f37', '#f5faf6'],
    dance: ['Dance school', '#6b3fd1', '#f8f5ff'], salons: ['Salon', '#2f2e2d', '#fbf7f4'],
    barbers: ['Barber', '#1d1d1f', '#f7f7f8'], cafes: ['Coffee shop', '#7a4b2a', '#fbf7f2'],
    gyms: ['Gym', '#d12f2f', '#fff6f6'], cleaners: ['Cleaner', '#0f8a7a', '#f2fbf9'],
    tutors: ['Tutor', '#3a55c9', '#f5f7ff'], photographers: ['Photographer', '#1d1d1f', '#f7f7f8'],
    gardeners: ['Gardener', '#2f7d32', '#f4faf2'], trades: ['Trades', '#1f4fd1', '#f5f8ff']
  };
  var lastLetter = '';
  function paint(building) {
    var live = $('joinLive');
    if (!live) return;
    var name = ($('j_business').value || answers.business || '').trim();
    var look = LOOK[trade];
    $('jlName').textContent = name || 'Your business';
    var letter = (name.charAt(0) || 'Y').toUpperCase();
    var badge = $('jlBadge');
    if (letter !== lastLetter) {
      badge.textContent = letter;
      badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
      lastLetter = letter;
    }
    $('jlTrade').textContent = building ? 'Live within 24 hours' : look ? look[0] + ' in the North East' : 'Your website, live within 24 hours';
    $('jlUrl').textContent = answers.domain || 'yourbusiness.co.uk';
    live.classList.toggle('has-domain', Boolean(answers.domain));
    live.classList.toggle('is-building', Boolean(building));
    if (look) { live.style.setProperty('--jl-accent', look[1]); live.style.setProperty('--jl-bg', look[2]); }
  }
  $('j_business').addEventListener('input', function () { paint(); });

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

  /* ---------------------------------------------------------- navigation */
  function show(step) {
    current = step;
    steps.forEach(function (s) { s.hidden = Number(s.dataset.step) !== step; });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      track.classList.remove('slide');
      void track.offsetWidth;
      track.classList.add('slide');
    }
    $('wizTop').hidden = step > LAST;
    if (step <= LAST) {
      $('stepNow').textContent = String(step);
      $('bar').style.width = Math.round((step / LAST) * 100) + '%';
    }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (step === 2) {
      askDomains();
      if (answers.business) $('say2').textContent = 'Ooh, ' + answers.business + '! Now pick your spot on the internet.';
    }
    document.querySelectorAll('.join-steps li').forEach(function (li, i) {
      li.classList.toggle('is-on', i + 1 === step);
      li.classList.toggle('is-done', i + 1 < step);
    });
    paint();
    if (window.oneGuide) guideChanged();
    var first = steps[step - 1].querySelector('input:not([tabindex="-1"]), button');
    if (first && step > 1) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  }

  track.addEventListener('click', function (e) {
    if (e.target.closest('[data-back]')) { show(Math.max(1, current - 1)); return; }
    if (e.target.closest('[data-next]')) advance();
  });
  // Enter moves on rather than submitting from the first two steps.
  track.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || current > 2 || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (e.target.id === 'domOwn') { checkTyped(); return; }
    advance();
  });

  function advance() {
    if (current === 1) {
      var biz = $('j_business').value.trim();
      var email = $('j_email').value.trim();
      if (biz.length < 2) { say($('note1'), 'Add your business name.', 'bad'); $('j_business').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say($('note1'), 'That email does not look right.', 'bad'); $('j_email').focus(); return; }
      say($('note1'), '');
      /* A changed name asks for new addresses: the old three were for the
         old name. */
      if (answers.business !== biz) { domainsFor = ''; answers.domain = ''; }
      answers.business = biz;
      answers.email = email;
      keep();
      show(2);
      return;
    }
    if (current === 2) {
      if (!answers.domain) { say($('note2'), 'Pick a web address, or type the one you want.', 'bad'); return; }
      say($('note2'), '');
      keep();
      show(3);
    }
  }

  /* ---------------------------------------------------------- addresses */
  var domainsFor = '';

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
    paint();
  }

  function noDomains(message) {
    var wrap = $('domList');
    wrap.textContent = '';
    wrap.removeAttribute('aria-busy');
    $('domState').textContent = message;
    $('domState').hidden = false;
    $('domMore').open = true;
  }

  function askDomains() {
    if (domainsFor === answers.business) return;
    domainsFor = answers.business;
    $('domState').hidden = true;
    var wrap = $('domList');
    wrap.setAttribute('aria-busy', 'true');
    wrap.innerHTML = '<div class="pick-row is-waiting"><span class="dom-bar"></span><span class="dom-searching">Searching&hellip;</span></div>'
      + '<div class="pick-row is-waiting"><span class="dom-bar"></span></div>'
      + '<div class="pick-row is-waiting"><span class="dom-bar"></span></div>';
    fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'suggest', business: answers.business, business_type: trade })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var list = (res.ok && res.d && res.d.suggestions) || [];
        if (list.length) { paintDomains(list.slice(0, 3)); return; }
        domainsFor = '';
        noDomains(res.d && res.d.reachable === false
          ? 'We could not check addresses just now. Type the one you want below.'
          : 'The obvious ones are taken. Type the address you want below and we will check it.');
      })
      .catch(function () {
        domainsFor = '';
        noDomains('We could not check addresses just now. Type the one you want below.');
      });
  }

  $('domList').addEventListener('change', function (e) {
    if (!e.target.matches('input[name="domain"]')) return;
    answers.domain = e.target.value;
    keep();
    paint();
    $('domList').querySelectorAll('.pick-row').forEach(function (r) {
      r.classList.toggle('is-on', r.querySelector('input').checked);
    });
    say($('note2'), '');
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
        note.textContent = res.state === 'free'
          ? d + ' is free. It’s yours.'
          : 'We could not confirm ' + d + ' just now. We will check it by hand before we register it.';
        var list = Array.prototype.map.call($('domList').querySelectorAll('input[name="domain"]'), function (i) { return i.value; });
        answers.domain = d;
        paintDomains([d].concat(list.filter(function (x) { return x !== d; })).slice(0, 3));
        $('domState').hidden = true;
      })
      .catch(function () { note.textContent = 'We could not check just now. Try again in a moment.'; })
      .then(function () { $('domCheck').disabled = false; });
  }
  $('domCheck').addEventListener('click', checkTyped);

  /* ---------------------------------------------------------- billing */
  function setBilling(which) {
    answers.billing = which === 'annual' ? 'annual' : 'monthly';
    $('billPick').querySelectorAll('.pick-row').forEach(function (r) {
      var input = r.querySelector('input');
      input.checked = input.value === answers.billing;
      r.classList.toggle('is-on', input.checked);
    });
    $('payBtn').textContent = answers.billing === 'annual' ? 'Pay £99 and go live' : 'Pay £9.99 and go live';
  }
  $('billPick').addEventListener('change', function (e) {
    if (e.target.name === 'billing') { setBilling(e.target.value); keep(); }
  });

  /* ---------------------------------------------------------- pay */
  var paying = false;
  track.addEventListener('submit', function (e) {
    e.preventDefault();
    if (current !== 3 || paying) return;
    /* Optional: a link gets a better first site, but it never stands
       between them and paying. Without one we ask in the welcome email. */
    var link = $('j_link').value.trim();
    answers.link = link;
    keep();
    paying = true;
    var btn = $('payBtn');
    var was = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Opening secure payment…';
    say($('note3'), '');
    if (window.oneTrack) {
      window.oneTrack('InitiateCheckout', { content_category: 'starter', currency: 'GBP', value: answers.billing === 'annual' ? 99 : 9.99 });
    }
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        business: answers.business, email: answers.email, domain: answers.domain,
        link: link, billing: answers.billing || 'monthly', trade: trade,
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
        if (d.field === 'business' || d.field === 'email') { show(1); say($('note1'), d.error, 'bad'); return; }
        if (d.field === 'domain') {
          domainsFor = '';
          if (d.code === 'domain_taken') answers.domain = '';
          show(2);
          say($('note2'), d.error, 'bad');
          return;
        }
        say($('note3'), d.error || 'Something went wrong. Please try again.', 'bad');
        if (d.code === 'exists' || d.code === 'paid') $('note3').insertAdjacentHTML('beforeend', ' <a href="/login.html">Log in</a>');
      })
      .catch(function () {
        paying = false;
        btn.disabled = false;
        btn.textContent = was;
        say($('note3'), 'We could not reach payments just now. Check your connection and try again.', 'bad');
      });
  });

  /* ---------------------------------------------------------- after Stripe */
  var sessionId = String(q.get('paid') || '');
  var accountEmail = '';

  function afterPayment() {
    show(4);
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
        if (d.business) answers.business = d.business;
        if (d.domain) answers.domain = d.domain;
        paint(true);
        if (d.paid) confetti();
        if (d.domain) {
          $('doneSub').textContent = '';
          $('doneSub').append('Your site goes live at ');
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
            window.oneTrack('Subscribe', { currency: 'GBP', value: d.annual ? 99 : 9.99 }, sessionId);
          }
        }
        try { sessionStorage.removeItem(KEEP); } catch (e) {}
      })
      .catch(function () {
        $('doneSub').textContent = 'Your payment went through. If this page will not load, check your email for your welcome message.';
      });
  }

  $('acctBtn').addEventListener('click', function () {
    var pw = $('j_password').value;
    var note = $('note4');
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
     He watches the box you are in (his eyes turn to it). oneGuide is his
     tip for the step, for the chat (chat.js) wherever it is loaded. */
  function look(el) {
    var step = steps[current - 1];
    var eyes = step && step.querySelector('.join-face .dot-eyes');
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
    if (current === 1) {
      var needName = !$('j_business').value.trim();
      return { text: needName
          ? 'Start with your business name, the one your customers know you by. Then your email, so we can send your site when it\u2019s live.'
          : 'Great name. Now your email: it\u2019s where your site lands, and how you log in later.',
        actions: [[needName ? 'Show me the name box' : 'Show me the email box', null, needName ? '#j_business' : '#j_email']] };
    }
    if (current === 2) return { text: 'These three addresses are free right now and included in your plan. Prefer something else? Tap \u201cWant a different one?\u201d and we\u2019ll check it.',
      actions: [['Show me the addresses', null, '#domList']] };
    if (current === 3) return { text: 'Got an Instagram, Facebook or website? Paste the link and we\u2019ll build from your photos and words there. No link? That\u2019s fine, send it later. Yearly is \u00a399, two months free.',
      actions: [['Show me the link box', null, '#j_link']] };
    return { text: 'You\u2019re in! Choose a password to see your site and ask for changes. Got more photos? Reply to your welcome email.',
      actions: [['Show me the password box', null, '#j_password']] };
  };
  function guideChanged() { try { window.dispatchEvent(new Event('one:guide')); } catch (e) {} }
  $('j_business').addEventListener('change', guideChanged);

  /* ---------------------------------------------------------- start */
  fill();
  setBilling(answers.billing);
  if (/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    afterPayment();
  } else if (q.get('cancelled') && answers.business && answers.email && answers.domain) {
    show(3);
    say($('note3'), 'Payment cancelled. Nothing was taken. Pay when you’re ready.');
  } else {
    show(1);
    if (!answers.business) { try { $('j_business').focus({ preventScroll: true }); } catch (e) {} }
  }
})();
