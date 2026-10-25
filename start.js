/* one — join One, paid first (start.html).
 *
 *   1. Their full name, business name, type of business and email.
 *   2. The plan, and the pay button: api/join.js "start" makes a
 *      password-less account and opens Stripe Checkout for One.
 *   3. Back from Stripe with ?paid=<session>: "You're in", and a password.
 *
 * Nothing else is asked: the web address and everything about the build
 * are sorted with Kane after they join. What they type is kept in
 * sessionStorage, so a cancelled payment comes back to a filled-in form.
 * ?business=, ?type=, ?max= (which One) and ?lead= (a free profit plan or
 * example) fill it in.
 */
(function () {
  'use strict';

  var KEEP = 'one.start';
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var steps = [].slice.call(document.querySelectorAll('.wiz-step'));
  var marks = [].slice.call(document.querySelectorAll('.join-steps li'));

  function say(el, msg, kind) { el.textContent = msg || ''; el.className = 'note' + (kind ? ' ' + kind : ''); }

  var answers = {};
  try { answers = JSON.parse(sessionStorage.getItem(KEEP) || '{}') || {}; } catch (e) { answers = {}; }
  function keep() { try { sessionStorage.setItem(KEEP, JSON.stringify(answers)); } catch (e) {} }

  /* Which One they came from (trades, clubs, salon, other), kept with their
     details for the build. */
  var model = String(q.get('max') || answers.model || '');
  if (['trades', 'clubs', 'salon', 'other'].indexOf(model) === -1) model = '';
  answers.model = model;
  if (q.get('business')) answers.business = String(q.get('business')).slice(0, 120);
  if (q.get('type')) answers.type = String(q.get('type')).slice(0, 120);

  function show(n) {
    steps.forEach(function (s) { s.hidden = Number(s.dataset.step) !== n; });
    marks.forEach(function (m, i) { m.classList.toggle('is-on', i < Math.min(n, 2)); });
    $('wizTop').hidden = n > 2;
    $('stepNow').textContent = String(Math.min(n, 2));
    $('bar').style.width = (Math.min(n, 2) / 2 * 100) + '%';
    window.scrollTo(0, 0);
    var h = steps[n - 1] && steps[n - 1].querySelector('h1');
    if (h) h.focus({ preventScroll: true });
  }

  function fill() {
    if (answers.name) $('s_name').value = answers.name;
    if (answers.business) $('s_business').value = answers.business;
    if (answers.type) $('s_type').value = answers.type;
    if (answers.email) $('s_email').value = answers.email;
    if (answers.ref) $('s_ref').value = answers.ref;
  }

  /* A free profit plan or example: their details, and what the plan said. */
  (function fromLead() {
    var id = String(q.get('lead') || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    fetch('/api/lead-prefill?id=' + encodeURIComponent(id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        [['s_name', d.name], ['s_business', d.business], ['s_email', d.email], ['s_type', d.type]].forEach(function (f) {
          if (f[1] && !$(f[0]).value) $(f[0]).value = f[1];
        });
        if (d.summary) { answers.goals = String(d.summary).slice(0, 400); keep(); }
      })
      .catch(function () { /* the form still works empty */ });
  })();

  /* ---------------------------------------------------------- 1. you */
  $('track').addEventListener('submit', function (e) {
    e.preventDefault();
    if (steps[0].hidden) return;   // Enter on a later step
    var note = $('note1');
    var name = $('s_name').value.trim(), biz = $('s_business').value.trim();
    var type = $('s_type').value.trim(), mail = $('s_email').value.trim();
    if ($('s_extra').value) return;
    if (name.length < 2) { say(note, 'Add your full name.', 'bad'); $('s_name').focus(); return; }
    if (biz.length < 2) { say(note, 'Add your business name.', 'bad'); $('s_business').focus(); return; }
    if (type.length < 2) { say(note, 'What sort of business is it?', 'bad'); $('s_type').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { say(note, 'That email does not look right.', 'bad'); $('s_email').focus(); return; }
    answers.name = name; answers.business = biz; answers.type = type; answers.email = mail;
    keep();
    say(note, '');
    show(2);
  });
  $('back2').addEventListener('click', function () { show(1); });

  /* ---------------------------------------------------------- 2. pay */
  function offerCode() {
    return (window.ONE_SESSION && window.ONE_SESSION.offerCode && window.ONE_SESSION.offerCode()) || '';
  }
  function referral() {
    var typed = $('s_ref').value.trim().toUpperCase();
    if (typed) return typed;
    try { return localStorage.getItem('one-ref') || ''; } catch (e) { return ''; }
  }
  try { var r = q.get('ref'); if (r) localStorage.setItem('one-ref', r.toUpperCase().slice(0, 20)); } catch (e) {}

  $('payBtn').addEventListener('click', function () {
    var btn = $('payBtn'), was = btn.textContent, note = $('note2');
    answers.ref = $('s_ref').value.trim(); keep();
    btn.disabled = true;
    btn.textContent = 'Opening secure payment…';
    say(note, '');
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start', plan: 'max',
        name: answers.name, business: answers.business, type: answers.type, email: answers.email,
        model: answers.model || '', goals: answers.goals || '',
        offer: offerCode(), referralCode: referral(),
        website: $('s_extra').value
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); })
      .then(function (res) {
        if (res.ok && res.d.url) { location.href = res.d.url; return; }
        btn.disabled = false; btn.textContent = was;
        var d = res.d;
        if (d.field && d.field !== 'files' && d.field !== 'domain') {
          show(1);
          say($('note1'), d.error || 'Check your details.', 'bad');
          return;
        }
        say(note, d.error || 'Something went wrong. Please try again.', 'bad');
        if (d.code === 'exists' || d.code === 'paid') note.insertAdjacentHTML('beforeend', ' <a href="/login.html">Log in</a>');
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = was;
        say(note, 'We could not reach payments just now. Check your connection and try again.', 'bad');
      });
  });

  /* ---------------------------------------------------------- 3. after Stripe */
  var sessionId = String(q.get('paid') || '');
  var accountEmail = '';

  function whenBeacon(fn) {
    if (window.k1 && window.k1.payment) { fn(); return; }
    window.addEventListener('load', function () { if (window.k1 && window.k1.payment) fn(); });
  }

  function afterPayment() {
    show(3);
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
          $('accountBox').hidden = true; $('doneLogin').hidden = false;
          return;
        }
        accountEmail = d.email || '';
        $('doneEmail').textContent = accountEmail || 'your email';
        if (!d.needsAccount) { $('accountBox').hidden = true; $('doneLogin').hidden = false; }
        if (d.paid) {
          // The payment in Analytics, and the ad conversion, once each.
          whenBeacon(function () {
            window.k1.payment({ amount: typeof d.amount === 'number' ? d.amount : 25000, ref: d.sub || sessionId, email: accountEmail, description: 'One, monthly' });
          });
          if (window.oneTrack) {
            var seen;
            try { seen = localStorage.getItem('one.join-tracked'); } catch (e) {}
            if (seen !== sessionId) {
              try { localStorage.setItem('one.join-tracked', sessionId); } catch (e) {}
              window.oneTrack('Purchase', { currency: 'GBP', value: 250, content_name: 'max' }, d.sub || sessionId);
            }
          }
        }
        try { sessionStorage.removeItem(KEEP); } catch (e) {}
      })
      .catch(function () {
        $('doneSub').textContent = 'Your payment went through. If this page will not load, check your email for your welcome message.';
      });
  }

  $('acctBtn').addEventListener('click', function () {
    var pw = $('s_password').value, note = $('note3'), btn = $('acctBtn');
    if (pw.length < 8) { say(note, 'Use at least 8 characters.', 'bad'); $('s_password').focus(); return; }
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
          .then(function (out) { location.href = out && !out.error ? '/account.html' : '/login.html'; });
      })
      .catch(function () {
        btn.disabled = false;
        say(note, 'We could not reach the server. Try again in a moment.', 'bad');
      });
  });
  $('s_password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('acctBtn').click(); }
  });

  /* ---------------------------------------------------------- start */
  fill();
  if (/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    afterPayment();
  } else if (q.get('cancelled') && answers.name && answers.email) {
    show(2);
    say($('note2'), 'Payment cancelled. Nothing was taken. Pay when you’re ready.');
  } else {
    show(1);
  }
})();
