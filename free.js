/* /free - the page every ad lands on.
 *
 * The same two steps as the homepage, in one row:
 *   1. the business name, Title Cased as it is typed, and an arrow;
 *   2. the email, and the gift button that sends it (/api/lead).
 * Then, with the request already in, one optional step: a link to the
 * business, added to the lead just sent, so the page is designed from
 * something real. Added or skipped, they go on to /thanks.html.
 *
 * The Lead event fires the moment the request is in, not on the thank-you
 * page, so someone who closes the tab at the optional step still counts.
 * thanks.js sees `tracked` and does not fire it twice.
 */
(function () {
  'use strict';

  /* ---- who it is for ----
     Meta puts the ad's id on the link (utm_content). Each ad is one trade,
     so the page can say "Websites built for electricians" to someone who
     tapped the electricians ad, and show the example site for it. A
     ?trade= on the link does the same for ads made later. Kept for the
     visit, so it survives a refresh. */
  // [the words in the pill, the example site, the colour at the top of
  //  that example, for the phone's status bar]
  var DARK = '#2f2e2d';
  var TRADES = {
    elec:    ['electricians', 'electricians', DARK],
    boiler:  ['heating engineers', 'heating-engineers', DARK],
    valet:   ['mobile car valeters', 'mobile-car-valeters', DARK],
    driving: ['driving instructors', 'driving-instructors', '#f5faf6'],
    kids:    ['kids\u2019 clubs', 'kids-clubs', '#fffcf3'],
    hair:    ['hairdressers', 'hairdressers', DARK],
    lash:    ['lash artists', 'lash-artists', DARK],
    mua:     ['makeup artists', 'makeup-artists', DARK],
    nails:   ['nail techs', 'nail-techs', DARK],
    cake:    ['cake makers', 'cake-makers', DARK],
    // From the homepage's trade picker: named in the pill, with the
    // examples in turn until they have one of their own.
    trades:        ['trades'],
    salons:        ['salons'],
    barbers:       ['barbers'],
    cafes:         ['coffee shops'],
    gyms:          ['gyms'],
    cleaners:      ['cleaners'],
    tutors:        ['tutors'],
    photographers: ['photographers'],
    gardeners:     ['gardeners'],
    dance:         ['dance schools']
  };
  var ADS = {
    // Northumberland
    '52515811686048': 'elec', '52515811738248': 'boiler', '52515811985848': 'kids', '52515811839448': 'hair', '52515812217648': 'mua',
    '52515812703448': 'valet', '52515812126248': 'lash', '52515812419248': 'cake', '52515812789848': 'driving', '52515812575448': 'nails',
    // Newcastle
    '52515840461248': 'elec', '52515840476848': 'boiler', '52515840503648': 'kids', '52515840495448': 'hair', '52515840531048': 'mua',
    '52515840572048': 'valet', '52515840517648': 'lash', '52515840544448': 'cake', '52515840587048': 'driving', '52515840559848': 'nails',
    // North Tyneside
    '52515840669848': 'elec', '52515840683248': 'boiler', '52515840709248': 'kids', '52515840697848': 'hair', '52515840726248': 'mua',
    '52515840780448': 'valet', '52515840721248': 'lash', '52515840738448': 'cake', '52515840792448': 'driving', '52515840754248': 'nails'
  };
  function tradeKey() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    var named = String(q.get('trade') || '').toLowerCase();
    var key = TRADES[named] ? named : ADS[String(q.get('utm_content') || '')] || null;
    if (!key) q.forEach(function (v) { if (!key && ADS[v]) key = ADS[v]; });
    try {
      if (key) sessionStorage.setItem('one.trade', key);
      else key = sessionStorage.getItem('one.trade');
    } catch (e) { /* private mode: this page view only */ }
    return TRADES[key] ? key : null;
  }
  (function showTrade() {
    var key = tradeKey();
    if (!key) return;
    var t = TRADES[key];
    var pill = document.getElementById('builtTrade');
    var also = document.getElementById('builtAlso');
    if (pill) pill.textContent = t[0];
    if (also) also.hidden = false;
    /* The phone shows the example site for their trade, and the button
       opens it. */
    if (!t[1]) return;
    var screen = document.getElementById('madeCycle');
    if (screen) {
      screen.innerHTML = '<img class="sb-example-shot" src="/assets/examples/phone/' + t[1] + '.jpg" alt="" width="780" height="1692" decoding="async" style="background:' + t[2] + '">';
      screen.classList.add('is-single');
      var phone = document.getElementById('sbPhone');
      if (phone) phone.setAttribute('aria-label', 'An example website for ' + t[0]);
    }
    var ex = document.getElementById('tradeExample');
    if (ex) { ex.href = '/examples/' + t[1]; ex.innerHTML = 'Preview the full site &rsaquo;'; }
  })();

  var form = document.getElementById('offer');
  if (!form) return;
  var name = document.getElementById('business');
  var next = document.getElementById('offerNext');
  var email = document.getElementById('email');
  var send = document.getElementById('offerSend');
  var handle = document.getElementById('handle');
  var handleGo = document.getElementById('offerHandleGo');
  var skip = document.getElementById('offerSkip');
  var steps = [document.getElementById('offerStep1'), document.getElementById('offerStep2'), document.getElementById('offerStep3')];
  var note = document.getElementById('offerNote');
  var hp = document.getElementById('offer_extra');
  var shownAt = Date.now();
  var leadId = null;
  var at = 0;

  /* Two ways in, one box. 'join' (the default) takes the name straight into
     signing up for Starter; 'free' is the free design, for anyone unsure:
     the name, then the email, then an optional link. ?mode=free (from the
     trade pages' "Not sure?" links) starts on the free design. */
  var label1 = document.getElementById('businessLabel');
  var micro = document.getElementById('offerMicro');
  var modeBtn = document.getElementById('offerMode');
  var mode = 'join';
  var touched = false;   // they have started; the not-sure prompt stays away
  function setMode(m, focus) {
    mode = m;
    form.classList.toggle('is-free', m === 'free');
    if (label1) label1.textContent = m === 'free' ? 'Your business name, for your free design' : 'Your business name, to get started';
    next.setAttribute('aria-label', m === 'free' ? 'Next' : 'Get started');
    if (micro) micro.textContent = m === 'free' ? 'Free, no card. In your inbox within 24 hours.' : 'Two minutes to sign up. Your site, live within 24 hours.';
    if (modeBtn) modeBtn.textContent = m === 'free' ? 'Rather get started now? \u00a39.99 a month' : 'Not sure? See your free design first';
    if (at === 1) go(0, focus ? name : null);
    else if (focus) name.focus({ preventScroll: true });
  }
  try { if (new URLSearchParams(location.search).get('mode') === 'free') setMode('free'); } catch (e) { /* old browser: join */ }
  if (modeBtn) modeBtn.addEventListener('click', function () { touched = true; setMode(mode === 'free' ? 'join' : 'free', true); });

  /* Links further down the page back to the box: "Get started" as it is,
     "See your free design first" switching it to the free design. */
  function toBox(free) {
    touched = true;
    if (free && mode !== 'free') setMode('free');
    else if (!free && mode !== 'join' && at === 0) setMode('join');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { (at === 1 ? email : name).focus({ preventScroll: true }); }, 450);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-to-offer], [data-to-free]');
    if (!a) return;
    e.preventDefault();
    toBox(a.hasAttribute('data-to-free'));
  });

  /* Joining: into the sign-up with the name they typed, on Starter. The
     wizard takes it from there (account, trade, web address, payment). */
  function join() {
    var q = 'plan=starter&business=' + encodeURIComponent(name.value.trim());
    location.assign('/get-started.html?' + q);
  }

  function say(msg, kind) { note.textContent = msg || ''; note.className = 'note' + (kind ? ' ' + kind : ''); }
  function filled(el) { return el.value.trim().length >= 2; }

  function titleCase(s) { return s.replace(/(^|[\s\-'&(]+)([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); }); }
  name.addEventListener('focus', function () { touched = true; });
  name.addEventListener('input', function () {
    var pos = name.selectionStart, was = name.value, now = titleCase(was);
    if (now !== was) { name.value = now; try { name.setSelectionRange(pos, pos); } catch (e) { /* not settable here */ } }
    name.classList.remove('err');
    say('');
  });

  /* The step on screen fades out; the next fades in where it was. */
  function go(n, focusEl) {
    var from = steps[at], to = steps[n];
    at = n;
    from.classList.add('out');
    setTimeout(function () {
      from.hidden = true; from.classList.remove('out', 'in');
      to.hidden = false; to.classList.add('in');
      if (focusEl) setTimeout(function () { focusEl.focus({ preventScroll: true }); }, 80);
    }, 230);
  }

  function step2() {
    if (!filled(name)) { name.classList.add('err'); name.focus(); say('Tell us your business name.', 'bad'); return; }
    say('');
    touched = true;
    if (mode === 'join') return join();
    /* The second step speaks to them by name, so it reads as the same
       conversation and shows the name went in. */
    var label = steps[1].querySelector('label');
    if (label) label.textContent = 'Where should we send the design for ' + name.value.trim() + '?';
    go(1, email);
  }
  next.addEventListener('click', step2);
  name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); step2(); } });
  email.addEventListener('input', function () { email.classList.remove('err'); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (at === 0) return step2();
    if (at === 2) return addLink();
    if (leadId) return;
    var biz = name.value.trim();
    var mail = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { email.classList.add('err'); email.focus(); return say('Enter a valid email address.', 'bad'); }
    send.disabled = true;
    say('Sending…');
    try {
      var res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'free-preview', name: biz, business: biz, email: mail, handle: '',
          campaign: (window.oneFrom && window.oneFrom()) || '',
          website: hp ? hp.value : '',
          elapsed: Date.now() - shownAt
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');
      leadId = data.id || '';
      if (window.oneTrack) window.oneTrack('Lead', { content_category: 'free-preview' }, leadId || null);
      /* Handed to the thank-you page rather than put in its URL: an email
         address in a link ends up in browser history. */
      try { sessionStorage.setItem('one.free-requested', JSON.stringify({ email: mail, id: leadId, tracked: true })); } catch (err) { /* private mode */ }
      say('');
      if (micro) micro.hidden = true;
      var alt = document.getElementById('offerAlt');
      if (alt) alt.hidden = true;
      go(2, handle);
    } catch (err) {
      say(err.message || 'Could not send that. Try again.', 'bad');
      send.disabled = false;
    }
  });

  function done() { location.assign('/thanks.html'); }
  async function addLink() {
    var link = handle.value.trim();
    if (!link) { handle.classList.add('err'); handle.focus(); return say('Paste a link, or skip.', 'bad'); }
    handleGo.disabled = true;
    if (leadId) {
      try {
        await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ update: leadId, handle: link }) });
      } catch (err) { /* the page is already on its way; the link was a bonus */ }
    }
    done();
  }
  handleGo.addEventListener('click', addLink);
  handle.addEventListener('input', function () { handle.classList.remove('err'); });
  handle.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });
  skip.addEventListener('click', done);

  /* ---- not sure? ----
     The free design, offered once to someone about to leave without
     starting: on a computer when the pointer leaves through the top of the
     window, on a phone (where there is no such moment) once they have seen
     the price and not touched the box for a while. Never if they have
     started, never twice in a visit. */
  var ns = document.getElementById('notSure');
  if (ns) {
    var NS_KEY = 'one.notsure';
    var seenBefore = false;
    try { seenBefore = !!sessionStorage.getItem(NS_KEY); } catch (e) { /* private mode */ }
    var nsOpener = null;
    var showNs = function () {
      if (seenBefore || touched || mode === 'free' || leadId || !ns.hidden) return;
      seenBefore = true;
      try { sessionStorage.setItem(NS_KEY, '1'); } catch (e) { /* private mode */ }
      nsOpener = document.activeElement;
      ns.hidden = false;
      var go2 = document.getElementById('notSureGo');
      if (go2) go2.focus({ preventScroll: true });
    };
    var hideNs = function () {
      ns.hidden = true;
      if (nsOpener && nsOpener.focus) nsOpener.focus({ preventScroll: true });
    };
    ns.addEventListener('click', function (e) {
      if (e.target === ns || (e.target.closest && e.target.closest('[data-notsure-close]'))) hideNs();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ns.hidden) hideNs(); });
    var nsGo = document.getElementById('notSureGo');
    if (nsGo) nsGo.addEventListener('click', function () { ns.hidden = true; toBox(true); });

    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (fine) {
      document.addEventListener('mouseout', function (e) {
        if (e.relatedTarget || e.clientY > 0) return;
        if (Date.now() - shownAt < 4000) return;
        showNs();
      });
    } else {
      var price = document.getElementById('price');
      if (price && window.IntersectionObserver) {
        var timer = null;
        new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (en) {
            if (en.intersectionRatio < 0.5 || timer) return;
            obs.disconnect();
            timer = setTimeout(showNs, 9000);
          });
        }, { threshold: [0.5] }).observe(price);
      }
    }
  }
})();
