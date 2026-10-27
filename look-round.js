/* one — the look-round page (look-round.html), the lead magnet.
 *
 * From the calculator the address carries their numbers
 * (?members=&capacity=&fee=) and their number is a line at the top; from the
 * homepage or an ad it starts at the price. Either way the offer is the
 * same: their details, and api/plan.js (kind "app") emails how to download
 * our own club's app and get into its showroom; or a chat with Kane.
 *
 * Details left under the calculator (sessionStorage "one.lr") fill the form
 * in, and that lead is passed on so it is updated, not counted twice.
 *
 * Measured two ways: steps in our own Analytics (beacon.js k1.step, once a
 * visit each) and the Meta Lead, once per lead, with the server's id.
 *   11 Used the calculator           free-check.js
 *   12 Left their email on the calculator   free-check.js
 *   13 Saw their number
 *   14 Opened the look-round offer
 *   15 Asked for the app instructions
 *   16 Chatted about the app
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var G = window.GrowthModel;
  var q = new URLSearchParams(location.search);
  function step(n, label) { (window.k1q = window.k1q || []).push([n, label]); }

  var kept = {};
  try { kept = JSON.parse(sessionStorage.getItem('one.lr') || '{}') || {}; } catch (e) { kept = {}; }

  /* Their number, when they came from the calculator. */
  var p = null;
  if (G && q.get('members') && q.get('capacity') && q.get('fee')) {
    p = G.plan({ members: q.get('members'), capacity: q.get('capacity'), fee: q.get('fee') });
    if (p.spaces > 0) {
      $('lrKickNum').textContent = p.spaces + ' empty space' + (p.spaces === 1 ? ' costs' : 's cost') + ' you';
      $('lrBig').textContent = G.money(p.gapYear);
      $('lrHead').innerHTML = 'Here&rsquo;s how we&rsquo;d fill them. <span class="dim">See it free.</span>';
    } else {
      $('lrKickNum').textContent = 'Every space is full:';
      $('lrBig').textContent = G.money(p.total);
      $('lrLine').textContent = 'a month coming in.';
      $('lrHead').innerHTML = 'Here&rsquo;s how we&rsquo;d run it for you. <span class="dim">See it free.</span>';
    }
    $('lrEdit').href = '/profit-plan?' + G.query(p);
    $('lrNum').hidden = false;
    step(13, 'Saw their number');
  }
  step(14, 'Opened the look-round offer');

  // What they gave under the calculator, ready to send.
  if (kept.business) $('lrBiz').value = kept.business;
  if (kept.email) $('lrEmail').value = kept.email;
  if (kept.name) $('lrName').value = kept.name;

  $('lrChat').addEventListener('click', function () {
    step(16, 'Chatted about the app');
    if (window.oneTrack) window.oneTrack('Contact', { content_name: 'look round the app', content_category: 'app-demo' });
  });

  var shownAt = Date.now();
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  $('lrForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var note = $('lrNote'), btn = $('lrSend');
    var v = function (id) { return $(id).value.trim(); };
    var bad = function (msg, id) { note.className = 'note wide bad'; note.textContent = msg; $(id).focus(); };
    note.className = 'note wide'; note.textContent = '';
    if (v('lrBiz').length < 2) return bad('Add your business name.', 'lrBiz');
    if (v('lrName').length < 2) return bad('Add your full name.', 'lrName');
    if (!EMAIL.test(v('lrEmail'))) return bad('That email doesn’t look right.', 'lrEmail');
    btn.disabled = true; btn.textContent = 'Sending…';
    var body = {
      kind: 'app', name: v('lrName'), business: v('lrBiz'), email: v('lrEmail'),
      website: v('lrWebsite'), elapsed: Date.now() - shownAt, lead: kept.id || '',
      from: p ? 'calculator' : (q.get('from') || 'site'),
      campaign: (window.oneFrom && window.oneFrom()) || ''
    };
    if (p) { body.members = p.members; body.capacity = p.capacity; body.fee = p.fee; }
    fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); })
      .then(function (res) {
        if (!res.ok) {
          btn.disabled = false; btn.textContent = 'Email me the app, free';
          return bad(res.d.error || 'That didn’t send. Try again, or chat with Kane.', res.d.field === 'email' ? 'lrEmail' : res.d.field === 'name' ? 'lrName' : 'lrBiz');
        }
        step(15, 'Asked for the app instructions');
        // One Meta Lead per lead: the calculator may already have counted it.
        var id = res.d.id || '';
        try {
          if (window.oneTrack && id && !sessionStorage.getItem('one.lead.' + id)) {
            sessionStorage.setItem('one.lead.' + id, '1');
            window.oneTrack('Lead', { content_category: 'app-demo' }, id);
          }
          sessionStorage.setItem('one.lr', JSON.stringify({ id: id, name: body.name, business: body.business, email: body.email }));
        } catch (err) {}
        $('lrDoneEmail').textContent = body.email;
        $('lrForm').hidden = true;
        $('lrDone').hidden = false;
        $('lrChat').lastChild.textContent = 'Chat with Kane';
        $('lrDone').querySelector('h3').focus();
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Email me the app, free';
        bad('We couldn’t reach the server. Try again, or chat with Kane.', 'lrEmail');
      });
  });
})();
