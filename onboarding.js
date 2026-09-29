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

  /* ---- the trade, and its usual jobs ---- */
  var CATALOG = window.ONE_TRADES || {};
  var tradeSel = $('svc_trade');
  var jobList = $('jobList');
  var jobTpl = $('jobItem');
  Object.keys(CATALOG).forEach(function (t) {
    var o = document.createElement('option'); o.value = t; o.textContent = t; tradeSel.appendChild(o);
  });
  var other = document.createElement('option'); other.value = 'Other'; other.textContent = 'Something else'; tradeSel.appendChild(other);

  /* The catalogue entry for the chosen trade: jobs plus the suggestion
     lists. An older catalogue was just the jobs array. */
  function entry() {
    var e = CATALOG[tradeSel.value];
    if (!e) return { jobs: [] };
    return Array.isArray(e) ? { jobs: e } : e;
  }

  /* A tick list from the catalogue. Anything saved that the list does not
     suggest is added as its own tick, so nothing they chose is lost. The
     tail is the "none of these" answer: ticking it clears the rest, and
     ticking any of the rest clears it. */
  function paintTicks(id, items, saved, tail) {
    var box = $(id);
    box.innerHTML = '';
    var have = Array.isArray(saved) ? saved : [];
    var none = tail || [];
    var list = (items || []).concat(none);
    have.forEach(function (s) { if (list.indexOf(s) === -1) list.push(s); });
    list.forEach(function (name) {
      var l = document.createElement('label'); l.className = 'check';
      var c = document.createElement('input'); c.type = 'checkbox'; c.value = name; c.checked = have.indexOf(name) !== -1;
      if (none.indexOf(name) !== -1) c.setAttribute('data-none', '');
      l.appendChild(c); l.appendChild(document.createTextNode(' ' + name));
      box.appendChild(l);
    });
    if (none.length && !box.hasAttribute('data-exclusive')) {
      box.setAttribute('data-exclusive', '');
      box.addEventListener('change', function (e) {
        if (!e.target.checked) return;
        var isNone = e.target.hasAttribute('data-none');
        box.querySelectorAll('input').forEach(function (i) {
          if (i !== e.target && (isNone || i.hasAttribute('data-none'))) i.checked = false;
        });
      });
    }
  }
  function placeholder(id, text) { var el = $(id); if (el) el.placeholder = text || ''; }
  /* The first form's "how often" scale, mapped onto the one that fits a
     ten-week job as well as a ten-minute one. */
  var OFTEN = { 'Most weeks': 'Every week', 'Some weeks': 'Most months', 'Now and then': 'A few times a year' };
  function often(val) { return OFTEN[val] || val || ''; }
  /* The first form's "where bookings live" answers, mapped the same way. */
  var BOOK = { 'They call or text, I tell them my next slot': 'My head and my phone', 'They just turn up': 'My head and my phone' };

  /* The suggestion lists and the examples, for the chosen trade. With no
     saved answers, whatever is ticked now is kept. */
  function paintPicks(a) {
    var e = entry();
    var t = a ? (a.trades || {}) : { registrations: checks('regPick') };
    var o = a ? (a.offer || {}) : { addons: checks('addonPick') };
    var l = a ? (a.later || {}) : { smaller: checks('smallerPick'), again: checks('againPick'), plan: checks('planPick') };
    paintTicks('regPick', e.regs, t.registrations);
    paintTicks('addonPick', e.addon, o.addons);
    paintTicks('smallerPick', e.smaller, l.smaller);
    paintTicks('againPick', e.again, l.again, ['Nothing comes round again']);
    paintTicks('planPick', e.plan, l.plan, ['Nothing like that, one-off jobs']);
    placeholder('t_brands', e.brands); placeholder('o_why', e.why); placeholder('t_emerg', e.urgent);
  }

  /* The usual jobs for the chosen trade, as ticks. Ticking one opens its
     row, with the catalogue's pricing and flow already chosen. */
  function paintJobs(saved) {
    var trade = tradeSel.value;
    $('tradeOtherField').hidden = trade !== 'Other';
    jobList.innerHTML = '';
    var have = {};
    (saved || []).forEach(function (j) { if (j && j.name) have[j.name] = j; });
    entry().jobs.forEach(function (def) {
      var frag = jobTpl.content.cloneNode(true);
      var item = frag.querySelector('.ob-job');
      item.setAttribute('data-name', def[0]);
      item.querySelector('[data-k=label]').textContent = def[0];
      var box = item.querySelector('[data-k=on]');
      var more = item.querySelector('.ob-job-more');
      var was = have[def[0]];
      box.checked = !!was;
      more.hidden = !was;
      item.querySelector('[data-k=pricing]').value = was ? (was.pricing || '') : def[1];
      item.querySelector('[data-k=flow]').value = was ? (was.flow || '') : (def[2] === 'book' ? 'Book straight in' : 'Ask me first');
      item.querySelector('[data-k=often]').value = was ? often(was.often) : '';
      item.querySelector('[data-k=price]').value = was ? (was.price || '') : '';
      box.addEventListener('change', function () { more.hidden = !box.checked; paintMost(); });
      jobList.appendChild(frag);
    });
    paintMost();
  }
  /* "Which one do you do most": the ticked jobs, and the other rows with
     a name, as radios. "Jobs you'd rather not do" offers the same names,
     and a tick there only survives while its job is still on the form. */
  function paintMost(keep, dont) {
    var pick = $('mostPick');
    var current = keep || radio('most');
    pick.innerHTML = '';
    var names = tickedJobs().map(function (j) { return j.name; }).concat(otherJobs().map(function (j) { return j.name; }));
    $('mostLabel').hidden = names.length < 2;
    names.forEach(function (n) {
      var l = document.createElement('label'); l.className = 'check';
      var r = document.createElement('input'); r.type = 'radio'; r.name = 'most'; r.value = n; r.checked = n === current;
      l.appendChild(r); l.appendChild(document.createTextNode(' ' + n));
      pick.appendChild(l);
    });
    if (names.length === 1) { var only = pick.querySelector('input'); if (only) only.checked = true; }
    /* The ad runs on it: section 2 starts from the same answer. */
    var most = radio('most');
    if (most && !v('o_job')) set('o_job', most);
    var others = names.filter(function (n) { return n !== most; });
    var up = $('o_upsell'); if (up && others.length) up.placeholder = others.slice(0, 3).join(', ');
    paintTicks('dontPick', names, (dont || checks('dontPick')).filter(function (n) { return names.indexOf(n) !== -1; }));
  }
  function tickedJobs() {
    return Array.prototype.slice.call(jobList.querySelectorAll('.ob-job')).filter(function (i) { return i.querySelector('[data-k=on]').checked; }).map(function (i) {
      return { name: i.getAttribute('data-name'), often: i.querySelector('[data-k=often]').value, price: i.querySelector('[data-k=price]').value.trim(), pricing: i.querySelector('[data-k=pricing]').value, flow: i.querySelector('[data-k=flow]').value };
    });
  }
  tradeSel.addEventListener('change', function () { paintJobs([]); paintPicks(); });
  jobList.addEventListener('change', function (e) { if (e.target.name !== 'most') paintMost(); });

  /* ---- other jobs: repeatable rows ---- */
  var rows = $('svcRows');
  var tpl = $('svcRow');
  function addService(data) {
    var frag = tpl.content.cloneNode(true);
    var row = frag.querySelector('.svc-row');
    if (data) {
      row.querySelectorAll('[data-k]').forEach(function (el) {
        var k = el.getAttribute('data-k');
        el.value = k === 'often' ? often(data[k]) : (data[k] == null ? '' : String(data[k]));
      });
    }
    row.querySelector('.svc-remove').addEventListener('click', function () { row.remove(); dirty = true; progress(); });
    rows.appendChild(frag);
  }
  function otherJobs() {
    return Array.prototype.slice.call(rows.querySelectorAll('.svc-row')).map(function (row) {
      var out = { other: true };
      row.querySelectorAll('[data-k]').forEach(function (el) { out[el.getAttribute('data-k')] = el.value.trim(); });
      return out;
    }).filter(function (s) { return s.name; });
  }
  function services() {
    return {
      trade: tradeSel.value === 'Other' ? v('svc_trade_other') : tradeSel.value,
      jobs: tickedJobs().concat(otherJobs()),
      most: radio('most')
    };
  }
  $('svcAdd').addEventListener('click', function () { addService(); dirty = true; });
  rows.addEventListener('input', function () { paintMost(); });

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
      contact: { phone: v('c_phone'), email: v('c_email'), whatsapp: on('c_whatsapp'), area: v('c_area'), base: v('c_base'), address: v('c_address'), reach: v('c_reach'), customers_live: checks('custWhere') },
      services: services(),
      services_generated: on('svc_generated'),
      offer: { job: v('o_job'), upsells: v('o_upsell'), addons: checks('addonPick'), addons_other: v('o_addon_other'), moment: v('o_moment'), why: v('o_why') },
      customers: { sources: checks('custSources'), notes: v('cu_notes'), jobs_per_week: v('cu_jobs'), job_value: v('cu_value'), big_job_value: v('cu_big'), partners: checks('partnerPick'), partner_names: v('cu_partners') },
      want: { capacity: v('w_capacity'), best: checks('bestPick'), dont: checks('dontPick'), dont_other: v('w_dont_other'), busiest: v('w_busy'), quietest: v('w_quiet') },
      bookings: { first: radio('first'), how: radio('book'), app: v('b_app'), lead_time: v('b_lead'), want: radio('bookwant') },
      payments: { methods: checks('payMethods'), upfront: radio('upfront'), amount: v('p_amount'), when: v('p_when'), offset: on('p_offset'), invoices: on('p_invoices'), big_job: v('p_bigjob'), finance: radio('finance') },
      later: { now: v('l_now'), smaller: checks('smallerPick'), smaller_other: v('l_smaller_other'), again: checks('againPick'), again_other: v('l_again_other'), plan: checks('planPick'), plan_other: v('l_plan_other') },
      online: { facebook: radio('fb'), facebook_link: v('a_fb'), instagram: v('a_ig'), directory: v('a_directory'), gbp: radio('gbp'), gbp_link: v('a_gbp'), domain: v('a_domain'), registrar: v('a_registrar'), existing_site: v('a_existing') },
      photos: photos.map(function (p) { return { path: p.path, url: p.url }; }),
      trades: { registrations: checks('regPick'), registrations_other: v('t_regs'), insured: on('t_insured'), guarantee: v('t_guarantee'), brands: v('t_brands') },
      trades_how: { emergency: radio('emerg'), emergency_terms: v('t_emerg') },
      clubs: { classes: v('k_classes'), fees: v('k_fees'), extras: v('k_extras') },
      clubs_how: { first_visit: v('k_trial'), terms: v('k_terms') },
      salon: { team: v('s_team'), retail: v('s_retail') },
      salon_how: { no_show: v('s_noshow'), rebook: v('s_rebook'), before_first: v('s_tests') },
      extras: { reviews: v('x_reviews'), referral_reward: v('x_referral'), report_to: v('x_report'), anything: v('x_anything') }
    };
  }
  function fill(a) {
    a = a || {};
    var c = a.contact || {}, o = a.offer || {}, cu = a.customers || {}, w = a.want || {}, b = a.bookings || {}, p = a.payments || {}, l = a.later || {}, ol = a.online || {}, x = a.extras || {};
    var t = Object.assign({}, a.trades || {}, a.trades_how || {}), k = Object.assign({}, a.clubs || {}, a.clubs_how || {}), s = Object.assign({}, a.salon || {}, a.salon_how || {});
    /* Answers from the first form: a typed Gas Safe number and a typed
       reminder go in the "other" boxes, so they still show. */
    if (t.gas_safe && !t.registrations_other) t.registrations_other = 'Gas Safe ' + t.gas_safe;
    if (typeof t.registrations === 'string') { t.registrations_other = [t.registrations, t.registrations_other].filter(Boolean).join(', '); t.registrations = []; }
    if (t.next_service && !l.again_other) l.again_other = t.next_service;
    if (t.works_on && !/works on/i.test(t.brands || '')) t.brands = [t.brands, 'works on ' + t.works_on].filter(Boolean).join('; ');
    if (BOOK[b.how]) b.how = BOOK[b.how];
    setRadio('model', a.model); showAddon();
    set('c_phone', c.phone); set('c_email', c.email); setOn('c_whatsapp', c.whatsapp); set('c_area', c.area); set('c_base', c.base || t.base); set('c_address', c.address); set('c_reach', c.reach); setChecks('custWhere', c.customers_live);
    var sv = (a.services && !Array.isArray(a.services)) ? a.services : { trade: '', jobs: Array.isArray(a.services) ? a.services : [], most: '' };
    var known = Object.keys(CATALOG).indexOf(sv.trade) !== -1;
    tradeSel.value = sv.trade ? (known ? sv.trade : 'Other') : '';
    set('svc_trade_other', known ? '' : sv.trade);
    var mine = (sv.jobs || []).filter(function (j) { return j && !j.other; });
    var extra = (sv.jobs || []).filter(function (j) { return j && j.other; });
    paintJobs(mine);
    rows.innerHTML = '';
    (extra.length ? extra : [null]).forEach(addService);
    paintMost(sv.most, w.dont);
    paintPicks(Object.assign({}, a, { trades: t, later: l }));
    setOn('svc_generated', a.services_generated);
    set('o_job', o.job); set('o_upsell', o.upsells); set('o_addon_other', o.addons_other || o.addon_other); set('o_moment', o.moment); set('o_why', o.why);
    setChecks('custSources', cu.sources); set('cu_notes', cu.notes); set('cu_jobs', cu.jobs_per_week); set('cu_value', cu.job_value); set('cu_big', cu.big_job_value); setChecks('partnerPick', cu.partners); set('cu_partners', cu.partner_names);
    set('w_capacity', w.capacity); setChecks('bestPick', w.best); set('w_dont_other', w.dont_other); set('w_busy', w.busiest); set('w_quiet', w.quietest);
    setRadio('first', b.first); setRadio('book', b.how); set('b_app', b.app); set('b_lead', b.lead_time); setRadio('bookwant', b.want);
    setChecks('payMethods', p.methods); setRadio('upfront', p.upfront); set('p_amount', p.amount); set('p_when', p.when); setOn('p_offset', p.offset); setOn('p_invoices', p.invoices); set('p_bigjob', p.big_job); setRadio('finance', p.finance);
    set('l_now', l.now); set('l_smaller_other', l.smaller_other); set('l_again_other', l.again_other); set('l_plan_other', l.plan_other);
    setRadio('fb', ol.facebook); set('a_fb', ol.facebook_link); set('a_ig', ol.instagram); set('a_directory', ol.directory); setRadio('gbp', ol.gbp); set('a_gbp', ol.gbp_link); set('a_domain', ol.domain); set('a_registrar', ol.registrar); set('a_existing', ol.existing_site);
    photos = Array.isArray(a.photos) ? a.photos.filter(function (ph) { return ph && ph.url; }) : [];
    paintPhotos();
    set('t_regs', t.registrations_other); setOn('t_insured', t.insured); set('t_guarantee', t.guarantee); set('t_brands', t.brands); setRadio('emerg', t.emergency); set('t_emerg', t.emergency_terms);
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
    var byStage = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    var stage = 0;
    /* Walk the form in order: a stage header sets the stage for the
       sections after it. */
    Array.prototype.slice.call(document.querySelectorAll('.ob-stage, .ob-section')).forEach(function (el) {
      if (el.classList.contains('ob-stage')) { stage = Number(el.id.replace('stage', '')); return; }
      var key = el.getAttribute('data-section');
      if (el.hidden || key === 'model' || !stage) return;
      var has = key === 'services' ? (filled(a.services.jobs) || !!a.services.trade || a.services_generated) : filled(a[key]);
      el.classList.toggle('is-filled', has);
      byStage[stage][1]++;
      if (has) byStage[stage][0]++;
    });
    var parts = [];
    [1, 2, 3].forEach(function (n) {
      var d = byStage[n][0], t = byStage[n][1];
      parts.push('Stage ' + n + ': ' + d + ' of ' + t);
      var tick = document.querySelector('.ob-strip [data-stage="' + n + '"]');
      if (tick) { tick.textContent = d === t && t > 0 ? '\u2713' : d + '/' + t; tick.classList.toggle('is-done', d === t && t > 0); }
    });
    $('obProgress').textContent = parts.join(' \u00b7 ');
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
