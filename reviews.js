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
    { author: 'Sample Name', trade: 'Independent café',  rating: 5, when: 'placeholder',
      text: 'Live in nine days. I change the menu prices from my phone on the bus now — that’s the whole job.' },
    { author: 'Sample Name', trade: 'Barber shop',       rating: 5, when: 'placeholder',
      text: 'I’d been quoted four figures upfront elsewhere. Fifty a month, nothing to set up, and bookings come straight through.' },
    { author: 'Sample Name', trade: 'Landscaping',       rating: 5, when: 'placeholder',
      text: 'We’re on the first page for our town now. That’s new customers every week who’d never have found us.' },
    { author: 'Sample Name', trade: 'Dog groomer',       rating: 5, when: 'placeholder',
      text: 'I ask for a change, it’s done that week. No invoices to argue about, no waiting on a developer to be free.' },
    { author: 'Sample Name', trade: 'Takeaway',          rating: 5, when: 'placeholder',
      text: 'The app was the bit I never thought we could afford. Customers order ahead and it’s paid for itself twice over.' },
    { author: 'Sample Name', trade: 'Personal trainer',  rating: 5, when: 'placeholder',
      text: 'Clients book and pay their own sessions now. That’s an evening a week back for me.' },
    { author: 'Sample Name', trade: 'Nail salon',        rating: 5, when: 'placeholder',
      text: 'Deposits stopped the no-shows almost overnight. I wish I’d done it a year ago.' },
    { author: 'Sample Name', trade: 'Plumber',           rating: 5, when: 'placeholder',
      text: 'I’m not a computer person at all. I filled in one form and they did the rest.' }
  ];

  var AV = ['av1', 'av2', 'av3', 'av4', 'av5'];

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : str;
    return d.innerHTML;
  }

  function card(review, i) {
    var stars = '★★★★★'.slice(0, Math.round(review.rating || 5));
    var sub = review.trade || review.when || '';
    var avatar = review.photo
      ? '<img class="avatar" src="' + esc(review.photo) + '" alt="" loading="lazy" width="42" height="42">'
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
