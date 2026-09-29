/* one — the Max setup form.
 *
 * Loads what they have saved (api/onboarding.js GET, which starts the
 * contact section from the profile), fills the form, and saves the whole
 * thing on Save (POST), which also tells us what changed. Everything is
 * optional; the progress line counts sections with anything in them.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var loading = $('loading');
  var app = $('app');
  var note = $('obNote');
  var dirty = false;

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

  /* ---- services: repeatable rows ---- */
  var rows = $('svcRows');
  var tpl = $('svcRow');
  function addService(data) {
    var frag = tpl.content.cloneNode(true);
    var row = frag.querySelector('.svc-row');
    if (data) {
      row.querySelectorAll('[data-k]').forEach(function (el) {
        var k = el.getAttribute('data-k');
        if (el.type === 'checkbox') el.checked = !!data[k];
        else el.value = data[k] == null ? '' : String(data[k]);
      });
    }
    row.querySelector('.svc-remove').addEventListener('click', function () { row.remove(); dirty = true; progress(); });
    rows.appendChild(frag);
  }
  function services() {
    return Array.prototype.slice.call(rows.querySelectorAll('.svc-row')).map(function (row) {
      var out = {};
      row.querySelectorAll('[data-k]').forEach(function (el) {
        var k = el.getAttribute('data-k');
        out[k] = el.type === 'checkbox' ? !!el.checked : el.value.trim();
      });
      return out;
    }).filter(function (s) { return s.name || s.price || s.includes || s.photo; });
  }
  $('svcAdd').addEventListener('click', function () { addService(); dirty = true; });

  /* ---- the form as one object, section by section ---- */
  function read() {
    return {
      contact: { email: v('c_email'), phone: v('c_phone'), whatsapp: on('c_whatsapp'), address: v('c_address'), area: v('c_area'), hours: v('c_hours'), best_time: v('c_best') },
      services: services(),
      offer: { job: v('o_job'), why: v('o_why'), photo: v('o_photo') },
      customers: { sources: checks('custSources'), notes: v('cu_notes') },
      serving: { days: v('s_days'), lead_time: radio('lead'), emergency: on('s_emergency'), travel: v('s_travel') },
      bookings: { how: radio('book'), app: v('b_app'), want: v('b_want') },
      payments: { methods: checks('payMethods'), deposit: radio('dep'), deposit_amount: v('p_deposit'), callout: v('p_callout'), invoices: on('p_invoices'), plans: on('p_plans'), stripe_done: on('p_stripe') },
      access: { facebook: v('a_fb'), instagram: v('a_ig'), meta_partner: on('a_meta'), gbp: radio('gbp'), gbp_link: v('a_gbp'), domain: v('a_domain'), registrar: v('a_registrar'), existing: v('a_existing') },
      extras: { photos: v('x_photos'), reviews: v('x_reviews'), next_service: v('x_next'), referral_reward: v('x_referral'), report_to: v('x_report'), anything: v('x_anything') }
    };
  }
  function fill(a) {
    a = a || {};
    var c = a.contact || {}, o = a.offer || {}, cu = a.customers || {}, s = a.serving || {}, b = a.bookings || {}, p = a.payments || {}, ac = a.access || {}, x = a.extras || {};
    set('c_email', c.email); set('c_phone', c.phone); setOn('c_whatsapp', c.whatsapp); set('c_address', c.address); set('c_area', c.area); set('c_hours', c.hours); set('c_best', c.best_time);
    rows.innerHTML = '';
    (Array.isArray(a.services) && a.services.length ? a.services : [null]).forEach(addService);
    set('o_job', o.job); set('o_why', o.why); set('o_photo', o.photo);
    setChecks('custSources', cu.sources); set('cu_notes', cu.notes);
    set('s_days', s.days); setRadio('lead', s.lead_time); setOn('s_emergency', s.emergency); set('s_travel', s.travel);
    setRadio('book', b.how); set('b_app', b.app); set('b_want', b.want);
    setChecks('payMethods', p.methods); setRadio('dep', p.deposit); set('p_deposit', p.deposit_amount); set('p_callout', p.callout); setOn('p_invoices', p.invoices); setOn('p_plans', p.plans); setOn('p_stripe', p.stripe_done);
    set('a_fb', ac.facebook); set('a_ig', ac.instagram); setOn('a_meta', ac.meta_partner); setRadio('gbp', ac.gbp); set('a_gbp', ac.gbp_link); set('a_domain', ac.domain); set('a_registrar', ac.registrar); set('a_existing', ac.existing);
    set('x_photos', x.photos); set('x_reviews', x.reviews); set('x_next', x.next_service); set('x_referral', x.referral_reward); set('x_report', x.report_to); set('x_anything', x.anything);
  }

  /* A section counts as started when anything in it is set. */
  function filled(val) {
    if (Array.isArray(val)) return val.length > 0;
    if (val && typeof val === 'object') return Object.keys(val).some(function (k) { return filled(val[k]); });
    return val === true || (typeof val === 'string' && val.trim() !== '');
  }
  function progress() {
    var a = read();
    var keys = Object.keys(a);
    var done = keys.filter(function (k) { return filled(a[k]); });
    $('obProgress').textContent = done.length + ' of ' + keys.length + ' sections have something in them.';
    document.querySelectorAll('.ob-section').forEach(function (sec) {
      sec.classList.toggle('is-filled', filled(a[sec.getAttribute('data-section')]));
    });
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
