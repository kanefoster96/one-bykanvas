/* one — the One setup form for clubs.
 *
 * Loads what they have saved (api/onboarding.js GET), fills the form, and
 * saves quietly a moment after every change (POST with quiet: true), so
 * nothing is lost if they close the page. "Send" saves and tells the other
 * side: the customer's send emails and pushes us, the admin's pushes the
 * customer. Everything is optional; a choice marked data-more ("Other",
 * "Not sure", "Yes") opens the box under it so they can say how they do it.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var loading = $('loading');
  var app = $('app');
  var note = $('obNote');
  var sendBtn = $('obSend');
  var userId = null;
  /* The admin opens a customer's form with ?user=<id>; the API checks. */
  var forUser = (new URLSearchParams(location.search).get('user') || '').trim();
  var viewer = 'owner';
  var logo = [];     /* [{ path, url }] */
  var ttFiles = [];  /* [{ path, url }] the timetable as photos */
  var SECTIONS = ['club', 'coaches', 'classes', 'prices', 'joining', 'extras'];

  function say(message, kind) {
    note.textContent = message || '';
    note.className = 'note' + (kind ? ' ' + kind : '');
  }
  function v(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function set(id, val) { var el = $(id); if (el) el.value = val == null ? '' : String(val); }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function setRadio(name, val) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (i) { i.checked = i.value === val; });
  }
  function checks(boxId) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + boxId + ' input:checked')).map(function (i) { return i.value; });
  }
  function setChecks(boxId, list) {
    var have = Array.isArray(list) ? list : [];
    document.querySelectorAll('#' + boxId + ' input').forEach(function (i) { i.checked = have.indexOf(i.value) !== -1; });
  }

  /* ---- "Other" and "Not sure" open the box under them ---- */
  function paintMore() {
    document.querySelectorAll('.ob-more').forEach(function (box) {
      var field = box.closest('.field');
      var open = !!field.querySelector('input[data-more]:checked');
      /* An answer typed before they changed their mind stays visible. */
      box.hidden = !open && !box.value.trim();
    });
  }

  /* ---- coaches and classes: repeatable cards ---- */
  function addCard(listId, tplId, data) {
    var frag = $(tplId).content.cloneNode(true);
    var card = frag.querySelector('.ob-card');
    if (data) {
      card.querySelectorAll('[data-k]').forEach(function (el) {
        var k = el.getAttribute('data-k');
        el.value = data[k] == null ? '' : String(data[k]);
      });
    }
    card.querySelector('.svc-remove').addEventListener('click', function () { card.remove(); changed(); });
    $(listId).appendChild(frag);
    return card;
  }
  function cards(listId) {
    return Array.prototype.slice.call($(listId).querySelectorAll('.ob-card')).map(function (card) {
      var out = {};
      card.querySelectorAll('[data-k]').forEach(function (el) { out[el.getAttribute('data-k')] = el.value.trim(); });
      return out;
    }).filter(function (c) { return Object.keys(c).some(function (k) { return c[k]; }); });
  }
  $('coachAdd').addEventListener('click', function () { addCard('coachRows', 'coachRow').querySelector('input').focus(); });
  $('classAdd').addEventListener('click', function () { addCard('classRows', 'classRow').querySelector('input').focus(); });

  /* ---- photos: the logo and the timetable, uploaded as chosen ---- */
  function paintPhotos(gridId, list) {
    var grid = $(gridId);
    grid.innerHTML = '';
    list.forEach(function (p, i) {
      var cell = document.createElement('div');
      cell.className = 'ob-photo';
      var img = document.createElement('img');
      img.src = p.url; img.alt = ''; img.loading = 'lazy';
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'ob-photo-x'; x.setAttribute('aria-label', 'Remove'); x.textContent = '×';
      x.addEventListener('click', async function () {
        try { await ONE.db.storage.from('photos').remove([p.path]); } catch (e) { /* the answer is what matters */ }
        list.splice(i, 1); paintPhotos(gridId, list); changed();
      });
      cell.appendChild(img); cell.appendChild(x);
      grid.appendChild(cell);
    });
  }
  function uploader(inputId, gridId, noteId, list, single) {
    $(inputId).addEventListener('change', async function () {
      var files = Array.prototype.slice.call(this.files || []);
      var out = $(noteId);
      this.value = '';
      if (!files.length) return;
      out.textContent = 'Uploading…'; out.className = 'note';
      var failed = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (f.size > 12 * 1024 * 1024) { failed++; continue; }
        var ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        /* The path starts with the user id: the storage policy checks it. */
        var path = userId + '/' + Date.now() + '-' + i + '.' + ext;
        var up = await ONE.db.storage.from('photos').upload(path, f, { upsert: false, contentType: f.type || 'image/jpeg' });
        if (up.error) { failed++; continue; }
        if (single) list.length = 0;
        list.push({ path: path, url: ONE.db.storage.from('photos').getPublicUrl(path).data.publicUrl });
      }
      paintPhotos(gridId, list);
      out.textContent = failed ? failed + ' could not be uploaded (over 12 MB, or not a photo).' : 'Added.';
      out.className = 'note ' + (failed ? 'bad' : 'ok');
      changed();
    });
  }
  uploader('logoInput', 'logoGrid', 'logoNote', logo, true);
  uploader('ttInput', 'ttGrid', 'ttNote', ttFiles, false);

  /* ---- the form as one object ---- */
  function read() {
    return {
      model: 'clubs',
      form: 'club',
      club: { name: v('cl_name'), teach: v('cl_teach'), ages: v('cl_ages'), venue: v('cl_venue'), email: v('cl_email'), phone: v('cl_phone'), social: v('cl_social'), website: v('cl_website'), about: v('cl_about'), logo: logo.slice() },
      coaches: cards('coachRows'),
      classes: { list: cards('classRows'), timetable: v('tt_text'), files: ttFiles.slice() },
      prices: { charge: checks('pr_charge'), charge_more: v('pr_charge_more'), prices: v('pr_prices'), joining_fee: radio('pr_joining_fee'), joining_fee_more: v('pr_joining_fee_more'), sibling: radio('pr_sibling'), sibling_more: v('pr_sibling_more') },
      joining: { trial: radio('jn_trial'), trial_more: v('jn_trial_more'), start: radio('jn_start'), start_more: v('jn_start_more'), offer: radio('jn_offer'), offer_more: v('jn_offer_more') },
      extras: { uniform_required: radio('ex_uniform_required'), uniform_sell: radio('ex_uniform_sell'), uniform_notes: v('ex_uniform_notes'), competitions: radio('ex_competitions'), competitions_more: v('ex_competitions_more'), shows: radio('ex_shows'), shows_more: v('ex_shows_more'), shop: radio('ex_shop'), shop_more: v('ex_shop_more'), anything: v('ex_anything') }
    };
  }
  function fill(a) {
    a = a || {};
    /* Answers from the first form (contact, and the clubs add-on) start
       the matching boxes, so nothing they already told us is asked twice. */
    var old = a.contact || {}, k = Object.assign({}, a.clubs || {}, a.clubs_how || {});
    var c = a.club || {}, cl = a.classes && !Array.isArray(a.classes) ? a.classes : {}, p = a.prices || {}, j = a.joining || {}, x = a.extras || {};
    set('cl_name', c.name || a.business); set('cl_teach', c.teach); set('cl_ages', c.ages);
    set('cl_venue', c.venue || old.address); set('cl_email', c.email || old.email); set('cl_phone', c.phone || old.phone);
    set('cl_social', c.social); set('cl_website', c.website); set('cl_about', c.about);
    logo.length = 0; (Array.isArray(c.logo) ? c.logo : []).forEach(function (ph) { if (ph && ph.url) logo.push(ph); });
    paintPhotos('logoGrid', logo);
    $('coachRows').innerHTML = '';
    var coaches = Array.isArray(a.coaches) ? a.coaches : [];
    (coaches.length ? coaches : [null]).forEach(function (d) { addCard('coachRows', 'coachRow', d); });
    $('classRows').innerHTML = '';
    var list = Array.isArray(cl.list) ? cl.list : [];
    (list.length ? list : [null]).forEach(function (d) { addCard('classRows', 'classRow', d); });
    set('tt_text', cl.timetable || k.classes);
    ttFiles.length = 0; (Array.isArray(cl.files) ? cl.files : []).forEach(function (ph) { if (ph && ph.url) ttFiles.push(ph); });
    paintPhotos('ttGrid', ttFiles);
    setChecks('pr_charge', p.charge); set('pr_charge_more', p.charge_more); set('pr_prices', p.prices || k.fees);
    setRadio('pr_joining_fee', p.joining_fee); set('pr_joining_fee_more', p.joining_fee_more);
    setRadio('pr_sibling', p.sibling); set('pr_sibling_more', p.sibling_more);
    setRadio('jn_trial', j.trial); set('jn_trial_more', j.trial_more || k.first_visit);
    setRadio('jn_start', j.start); set('jn_start_more', j.start_more || k.terms);
    setRadio('jn_offer', j.offer); set('jn_offer_more', j.offer_more);
    setRadio('ex_uniform_required', x.uniform_required); setRadio('ex_uniform_sell', x.uniform_sell); set('ex_uniform_notes', x.uniform_notes);
    setRadio('ex_competitions', x.competitions); set('ex_competitions_more', x.competitions_more);
    setRadio('ex_shows', x.shows); set('ex_shows_more', x.shows_more);
    setRadio('ex_shop', x.shop); set('ex_shop_more', x.shop_more);
    set('ex_anything', x.anything || k.extras);
    paintMore();
  }

  /* ---- progress: a section is done when anything in it is answered ---- */
  function filled(val) {
    if (Array.isArray(val)) return val.some(filled);
    if (val && typeof val === 'object') return Object.keys(val).some(function (key) { return filled(val[key]); });
    return val === true || typeof val === 'number' || (typeof val === 'string' && val.trim() !== '');
  }
  function progress() {
    var a = read();
    var done = 0;
    SECTIONS.forEach(function (key) {
      var has = filled(a[key]);
      if (has) done++;
      var sec = document.querySelector('[data-section="' + key + '"]');
      if (sec) sec.classList.toggle('is-filled', has);
      var tick = document.querySelector('.ob-strip [data-step="' + key + '"]');
      if (tick) { tick.textContent = has ? '✓' : ''; tick.classList.toggle('is-done', has); }
    });
    $('obProgress').textContent = done === SECTIONS.length ? 'All six sections started.' : done + ' of ' + SECTIONS.length + ' sections started.';
  }

  /* ---- saving: quietly as they go, out loud on Send ---- */
  async function token() {
    var sess = await ONE.db.auth.getSession();
    return sess.data && sess.data.session && sess.data.session.access_token;
  }
  async function post(quiet) {
    var res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
      body: JSON.stringify({ answers: read(), user: forUser || undefined, quiet: quiet || undefined })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not save that.');
    return data;
  }
  var timer = null;
  var saving = null;   /* the save in flight, so Send waits for it */
  var pending = false; /* changed since the last save */
  var unsent = false;  /* saved since the last Send */
  var everSent = false;
  function paintSend() {
    var done = viewer !== 'admin' && everSent && !unsent && !pending;
    sendBtn.textContent = viewer === 'admin' ? 'Save and tell them' : (done ? 'Sent' : 'Send to Kanvas One');
    sendBtn.disabled = done;
  }
  function changed() {
    pending = true; unsent = true;
    paintMore(); progress(); paintSend();
    say('Saving…');
    clearTimeout(timer);
    timer = setTimeout(saveNow, 1200);
  }
  async function saveNow() {
    clearTimeout(timer);
    if (saving) await saving.catch(function () {});
    if (!pending) return;
    pending = false;
    saving = post(true);
    try {
      await saving;
      say(viewer === 'admin' ? 'Saved. They hear about it when you press Save and tell them.' : 'Saved. Send it when you’re ready, even half done.', 'ok');
    } catch (err) {
      pending = true;
      say((err.message || 'Could not save that.') + ' We’ll try again in a moment.', 'bad');
      timer = setTimeout(saveNow, 8000);
    } finally {
      saving = null;
    }
  }
  /* Typing is caught by input. change is only for the choices: a text box
     also fires it when it loses focus, which on a tap on Send would shift
     the bar under the finger. File inputs save from uploader(). */
  document.addEventListener('input', function (e) { if (e.target.type !== 'file') changed(); });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio') changed();
  });
  /* Leaving with a save still waiting: try to send it on the way out. */
  window.addEventListener('pagehide', function () {
    if (!pending) return;
    token().then(function (t) {
      fetch('/api/onboarding', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ answers: read(), user: forUser || undefined, quiet: true }) });
    });
  });
  window.addEventListener('beforeunload', function (e) { if (pending) { e.preventDefault(); e.returnValue = ''; } });

  $('obForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearTimeout(timer);
    sendBtn.disabled = true; sendBtn.textContent = viewer === 'admin' ? 'Saving…' : 'Sending…';
    try {
      if (saving) await saving.catch(function () {});
      pending = false;
      var data = await post(false);
      unsent = false; everSent = true;
      if (viewer === 'admin') say(data.changed && data.changed.length ? 'Saved. They’ve been told: ' + data.changed.join(', ') + '.' : 'Saved. Nothing new to tell them.', 'ok');
      else say('Sent. Thank you! We’ll be in touch about anything we need.', 'ok');
    } catch (err) {
      pending = true;
      say(err.message || 'Could not send that. Try again.', 'bad');
    }
    paintSend();
  });

  async function start() {
    var res = await ONE.db.auth.getSession();
    if (!res.data.session) {
      /* Arriving from the One app on another origin: kanvas-handoff.js is
         swapping the token in the hash for a session and will reload. */
      if (/kanvas_handoff=/.test(location.hash)) return;
      location.replace('/login.html?next=' + encodeURIComponent('/club-setup.html' + location.search)); return;
    }
    userId = res.data.session.user.id;
    var bell = $('navBell'); if (bell) bell.hidden = false;
    try {
      var r = await fetch('/api/onboarding' + (forUser ? '?user=' + encodeURIComponent(forUser) : ''), { headers: { Authorization: 'Bearer ' + res.data.session.access_token } });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not load the form.');
      if (data.plan !== 'max') {
        loading.innerHTML = '<p>The setup form is for One customers. <a href="/plans.html#max">See One</a>, or <a href="/account.html">go back to your account</a>.</p>';
        if (window.kanvasReady) window.kanvasReady();
        return;
      }
      /* A One for another kind of business has its own form. */
      var model = (data.answers && data.answers.model) || data.maxModel || '';
      var switching = new URLSearchParams(location.search).has('switch');
      if (model && model !== 'clubs' && !switching) { location.replace('/onboarding.html' + location.search); return; }
      viewer = data.viewer || 'owner';
      if (viewer === 'admin') {
        document.title = (data.business || 'A customer') + ': club setup';
        $('obTitle').textContent = (data.business || 'Their') + ' club setup.';
        $('obLede').textContent = 'Their answers, as they left them. Your changes save as you type; they hear about them when you press Save and tell them.';
        var back = document.querySelector('.ob-back'); if (back) { back.href = '/admin.html'; back.innerHTML = '&larr; Admin'; }
      }
      fill(Object.assign({}, data.answers, { business: data.business }));
      unsent = !!data.unsent;
      everSent = !!data.sentAt;
      progress(); paintSend();
      if (viewer === 'owner' && data.sentAt && !unsent) say('Sent. You can still change anything: it saves as you go, then send it again.', 'ok');
      loading.hidden = true;
      app.hidden = false;
      /* Inside the One app, this tells the app to take its loading screen down. */
      if (window.kanvasReady) window.kanvasReady();
    } catch (err) {
      loading.innerHTML = '<p></p>'; loading.firstChild.textContent = err.message || 'Could not load the form.';
      if (window.kanvasReady) window.kanvasReady();
    }
  }

  /* supabase-client.js runs before this and sets ONE.db synchronously;
     without it there is nothing to load from. */
  if (window.ONE && ONE.ready && ONE.db) start();
  else loading.innerHTML = '<p>Accounts are not configured on this copy of the site.</p>';
})();
