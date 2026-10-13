/* one — the free growth plan's sums, in one place.
 *
 * Loaded by the homepage (window.GrowthModel) to draw the plan the moment
 * the form is sent, and by api/plan.js (require) to write the same plan into
 * the email. One copy, so the screen and the inbox can never disagree.
 *
 * The averages are our own academy's first three weeks of ads (21 September
 * to 10 October 2026): £103 spent, 21 trial bookings, 4 new members. Kept
 * cautious on purpose, and always shown as "what happened in our academy",
 * never as a forecast. When more clubs are running, their numbers go here.
 */
(function (root, factory) {
  var model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.GrowthModel = model;
})(this, function () {
  var AVG = {
    adBudget: 100,   // £ a month of ads, months 2 to 4 on us (month 1 is the build), and what we fund after
    trialCost: 5,    // £103 / 21 trials
    memberCost: 26   // £103 / 4 members
  };
  var PRICE = { max: 250, business: 50 };

  /* Never shown. A business that can take £3,000 a month or more when it is
     full can carry £250 for the whole system; under that, we recommend
     Business and say why. */
  var MAX_FROM = 3000;
  /* A fifth or more of the places empty: the plan leads with filling them.
     Less than that: it leads with running the place for them, ads on standby. */
  var FILL_SHARE = 0.2;

  function whole(v, lo, hi) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function plan(input) {
    var i = input || {};
    var members = whole(i.members, 0, 5000);
    var fee = whole(i.fee, 1, 5000);
    /* They tell us how many they can take in total; the empty places are
       the difference. (An older caller may still send spaces directly.) */
    var capacity = i.capacity != null && i.capacity !== ''
      ? Math.max(members, whole(i.capacity, 0, 10000))
      : members + whole(i.spaces, 0, 5000);
    var spaces = capacity - members;
    var empty = capacity ? spaces / capacity : 0;
    var perMonth = Math.max(1, Math.floor(AVG.adBudget / AVG.memberCost));
    var months = spaces ? Math.ceil(spaces / perMonth) : 0;
    var yearOne = 0;
    for (var m = 1; m <= 12; m++) yearOne += Math.min(perMonth * m, spaces) * fee;
    return {
      members: members,
      spaces: spaces,
      fee: fee,
      capacity: capacity,
      total: capacity * fee,          // a month, when full
      now: members * fee,             // a month, today
      gap: spaces * fee,              // a month, in empty places
      gapYear: spaces * fee * 12,
      mode: spaces >= 3 && empty >= FILL_SHARE ? 'fill' : 'run',
      trials: Math.round(AVG.adBudget / AVG.trialCost),
      perMonth: perMonth,
      months: months,
      yearOne: yearOne,
      cover: Math.ceil(PRICE.max / fee),
      recommend: capacity * fee >= MAX_FROM ? 'max' : 'business'
    };
  }

  /* The numbers as a query string, for the next page and back again. */
  function query(n) {
    return 'members=' + whole(n.members, 0, 5000) + '&capacity=' + whole(n.capacity, 0, 10000) + '&fee=' + whole(n.fee, 1, 5000);
  }

  /* What they run, as get-started.html's One models know it. */
  function maxModel(type) {
    return ['gym', 'yoga', 'music', 'other'].indexOf(type) === -1 ? 'clubs' : 'other';
  }

  function money(n) {
    return '£' + Math.round(n).toLocaleString('en-GB');
  }

  return { plan: plan, query: query, maxModel: maxModel, money: money, AVG: AVG, PRICE: PRICE };
});
