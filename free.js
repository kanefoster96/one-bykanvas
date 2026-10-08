/* /free - the page every ad lands on.
 *
 * Says who it is for (the trade from the ad), shows an example site for that
 * trade, and takes the business name into the join page, where they pick a
 * web address, give us the page they are online at and pay. No free design
 * and no exit prompt any more: £9.99 is the offer, and cancelling any month
 * is the safety net.
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
    elec:    ['electricians', 'electricians', '#2e3128'],
    boiler:  ['heating engineers', 'heating-engineers', '#5f2e1d'],
    valet:   ['mobile car valeters', 'mobile-car-valeters', '#133133'],
    driving: ['driving instructors', 'driving-instructors', '#e5f5eb'],
    kids:    ['kids\u2019 clubs', 'kids-clubs', '#fff2d8'],
    hair:    ['hairdressers', 'hairdressers', '#f8f1eb'],
    lash:    ['lash artists', 'lash-artists', '#fdf5f3'],
    mua:     ['makeup artists', 'makeup-artists', '#614f37'],
    nails:   ['nail techs', 'nail-techs', '#fceff9'],
    cake:    ['cake makers', 'cake-makers', '#ffffff'],
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
  var note = document.getElementById('offerNote');

  /* One box: the business name, then into the join page with it filled in
     and their trade carried along. join.js takes it from there (email, web
     address, the link they are online at, payment). */
  function join() {
    var q = 'business=' + encodeURIComponent(name.value.trim());
    try { var t = sessionStorage.getItem('one.trade'); if (t) q += '&trade=' + encodeURIComponent(t); } catch (e) { /* private mode */ }
    location.assign('/join?' + q);
  }

  /* "Get started" further down the page brings them back to the box. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-to-offer]');
    if (!a) return;
    e.preventDefault();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { name.focus({ preventScroll: true }); }, 450);
  });

  function say(msg, kind) { note.textContent = msg || ''; note.className = 'note' + (kind ? ' ' + kind : ''); }

  function titleCase(s) { return s.replace(/(^|[\s\-'&(]+)([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); }); }
  name.addEventListener('input', function () {
    var pos = name.selectionStart, was = name.value, now = titleCase(was);
    if (now !== was) { name.value = now; try { name.setSelectionRange(pos, pos); } catch (e) { /* not settable here */ } }
    name.classList.remove('err');
    say('');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (name.value.trim().length < 2) { name.classList.add('err'); name.focus(); say('Tell us your business name.', 'bad'); return; }
    join();
  });
})();
