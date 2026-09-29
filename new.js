/* one — the /new homepage's hero.
 *
 * One box: a business name, title-cased as it is typed. The phone under
 * it cycles real sites until the first letter, then becomes theirs: a
 * Google result for their business, with their name and their address,
 * and under it the second step, the email and the gift button. Sending
 * posts to /api/lead like the free page does; the phone shows a green
 * tick and the page scrolls on to sell while they wait. Clear the name
 * and the real sites come back.
 */
(function () {
  'use strict';

  var hero = document.getElementById('newFree');
  if (!hero) return;
  var name = document.getElementById('newName');
  var next = document.getElementById('newNext');
  var note = document.getElementById('newNote');
  var hp = document.getElementById('new_extra');
  var shots = document.getElementById('deviceShots');
  var phone = document.getElementById('phoneFree');
  var email = document.getElementById('newEmail');
  var send = document.getElementById('newSend');
  var pnote = document.getElementById('phoneNote');
  var done = document.getElementById('gDone');
  var shownAt = Date.now();
  var sent = false;

  function say(el, msg, kind) { el.textContent = msg || ''; el.className = 'note' + (kind ? ' ' + kind : ''); }
  function filled() { return name.value.trim().length >= 2; }

  /* ---- the name, Title Cased as typed ---- */
  /* Only the first letter of each word is touched, so "McDonald" and
     "iPhone Repairs" survive; the caret stays where it was. */
  function titleCase(s) { return s.replace(/(^|[\s\-'&(]+)([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); }); }
  name.addEventListener('input', function () {
    var at = name.selectionStart, was = name.value, now = titleCase(was);
    if (now !== was) { name.value = now; try { name.setSelectionRange(at, at); } catch (e) { /* not a text control state we can set */ } }
    name.classList.remove('err');
    say(note, '');
    paintMock();
  });

  /* ---- the phone becomes theirs ---- */
  function slug(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ''); }
  function paintMock() {
    var v = name.value.trim();
    if (!v) { shots.classList.remove('is-mine'); return; }
    shots.classList.add('is-mine');
    document.getElementById('gQuery').textContent = v.toLowerCase();
    document.getElementById('gName').textContent = v;
    document.getElementById('gTitle').textContent = v;
    document.getElementById('gUrl').textContent = 'https://' + (slug(v) || 'yourbusiness') + '.co.uk';
    document.getElementById('gDoneLine').textContent = 'Sent. Your page for ' + v + ' lands within 24 hours.';
  }

  /* The arrow, or Enter: over to the phone, on the email. */
  function advance() {
    if (!filled()) { name.classList.add('err'); name.focus(); say(note, 'Tell us your business name.', 'bad'); return; }
    paintMock();
    email.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { email.focus({ preventScroll: true }); }, 450);
  }
  next.addEventListener('click', advance);
  name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); advance(); } });
  hero.addEventListener('submit', function (e) { e.preventDefault(); advance(); });
  document.getElementById('gResult').addEventListener('click', function () { email.focus(); });
  email.addEventListener('input', function () { email.classList.remove('err'); });

  /* ---- send, from the phone ---- */
  phone.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (sent) return;
    var biz = name.value.trim();
    var mail = email.value.trim();
    if (!filled()) { name.classList.add('err'); name.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { name.focus({ preventScroll: true }); }, 450); return say(pnote, 'Tell us your business name first, in the box above.', 'bad'); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { email.classList.add('err'); email.focus(); return say(pnote, 'Enter a valid email address.', 'bad'); }
    send.disabled = true;
    say(pnote, 'Sending…');
    try {
      var res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'free-preview', name: biz, business: biz, email: mail, handle: '',
          campaign: (window.oneFrom && window.oneFrom()) || '',
          website: hp ? hp.value : '',
          elapsed: Date.now() - shownAt
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');
      try { sessionStorage.setItem('one.free-requested', JSON.stringify({ email: mail, id: data.id || '' })); } catch (err) { /* private mode */ }
      sent = true;
      phone.hidden = true;
      done.hidden = false;
      hero.classList.add('is-sent');
      say(note, 'Sent to ' + mail + '.', 'ok');
      name.readOnly = true;
      var to = document.getElementById('pain');
      if (to) setTimeout(function () { to.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 1400);
    } catch (err) {
      say(pnote, err.message || 'Could not send that. Try again.', 'bad');
      send.disabled = false;
    }
  });

  /* The close of the page points back at the box. */
  document.querySelectorAll('[data-to-form]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (sent) { shots.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (filled()) { advance(); return; }
      hero.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { name.focus({ preventScroll: true }); }, 500);
    });
  });
})();
