/* The most-asked-for features, shared by the signup wizard, the account
   page's request form and the admin's feature editor, so all three show
   the same list.

   The thirty starters below are baked in and paint instantly. Anything the
   admin has added to the library lives in the feature_ideas table (public
   read - the wizard runs for visitors with no account) and is merged into
   the same array in place once the fetch lands; every consumer paints from
   window.FEATURE_IDEAS at interaction time, so late arrivals just appear.
   If the fetch fails, the thirty starters are the list, quietly. */
window.FEATURE_IDEAS_STATIC = [
  'Contact form', 'Opening hours', 'A menu I can edit myself',
  'Online bookings', 'Table reservations', 'Online payments',
  'Order ahead / click and collect', 'Price list', 'Photo gallery',
  'Customer reviews on my site', 'Map and directions', 'Tap-to-call button',
  'WhatsApp message button', 'Gift vouchers', 'Deposits to stop no-shows',
  'Class or session timetable', 'Membership sign-ups', 'Customer log in area',
  'Live chat', 'Job application form', 'Quote request form',
  'Newsletter sign-up', 'My Instagram feed on the site', 'Before and after photos',
  'FAQs section', 'Delivery or service area', 'Special offers banner',
  'Loyalty stamps or rewards', 'Events calendar', 'Meet the team page'
];
window.FEATURE_IDEAS = window.FEATURE_IDEAS_STATIC.slice();
window.FEATURE_IDEAS_CUSTOM = [];   // {id, name} rows, filled async

(function () {
  'use strict';
  var cfg = window.ONE_SUPABASE || {};
  if (!cfg.url || !cfg.publishableKey || typeof fetch !== 'function') return;

  fetch(cfg.url + '/rest/v1/feature_ideas?select=id,name&order=created_at.asc', {
    headers: { apikey: cfg.publishableKey, Authorization: 'Bearer ' + cfg.publishableKey }
  }).then(function (r) {
    return r.ok ? r.json() : [];
  }).then(function (rows) {
    var have = {};
    window.FEATURE_IDEAS.forEach(function (n) { have[n.toLowerCase()] = true; });
    (rows || []).forEach(function (row) {
      var name = row && row.name && String(row.name).trim();
      if (!name || have[name.toLowerCase()]) return;
      have[name.toLowerCase()] = true;
      window.FEATURE_IDEAS.push(name);
      window.FEATURE_IDEAS_CUSTOM.push({ id: row.id, name: name });
    });
    // Anything already painted (the admin's chips) can redraw itself.
    document.dispatchEvent(new CustomEvent('one:ideas-loaded'));
  }).catch(function () { /* the starters are the list */ });
})();
