/* Renders reviews into any container on the page.
 *
 * Tries /api/reviews first (Google, once GOOGLE_PLACES_API_KEY and
 * GOOGLE_PLACE_ID are set in Vercel) and falls back to the list below. The
 * shapes match, so nothing else has to change when Google is switched on.
 *
 * Until Google is connected, the two businesses running on Kanvas One speak
 * for it, each in their own voice, about what the site does for them. The
 * dance school is our own; the dog trainer is a customer. Each card links
 * to the live site so the claim can be checked.
 */
(function () {
  'use strict';

  var FALLBACK = [
    { author: 'Kanvas Academy', trade: 'Dance school, North Tyneside', url: 'https://kanvasacademy.com', rating: 5, when: '',
      text: 'New families find us on Google, book a free trial on the site, and by the time they walk in they’ve read what to bring, paid, and signed the forms. We used to spend evenings answering the same questions in messages. Now the site answers them before anyone asks, and every enquiry, chat and booking is in one place. Our shows and our dancers are on our own site, not just on Instagram, so parents can see what they’re joining.' },
    { author: 'Nelly & Nova', trade: 'Dog trainer, Newcastle', url: 'https://nellyandnova.co.uk', rating: 5, when: '',
      text: 'I started with nothing. Now people searching for dog training near me find the site, read how I work, and book themselves in. The questions I used to answer ten times a day are answered on the site before I get the message. Chats, enquiries and bookings all land in the same place, so nothing gets lost while I’m out with a dog. Having my work on my own site, not just social, is what makes people trust me before we’ve met. I’ve got a waiting list.' }
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
    var site = safePhoto(review.url) && /^https:\/\//i.test(review.url)
      ? '<a href="' + esc(review.url) + '" target="_blank" rel="noopener">' + esc(review.url.replace(/^https?:\/\//, '')) + '</a>'
      : '';
    var avatar = safePhoto(review.photo)
      ? '<img class="avatar" src="' + esc(safePhoto(review.photo)) + '" alt="" loading="lazy" width="42" height="42">'
      : '<span class="avatar ' + AV[i % AV.length] + '" aria-hidden="true">' + esc(initials(review.author)) + '</span>';

    return '<article class="quote">'
      + '<div class="stars" aria-label="' + Math.round(review.rating || 5) + ' out of 5">' + stars + '</div>'
      + '<blockquote>“' + esc(review.text) + '”</blockquote>'
      + '<footer>' + avatar + '<div><strong>' + esc(review.author) + '</strong>'
      + (sub ? '<span>' + esc(sub) + '</span>' : '') + (site ? '<span>' + site + '</span>' : '') + '</div></footer>'
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
