/* Flat fee or a cut of every payment: what a booking platform that takes
 * 3% of every payment (on top of card fees, which are the same either
 * way) costs at the club's size, next to One's flat £250. Any element with
 * [data-fee-calc] holding an input[data-fee-in], [data-fee-pct],
 * [data-fee-bar-pct], [data-fee-bar-us] and [data-fee-out]. Homepage and
 * /clubs. The sums are honest both ways: below about £8,300 a month the
 * 3% costs less, and it says so. */
(function () {
  'use strict';
  var FLAT = 25000, RATE = 0.03;
  function money(pence) {
    var n = Math.round(pence / 100);
    return '£' + n.toLocaleString('en-GB');
  }
  function run(box) {
    var input = box.querySelector('[data-fee-in]');
    var takings = Math.max(0, Number(String(input.value).replace(/[£,\s]/g, '')) || 0) * 100;
    var cut = Math.round(takings * RATE);
    var top = Math.max(cut, FLAT, 1);
    box.querySelector('[data-fee-pct]').textContent = money(cut) + ' a month';
    box.querySelector('[data-fee-bar-pct]').style.setProperty('--w', Math.max(2, cut / top * 100) + '%');
    box.querySelector('[data-fee-bar-us]').style.setProperty('--w', Math.max(2, FLAT / top * 100) + '%');
    var out = box.querySelector('[data-fee-out]');
    if (!takings) { out.textContent = 'Add what your members pay you each month.'; return; }
    if (cut > FLAT) {
      out.innerHTML = 'With One you keep <b>' + money((cut - FLAT) * 12) + ' more a year</b>, and the gap grows every time you grow. Plus your website, Google, AI and ads are done for you.';
    } else if (cut === FLAT) {
      out.innerHTML = 'The same in fees. The difference is everything else: your website, Google, AI and ads, done for you.';
    } else {
      out.innerHTML = 'At your size a 3% platform costs <b>' + money(FLAT - cut) + ' a month less</b>. But it won’t build your website, get you found on Google and AI, or run your ads, which usually cost <b>£450 or more a month</b> bought separately. And its fee rises with every member you add.';
    }
  }
  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-fee-calc]'), function (box) {
      var input = box.querySelector('[data-fee-in]');
      if (!input) return;
      input.addEventListener('input', function () { run(box); });
      run(box);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
