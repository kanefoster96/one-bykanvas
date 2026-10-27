/* one — the free check, step one: three numbers on sliders or typed, what
 * how many spaces are empty, optional club name and email (kept as a lead
 * if given), and a button that carries the numbers to /look-round, where
 * their number and the offer to look round our app are. Used by the homepage's closing section and /profit-plan.
 * Needs growth-model.js first. A return from /look-round (?members=..) puts the
 * numbers back.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('gMembers') || !window.GrowthModel) return;
  // The button carries the numbers to /look-round in the address.
  var G = window.GrowthModel;
  var money = G.money;
  function fill(el) {
    el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  }
  // Each number can be dragged on its slider or tapped and typed: the typed
  // box is the value, the slider follows it (and pins at its end for big
  // numbers). A return from /look-round (?members=..) fills them back in.
  var PAIRS = [['gMembers', 'gMembersN'], ['gCapacity', 'gCapacityN'], ['gFee', 'gFeeN']];
  try {
    var back = new URLSearchParams(location.search);
    [['members', 'gMembersN'], ['capacity', 'gCapacityN'], ['fee', 'gFeeN']].forEach(function (k) {
      var v = back.get(k[0]);
      if (v !== null && v !== '' && isFinite(+v)) $(k[1]).value = Math.round(+v);
    });
  } catch (e) {}
  function num(id) {
    var el = $(id), v = Math.round(+el.value);
    if (!isFinite(v) || el.value === '') v = 0;
    return Math.max(+el.min, Math.min(+el.max, v));
  }
  function numbers() {
    return { members: num('gMembersN'), capacity: num('gCapacityN'), fee: Math.max(1, num('gFeeN')) };
  }
  function sync() {
    PAIRS.forEach(function (pr) {
      var box = $(pr[1]);
      $(pr[0]).value = num(pr[1]); fill($(pr[0]));
      box.style.width = (Math.max(2, String(box.value).length) + 0.4) + 'ch';
    });
  }
  // Total can't be under what they have now: whichever was changed wins.
  function settle(changed) {
    var m = num('gMembersN'), c = num('gCapacityN');
    if (c < m) { if (changed === 'gCapacityN') $('gMembersN').value = c; else $('gCapacityN').value = m; }
  }
  function calc() {
    var n = numbers(), p = G.plan(n);
    sync();
    var lose = p.spaces > 0;
    /* The spaces count is free here; what they cost is on /look-round,
       with the offer to look round our app. */
    $('gLeft').innerHTML = lose
      ? 'That leaves <b>' + p.spaces + ' space' + (p.spaces === 1 ? '' : 's') + '</b> empty.'
      : 'That&rsquo;s every space <b>full</b>.';
    if ($('gTease')) $('gTease').textContent = lose
      ? 'See what they\u2019re costing you each year, and how we\u2019d fill them.'
      : 'See what\u2019s coming in, and how we\u2019d run it all for you.';
    $('gGo').href = '/look-round?' + G.query({ members: n.members, capacity: Math.max(n.members, n.capacity), fee: n.fee });
  }
  /* Meta: someone used the calculator, once a visit, on the first move.
     Through consent.js, so nothing goes without cookie consent. The plan
     itself is the Lead, sent when details are given here or on /look-round. */
  var used = false;
  function tellUsed() {
    if (used) return; used = true;
    if (window.oneTrack) window.oneTrack('ViewContent', { content_name: 'profit plan calculator', content_category: 'profit-plan' });
    (window.k1q = window.k1q || []).push([11, 'Used the calculator']);
  }

  /* The optional details. Given, they go to api/plan.js (kind "calc") as a
     lead before the next page opens, and that page has them filled in.
     Not given, the button just goes. Never in the way: a slow or failed
     save still opens the next page. */
  var shownAt = Date.now();
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if ($('gOptEmail')) $('gGo').addEventListener('click', function (e) {
    var biz = $('gOptBiz').value.trim(), email = $('gOptEmail').value.trim(), note = $('gOptNote');
    note.textContent = '';
    if (!biz && !email) return;
    if (email && !EMAIL.test(email)) { e.preventDefault(); note.textContent = 'That email doesn\u2019t look right, or leave it empty.'; $('gOptEmail').focus(); return; }
    if (!email || biz.length < 2) { e.preventDefault(); note.textContent = !email ? 'Add your email too, or leave both empty.' : 'Add your club name too, or leave both empty.'; (!email ? $('gOptEmail') : $('gOptBiz')).focus(); return; }
    e.preventDefault();
    var go = $('gGo').href, done = false;
    var leave = function () { if (!done) { done = true; location.href = go; } };
    var n = numbers();
    try { sessionStorage.setItem('one.lr', JSON.stringify({ business: biz, email: email })); } catch (err) {}
    (window.k1q = window.k1q || []).push([12, 'Left their email on the calculator']);
    setTimeout(leave, 2500);
    fetch('/api/plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ kind: 'calc', business: biz, email: email, members: n.members, capacity: Math.max(n.members, n.capacity), fee: n.fee,
        website: $('gOptWebsite') ? $('gOptWebsite').value : '', elapsed: Date.now() - shownAt, from: 'calculator',
        campaign: (window.oneFrom && window.oneFrom()) || '' })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.id) {
          try {
            sessionStorage.setItem('one.lr', JSON.stringify({ id: d.id, business: biz, email: email }));
            if (window.oneTrack && !sessionStorage.getItem('one.lead.' + d.id)) {
              sessionStorage.setItem('one.lead.' + d.id, '1');
              window.oneTrack('Lead', { content_category: 'calculator' }, d.id);
            }
          } catch (err) {}
        }
      })
      .catch(function () {})
      .then(function () { setTimeout(leave, 150); });
  });
  PAIRS.forEach(function (pr) {
    var slider = $(pr[0]), box = $(pr[1]);
    slider.addEventListener('input', tellUsed);
    box.addEventListener('input', tellUsed);
    slider.addEventListener('input', function () { box.value = slider.value; settle(pr[1]); calc(); });
    box.addEventListener('input', calc);
    box.addEventListener('focus', function () { try { box.select(); } catch (e) {} });
    box.addEventListener('change', function () { box.value = num(pr[1]); settle(pr[1]); calc(); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter') box.blur(); });
  });
  settle();
  calc();

})();
