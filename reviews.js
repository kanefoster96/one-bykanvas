/* Renders reviews into any container on the page.
 *
 * Tries /api/reviews first (Google, once GOOGLE_PLACES_API_KEY and
 * GOOGLE_PLACE_ID are set in Vercel) and falls back to the list below. The
 * shapes match, so nothing else has to change when Google is switched on.
 *
 * NOTE: these fallbacks are placeholders. Replace them with real, attributed
 * quotes, or connect Google, before relying on them.
 */
(function () {
  'use strict';

  var FALLBACK = [
    { author: 'Priya Shah',       trade: 'Independent café',  rating: 5, when: 'placeholder',
      text: 'been live about a week now and i’ve already changed the menu twice myself, so much easier than i thought it’d be' },
    { author: 'Jamie Ellis',      trade: 'Barber shop',       rating: 5, when: 'placeholder',
      text: 'no idea why i left it so long tbh. up and running in about 10 days and bookings just come straight through now' },
    { author: 'Craig Whitfield',  trade: 'Landscaping',       rating: 5, when: 'placeholder',
      text: 'we’re actually showing up when people search for gardeners near us now, wasn’t expecting that so quick' },
    { author: 'Sophie Marsh',     trade: 'Dog groomer',       rating: 5, when: 'placeholder',
      text: 'i just message if i want something changed and it’s sorted, no faffing about with invoices or waiting around' },
    { author: 'Faisal Ahmed',     trade: 'Takeaway',          rating: 5, when: 'placeholder',
      text: 'the ordering thing has genuinely been huge for us, loads of regulars order ahead now instead of ringing up' },
    { author: 'Liam Doyle',       trade: 'Personal trainer',  rating: 5, when: 'placeholder',
      text: 'clients book and pay for their own sessions now, honestly saved me so much time chasing people about it' },
    { author: 'Chloe Bennett',    trade: 'Nail salon',        rating: 5, when: 'placeholder',
      text: 'deposits have pretty much stopped the no shows, should’ve set this up ages ago' },
    { author: 'Dave Sutton',      trade: 'Plumber',           rating: 5, when: 'placeholder',
      text: 'not great with computers if i’m honest but they just sorted the whole thing for me, dead easy' }
  ];

  var AV = ['av1', 'av2', 'av3', 'av4', 'av5'];

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /* Escapes quotes as well as tags, because some of this lands inside
     attribute values, where a stray double-quote is the way out. */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* A photo goes into a src attribute, so it has to actually be a web
     address - anything else (javascript:, data:, or plain junk) is skipped
     and the initials avatar stands in. */
  function safePhoto(u) {
    var s = String(u || '');
    return /^(https:\/\/|\/)/i.test(s) ? s : '';
  }

  function card(review, i) {
    var stars = '★★★★★'.slice(0, Math.round(review.rating || 5));
    var sub = review.trade || review.when || '';
    var avatar = safePhoto(review.photo)
      ? '<img class="avatar" src="' + esc(safePhoto(review.photo)) + '" alt="" loading="lazy" width="42" height="42">'
      : '<span class="avatar ' + AV[i % AV.length] + '" aria-hidden="true">' + esc(initials(review.author)) + '</span>';

    return '<article class="quote">'
      + '<div class="stars" aria-label="' + Math.round(review.rating || 5) + ' out of 5">' + stars + '</div>'
      + '<blockquote>“' + esc(review.text) + '”</blockquote>'
      + '<footer>' + avatar + '<div><strong>' + esc(review.author) + '</strong>'
      + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div></footer>'
      + '</article>';
  }

  function paint(list, source) {
    document.querySelectorAll('[data-reviews]').forEach(function (host) {
      var limit = parseInt(host.dataset.reviews, 10);
      var use = limit > 0 ? list.slice(0, limit) : list;
      host.innerHTML = use.map(card).join('');
      host.setAttribute('data-source', source);
    });

    document.querySelectorAll('[data-review-count]').forEach(function (el) {
      el.textContent = String(list.length);
    });
  }

  function paintSummary(data) {
    var rating = document.getElementById('rvRating');
    var total = document.getElementById('rvTotal');
    if (rating && data.rating) rating.textContent = Number(data.rating).toFixed(1);
    if (total && data.total) total.textContent = data.total + ' Google reviews';
    /* The score block stays hidden until here: an average and a count are
       claims about real, verifiable reviews, and only Google data is that. */
    var summary = document.getElementById('rvSummary');
    if (summary && data.rating) summary.hidden = false;
  }

  if (!document.querySelector('[data-reviews]')) return;

  paint(FALLBACK, 'fallback');   // show something immediately

  fetch('/api/reviews')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.configured || !data.reviews || !data.reviews.length) return;
      paint(data.reviews, 'google');
      paintSummary(data);
      document.querySelectorAll('.rv-google').forEach(function (el) { el.hidden = false; });
    })
    .catch(function () { /* keep the fallback */ });
})();
