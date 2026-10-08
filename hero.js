/* one — the homepage hero.
 *
 * One row, two ways in. Joining, the default: the business name, Title
 * Cased as it is typed, and the arrow goes straight into signing up for
 * Starter with the name filled in. Or, for anyone unsure ("Not sure? See
 * your free design first"), three steps, each fading out as the next
 * fades in:
 *   1. the business name, and an arrow;
 *   2. the email, and the gift button that sends the free page
 *      (/api/lead, as the free page does);
 *   3. a link to the business, added to the lead just sent, so the page
 *      is designed from something real. Skippable.
 * Then the page scrolls on to sell while they wait.
 */
(function () {
  'use strict';

  var form = document.getElementById('newFree');
  if (!form) return;
  var name = document.getElementById('newName');
  var next = document.getElementById('newNext');
  var email = document.getElementById('newEmail');
  var send = document.getElementById('newSend');
  var handle = document.getElementById('newHandle');
  var handleGo = document.getElementById('newHandleGo');
  var skip = document.getElementById('newSkip');
  var steps = [document.getElementById('newStep1'), document.getElementById('newStep2'), document.getElementById('newStep3')];
  var note = document.getElementById('newNote');
  var micro = document.getElementById('newMicro');
  var hp = document.getElementById('new_extra');
  var shownAt = Date.now();
  var leadId = null;
  var at = 0;

  var modeBtn = document.getElementById('newMode');
  var mode = 'join';
  var JOIN_MICRO = micro ? micro.innerHTML : '';
  function setMode(m, focus) {
    mode = m;
    next.setAttribute('aria-label', m === 'free' ? 'Next' : 'Get started');
    name.placeholder = m === 'free' ? 'Your business name, for your free design' : 'What\u2019s your business name?';
    if (micro) { if (m === 'free') micro.textContent = 'Free, no card. In your inbox within 24 hours.'; else micro.innerHTML = JOIN_MICRO; }
    if (modeBtn) modeBtn.textContent = m === 'free' ? 'Rather get started now? \u00a39.99 a month' : 'Not sure? See your free design first';
    if (at === 1) go(0, focus ? name : null);
    else if (focus) name.focus({ preventScroll: true });
  }
  if (modeBtn) modeBtn.addEventListener('click', function () { setMode(mode === 'free' ? 'join' : 'free', true); });

  function say(msg, kind) { note.textContent = msg || ''; note.className = 'note' + (kind ? ' ' + kind : ''); }
  function filled(el) { return el.value.trim().length >= 2; }

  /* ---- the name, Title Cased as typed ---- */
  function titleCase(s) { return s.replace(/(^|[\s\-'&(]+)([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); }); }
  name.addEventListener('input', function () {
    var pos = name.selectionStart, was = name.value, now = titleCase(was);
    if (now !== was) { name.value = now; try { name.setSelectionRange(pos, pos); } catch (e) { /* not settable here */ } }
    name.classList.remove('err');
    say('');
  });

  /* ---- one row, three steps ---- */
  /* The step on screen fades out; the next fades in where it was, and
     its box takes focus. */
  function go(n, focusEl) {
    var from = steps[at], to = steps[n];
    at = n;
    from.classList.add('out');
    setTimeout(function () {
      from.hidden = true; from.classList.remove('out', 'in');
      to.hidden = false; to.classList.add('in');
      if (focusEl) setTimeout(function () { focusEl.focus({ preventScroll: true }); }, 80);
    }, 230);
  }

  function step2() {
    if (!filled(name)) { name.classList.add('err'); name.focus(); say('Tell us your business name.', 'bad'); return; }
    say('');
    if (mode === 'join') {
      location.assign('/get-started.html?plan=starter&business=' + encodeURIComponent(name.value.trim()));
      return;
    }
    go(1, email);
  }
  next.addEventListener('click', step2);
  name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); step2(); } });
  email.addEventListener('input', function () { email.classList.remove('err'); });

  /* ---- send: the gift ---- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (at === 0) return step2();
    if (at === 2) return addLink();
    if (leadId) return;
    var biz = name.value.trim();
    var mail = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { email.classList.add('err'); email.focus(); return say('Enter a valid email address.', 'bad'); }
    send.disabled = true;
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
      leadId = data.id || '';
      if (window.oneTrack) window.oneTrack('Lead', { content_category: 'free-preview' }, leadId || null);
      try { sessionStorage.setItem('one.free-requested', JSON.stringify({ email: mail, id: leadId, tracked: true })); } catch (err) { /* private mode */ }
      say('');
      micro.textContent = 'Your page for ' + biz + ' lands at ' + mail + ' within 24 hours.';
      var alt = document.getElementById('newAlt');
      if (alt) alt.hidden = true;
      go(2, handle);
    } catch (err) {
      say(err.message || 'Could not send that. Try again.', 'bad');
      send.disabled = false;
    }
  });

  /* ---- the link, on the lead already sent ---- */
  function finish(msg) {
    steps[2].classList.add('out');
    setTimeout(function () {
      steps[2].hidden = true;
      form.classList.add('is-sent');
      say(msg, 'ok');
      var to = document.getElementById('offer');
      if (to) setTimeout(function () { to.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 900);
    }, 230);
  }
  async function addLink() {
    var link = handle.value.trim();
    if (!link) { handle.classList.add('err'); handle.focus(); return say('Paste a link, or skip.', 'bad'); }
    if (!leadId) return finish('Thanks. Keep scrolling while we get to work.');
    handleGo.disabled = true;
    try {
      await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ update: leadId, handle: link }) });
    } catch (err) { /* the page is already on its way; the link was a bonus */ }
    finish('Thanks, that helps. Keep scrolling while we get to work.');
  }
  handleGo.addEventListener('click', addLink);
  handle.addEventListener('input', function () { handle.classList.remove('err'); });
  handle.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });
  skip.addEventListener('click', function () { finish('No problem. Keep scrolling while we get to work.'); });

  /* The close of the page points back at the box: as it is, or switched
     to the free design ([data-to-free]). */
  document.querySelectorAll('[data-to-form], [data-to-free]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (b.hasAttribute('data-to-free') && mode !== 'free' && !leadId) setMode('free');
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var target = at === 0 ? name : at === 1 ? email : handle;
      setTimeout(function () { if (!form.classList.contains('is-sent')) target.focus({ preventScroll: true }); }, 500);
    });
  });
})();
