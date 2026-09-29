/* one — the /new homepage's hero.
 *
 * The phone under the hero cycles through real sites until the visitor
 * types a business name; then it becomes theirs: their name in the
 * header, their name as the address, and the rotation waits. Clear the
 * box and the sites come back.
 *
 * The box is two steps with an arrow each: the name, then the email.
 * Sending posts to /api/lead like the free page does, and instead of a
 * thanks page the box says so and the page scrolls to the next section.
 */
(function () {
  'use strict';

  var form = document.getElementById('newFree');
  if (!form) return;
  var name = document.getElementById('newName');
  var email = document.getElementById('newEmail');
  var next = document.getElementById('newNext');
  var send = document.getElementById('newSend');
  var step2 = document.getElementById('newStep2');
  var note = document.getElementById('newNote');
  var hp = document.getElementById('new_extra');
  var shots = document.getElementById('deviceShots');
  var mockName = document.getElementById('mockName');
  var mockUrl = document.getElementById('mockUrl');
  var mockCall = document.getElementById('mockCall');
  var shownAt = Date.now();

  function say(msg, kind) { note.textContent = msg || ''; note.className = 'note' + (kind ? ' ' + kind : ''); }
  function filled(el) { return el.value.trim().length >= 2; }

  /* ---- the phone becomes theirs ---- */
  function slug(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ''); }
  function paintMock() {
    var v = name.value.trim();
    if (!v) { shots.classList.remove('is-mine'); return; }
    shots.classList.add('is-mine');
    mockName.textContent = v;
    mockUrl.textContent = 'www.' + (slug(v) || 'yourbusiness') + '.co.uk';
    mockCall.textContent = v.length <= 18 ? 'Call ' + v : 'Call now';
  }
  name.addEventListener('input', function () { name.classList.remove('err'); paintMock(); });

  /* ---- two steps, an arrow each ---- */
  function showStep2() {
    if (!step2.hidden) return;
    step2.hidden = false;
    step2.classList.add('in');
  }
  function advance() {
    if (!filled(name)) { name.classList.add('err'); name.focus(); say('Tell us your business name.', 'bad'); return; }
    say('');
    showStep2();
    email.focus();
  }
  next.addEventListener('click', advance);
  name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); advance(); } });
  email.addEventListener('input', function () { email.classList.remove('err'); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var biz = name.value.trim();
    var mail = email.value.trim();
    if (!filled(name)) return advance();
    if (step2.hidden) return advance();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { email.classList.add('err'); email.focus(); return say('Enter a valid email address.', 'bad'); }
    send.disabled = true; next.disabled = true;
    say('Sending…');
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
      /* Done: the box says so, the phone stays theirs, and the page moves
         on to why this is worth their while. */
      form.classList.add('is-sent');
      say('Sent. Your page for ' + biz + ' lands at ' + mail + ' within 24 hours.', 'ok');
      var to = document.getElementById('pain');
      if (to) setTimeout(function () { to.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 500);
    } catch (err) {
      say(err.message || 'Could not send that. Try again.', 'bad');
      send.disabled = false; next.disabled = false;
    }
  });

  /* The close of the page points back at the box. */
  document.querySelectorAll('[data-to-form]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { (step2.hidden ? name : email).focus({ preventScroll: true }); }, 500);
    });
  });
})();
