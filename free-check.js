/* one — the free check, step one: three numbers on sliders or typed, what
 * how many spaces are empty (what they cost stays blurred until /check,
 * where they give their details), and a button that carries the numbers
 * to /check in the address. Used by the homepage's closing section and /profit-plan.
 * Needs growth-model.js first. A return from /check (?members=..) puts the
 * numbers back.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('gMembers') || !window.GrowthModel) return;
  // The button carries the numbers to /check in the address.
  var G = window.GrowthModel;
  var money = G.money;
  function fill(el) {
    el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  }
  // Each number can be dragged on its slider or tapped and typed: the typed
  // box is the value, the slider follows it (and pins at its end for big
  // numbers). A return from /check (?members=..) fills them back in.
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
    /* The spaces count is free; the money it costs them is what the plan
       is for, so it stays blurred (stand-in digits, the real sum's shape)
       until they give their details on /check. */
    $('gLeft').innerHTML = lose
      ? 'That leaves <b>' + p.spaces + ' space' + (p.spaces === 1 ? '' : 's') + '</b> empty.'
      : 'That&rsquo;s every space <b>full</b>.';
    $('gPre').textContent = lose ? 'Your empty spaces are costing you' : 'Nice. Here’s what’s coming in';
    $('gLoss').textContent = G.locked(lose ? p.gapYear : p.total);
    $('gLoss').classList.add('mh-locked');
    $('gLoss').setAttribute('aria-label', 'Hidden until the next step');
    $('gLossSub').textContent = lose ? 'every year.' : 'every month.';
    $('gFix').textContent = lose
      ? 'See your number, and exactly how we’d fill those spaces. Free, no card.'
      : 'See how One could run it all for you. Free, no card.';
    $('gGo').href = '/check?' + G.query({ members: n.members, capacity: Math.max(n.members, n.capacity), fee: n.fee });
  }
  /* Meta: someone used the calculator, once a visit, on the first move.
     Through consent.js, so nothing goes without cookie consent. The plan
     itself is the Lead, sent when the form on /check is sent. */
  var used = false;
  function tellUsed() {
    if (used) return; used = true;
    if (window.oneTrack) window.oneTrack('ViewContent', { content_name: 'profit plan calculator', content_category: 'profit-plan' });
  }
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
