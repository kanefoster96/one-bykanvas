/* one — the Max setup form.
 *
 * Loads what they have saved (api/onboarding.js GET, which starts the
 * contact section from the profile), fills the form, uploads photos to
 * the photos bucket as they are chosen, and saves the whole thing on Save
 * (POST), which also tells us what changed. Everything is optional; the
 * progress line counts sections with anything in them. The add-on at the
 * end follows the Max picked at the top.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var loading = $('loading');
  var app = $('app');
  var note = $('obNote');
  var dirty = false;
  var userId = null;
  var photos = [];   /* [{ path, url }] already uploaded */

  function say(el, message, kind) {
    el.textContent = message || '';
    el.className = 'note' + (kind ? ' ' + kind : '');
  }
  function v(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function set(id, val) { var el = $(id); if (el) el.value = val == null ? '' : String(val); }
  function on(id) { var el = $(id); return !!(el && el.checked); }
  function setOn(id, val) { var el = $(id); if (el) el.checked = !!val; }
  function checks(boxId) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + boxId + ' input:checked')).map(function (i) { return i.value; });
  }
  function setChecks(boxId, list) {
    var have = Array.isArray(list) ? list : [];
    document.querySelectorAll('#' + boxId + ' input').forEach(function (i) { i.checked = have.indexOf(i.value) !== -1; });
  }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function setRadio(name, val) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (i) { i.checked = i.value === val; });
  }

  /* ---- the add-on for their Max ---- */
  function showAddon() {
    var model = radio('model');
    document.querySelectorAll('.ob-addon').forEach(function (sec) {
      sec.hidden = sec.getAttribute('data-model') !== model;
    });
  }
  document.querySelectorAll('input[name="model"]').forEach(function (i) { i.addEventListener('change', showAddon); });

  /* ---- services: repeatable rows ---- */
  var rows = $('svcRows');
  var tpl = $('svcRow');
  function addService(data) {
    var frag = tpl.content.cloneNode(true);
    var row = frag.querySelector('.svc-row');
    if (data) {
      row.querySelectorAll('[data-k]').forEach(function (el) {
        var k = el.getAttribute('data-k');
        el.value = data[k] == null ? '' : String(data[k]);
      });
    }
    row.querySelector('.svc-remove').addEventListener('click', function () { row.remove(); dirty = true; progress(); });
    rows.appendChild(frag);
  }
  function services() {
    return Array.prototype.slice.call(rows.querySelectorAll('.svc-row')).map(function (row) {
      var out = {};
      row.querySelectorAll('[data-k]').forEach(function (el) { out[el.getAttribute('data-k')] = el.value.trim(); });
      return out;
    }).filter(function (s) { return s.name || s.price || s.includes; });
  }
  $('svcAdd').addEventListener('click', function () { addService(); dirty = true; });

  /* ---- photos: uploaded as they are chosen, kept as public URLs ---- */
  var grid = $('photoGrid');
  var photoNote = $('photoNote');
  function paintPhotos() {
    grid.innerHTML = '';
    photos.forEach(function (p, i) {
      var cell = document.createElement('div');
      cell.className = 'ob-photo';
      var img = document.createElement('img');
      img.src = p.url; img.alt = ''; img.loading = 'lazy';
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'ob-photo-x'; x.setAttribute('aria-label', 'Remove'); x.textContent = '×';
      x.addEventListener('click', async function () {
        try { await ONE.db.storage.from('photos').remove([p.path]); } catch (e) { /* the row is what matters */ }
        photos.splice(i, 1); dirty = true; paintPhotos(); progress();
      });
      cell.appendChild(img); cell.appendChild(x);
      grid.appendChild(cell);
    });
  }
  $('photoInput').addEventListener('change', async function () {
    var files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!files.length) return;
    say(photoNote, 'Uploading ' + files.length + (files.length === 1 ? ' photo…' : ' photos…'));
    var failed = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.size > 12 * 1024 * 1024) { failed++; continue; }
      var ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      /* The path starts with the user id: the storage policy checks it. */
      var path = userId + '/' + Date.now() + '-' + i + '.' + ext;
      var up = await ONE.db.storage.from('photos').upload(path, f, { upsert: false, contentType: f.type || 'image/jpeg' });
      if (up.error) { failed++; continue; }
      var pub = ONE.db.storage.from('photos').getPublicUrl(path);
      photos.push({ path: path, url: pub.data.publicUrl });
    }
    paintPhotos();
    dirty = true; progress();
    say(photoNote, failed ? (files.length - failed) + ' added, ' + failed + ' could not be uploaded (over 12 MB, or not an image). Save to keep them.' : 'Added. Save to keep them.', failed ? 'bad' : 'ok');
  });

  /* ---- the form as one object, section by section ---- */
  function read() {
    return {
      model: radio('model'),
      contact: { phone: v('c_phone'), email: v('c_email'), whatsapp: on('c_whatsapp'), area: v('c_area'), address: v('c_address'), reach: v('c_reach'), customers_live: checks('custWhere') },
      services: services(),
      services_generated: on('svc_generated'),
      offer: { job: v('o_job'), upsells: v('o_upsell'), why: v('o_why') },
      customers: { sources: checks('custSources'), notes: v('cu_notes'), jobs_per_week: v('cu_jobs'), job_value: v('cu_value'), big_job_value: v('cu_big') },
      bookings: { how: radio('book'), app: v('b_app'), lead_time: v('b_lead'), want: radio('bookwant') },
      payments: { methods: checks('payMethods'), upfront: radio('upfront'), amount: v('p_amount'), when: v('p_when'), offset: on('p_offset'), invoices: on('p_invoices'), big_job: v('p_bigjob'), finance: radio('finance') },
      online: { facebook: radio('fb'), facebook_link: v('a_fb'), instagram: v('a_ig'), directory: v('a_directory'), gbp: radio('gbp'), gbp_link: v('a_gbp'), domain: v('a_domain'), registrar: v('a_registrar'), existing_site: v('a_existing') },
      photos: photos.map(function (p) { return { path: p.path, url: p.url }; }),
      trades: { gas_safe: v('t_gassafe'), registrations: v('t_regs'), insured: on('t_insured'), brands: v('t_brands'), works_on: v('t_workon'), emergency: radio('emerg'), emergency_terms: v('t_emerg'), next_service: v('t_repeat'), base: v('t_base') },
      clubs: { classes: v('k_classes'), first_visit: v('k_trial'), fees: v('k_fees'), terms: v('k_terms'), extras: v('k_extras') },
      salon: { team: v('s_team'), no_show: v('s_noshow'), rebook: v('s_rebook'), before_first: v('s_tests'), retail: v('s_retail') },
      extras: { reviews: v('x_reviews'), referral_reward: v('x_referral'), report_to: v('x_report'), anything: v('x_anything') }
    };
  }
  function fill(a) {
    a = a || {};
    var c = a.contact || {}, o = a.offer || {}, cu = a.customers || {}, b = a.bookings || {}, p = a.payments || {}, ol = a.online || {}, t = a.trades || {}, k = a.clubs || {}, s = a.salon || {}, x = a.extras || {};
    setRadio('model', a.model); showAddon();
    set('c_phone', c.phone); set('c_email', c.email); setOn('c_whatsapp', c.whatsapp); set('c_area', c.area); set('c_address', c.address); set('c_reach', c.reach); setChecks('custWhere', c.customers_live);
    rows.innerHTML = '';
    (Array.isArray(a.services) && a.services.length ? a.services : [null]).forEach(addService);
    setOn('svc_generated', a.services_generated);
    set('o_job', o.job); set('o_upsell', o.upsells); set('o_why', o.why);
    setChecks('custSources', cu.sources); set('cu_notes', cu.notes); set('cu_jobs', cu.jobs_per_week); set('cu_value', cu.job_value); set('cu_big', cu.big_job_value);
    setRadio('book', b.how); set('b_app', b.app); set('b_lead', b.lead_time); setRadio('bookwant', b.want);
    setChecks('payMethods', p.methods); setRadio('upfront', p.upfront); set('p_amount', p.amount); set('p_when', p.when); setOn('p_offset', p.offset); setOn('p_invoices', p.invoices); set('p_bigjob', p.big_job); setRadio('finance', p.finance);
    setRadio('fb', ol.facebook); set('a_fb', ol.facebook_link); set('a_ig', ol.instagram); set('a_directory', ol.directory); setRadio('gbp', ol.gbp); set('a_gbp', ol.gbp_link); set('a_domain', ol.domain); set('a_registrar', ol.registrar); set('a_existing', ol.existing_site);
    photos = Array.isArray(a.photos) ? a.photos.filter(function (ph) { return ph && ph.url; }) : [];
    paintPhotos();
    set('t_gassafe', t.gas_safe); set('t_regs', t.registrations); setOn('t_insured', t.insured); set('t_brands', t.brands); set('t_workon', t.works_on); setRadio('emerg', t.emergency); set('t_emerg', t.emergency_terms); set('t_repeat', t.next_service); set('t_base', t.base);
    set('k_classes', k.classes); set('k_trial', k.first_visit); set('k_fees', k.fees); set('k_terms', k.terms); set('k_extras', k.extras);
    set('s_team', s.team); set('s_noshow', s.no_show); set('s_rebook', s.rebook); set('s_tests', s.before_first); set('s_retail', s.retail);
    set('x_reviews', x.reviews); set('x_referral', x.referral_reward); set('x_report', x.report_to); set('x_anything', x.anything);
  }

  /* A section counts as started when anything in it is set. Only the
     sections on screen count towards the total. */
  function filled(val) {
    if (Array.isArray(val)) return val.length > 0;
    if (val && typeof val === 'object') return Object.keys(val).some(function (k) { return filled(val[k]); });
    return val === true || (typeof val === 'string' && val.trim() !== '');
  }
  function progress() {
    var a = read();
    var secs = Array.prototype.slice.call(document.querySelectorAll('.ob-section')).filter(function (s) { return !s.hidden && s.getAttribute('data-section') !== 'model'; });
    var done = 0;
    secs.forEach(function (sec) {
      var key = sec.getAttribute('data-section');
      var has = key === 'services' ? (filled(a.services) || a.services_generated) : filled(a[key]);
      sec.classList.toggle('is-filled', has);
      if (has) done++;
    });
    $('obProgress').textContent = done + ' of ' + secs.length + ' sections have something in them.';
  }

  document.addEventListener('input', function () { dirty = true; progress(); });
  document.addEventListener('change', function () { dirty = true; progress(); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function token() {
    var sess = await ONE.db.auth.getSession();
    return sess.data && sess.data.session && sess.data.session.access_token;
  }

  $('obForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('obSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      var res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
        body: JSON.stringify({ answers: read() })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not save that.');
      dirty = false;
      say(note, data.changed && data.changed.length ? 'Saved. I’ve been told: ' + data.changed.join(', ') + '.' : 'Saved. Nothing changed since last time.', 'ok');
    } catch (err) {
      say(note, err.message || 'Could not save that. Try again.', 'bad');
    }
    btn.disabled = false; btn.textContent = 'Save';
  });

  async function start() {
    var res = await ONE.db.auth.getSession();
    if (!res.data.session) { location.replace('/login.html?next=/onboarding.html'); return; }
    userId = res.data.session.user.id;
    var bell = $('navBell'); if (bell) bell.hidden = false;
    try {
      var r = await fetch('/api/onboarding', { headers: { Authorization: 'Bearer ' + res.data.session.access_token } });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not load the form.');
      if (data.plan !== 'max') {
        loading.innerHTML = '<p>The Max setup form is for Max customers. <a href="/plans.html#max">See Max</a>, or <a href="/account.html">go back to your account</a>.</p>';
        return;
      }
      fill(data.answers);
      progress();
      dirty = false;
      loading.hidden = true;
      app.hidden = false;
    } catch (err) {
      loading.innerHTML = '<p>' + (err.message || 'Could not load the form.') + '</p>';
    }
  }

  /* supabase-client.js runs before this and sets ONE.db synchronously;
     without it there is nothing to load from. */
  if (window.ONE && ONE.ready && ONE.db) start();
  else loading.innerHTML = '<p>Accounts are not configured on this copy of the site.</p>';
})();
