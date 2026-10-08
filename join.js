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
    if (step === 2) askDomains();
    if (step === 3) $('joinDomain').textContent = answers.domain || 'yourbusiness.co.uk';
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
    var link = $('j_link').value.trim();
    if (link.length < 3) { say($('note3'), 'Add a link to where you are online now, so we know what to build from.', 'bad'); $('j_link').focus(); return; }
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
