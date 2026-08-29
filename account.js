/* one — accounts */
(function () {
  'use strict';

/* Account page: business details + logo. Requires a session. */

var loading = document.getElementById('loading');
var app     = document.getElementById('app');

var FIELDS = ['business_name','contact_name','phone','business_type','address',
              'service_area','opening_hours','services','site_goals','existing_links'];

var user = null;
var avatarPath = null;

/* Read once, at load. The block that greets people coming back from Stripe
   strips the query string off the URL, and it runs before the session lookup
   resolves, so anything reading location.search later finds it already gone. */
var CHECKOUT_STATE = new URLSearchParams(location.search).get('checkout');

if (!ONE.ready) {
  loading.innerHTML = '<p>Accounts are not connected yet — add your Supabase URL and '
                    + 'publishable key to <code>supabase-config.js</code>.</p>';
} else {
  start();
}

/* No session on the account page.
 *
 * Normally that just means log in. But Stripe sends people back here straight
 * after paying, and someone who has not confirmed their email yet still has no
 * session - so bouncing them to a login they cannot get through would meet a
 * customer who has just paid with a wall. Say what happened instead. */
function landedWithoutSession() {
  var state = CHECKOUT_STATE;

  if (state === 'success') {
    loading.innerHTML =
      '<div class="acct-land">' +
      '<h1>Payment received &mdash; thank you.</h1>' +
      '<p>Your build is in the queue and we&rsquo;ll be in touch today.</p>' +
      '<p>One thing left: open the link in the email we sent when you signed up, ' +
      'and you&rsquo;ll be straight into your account.</p>' +
      '<p><a class="btn btn-ghost" href="/login.html">Go to log in</a></p>' +
      '</div>';
    return;
  }

  if (state === 'cancelled') {
    loading.innerHTML =
      '<div class="acct-land">' +
      '<h1>Nothing was charged.</h1>' +
      '<p>You can start your plan any time from your account.</p>' +
      '<p><a class="btn btn-ghost" href="/login.html">Go to log in</a></p>' +
      '</div>';
    return;
  }

  location.replace('/login.html');
}

async function start() {
  var res = await ONE.db.auth.getSession();
  if (!res.data.session) { landedWithoutSession(); return; }
  user = res.data.session.user;
  document.getElementById('whoami').textContent = user.email;

  await flushPendingOnboarding();

  var profile = await ONE.db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (profile.error) {
    loading.innerHTML = '<p>Could not load your account: ' + ONE.friendlyError(profile.error) + '</p>';
    return;
  }
  if (profile.data) fill(profile.data);
  showIdentity(profile.data);
  showSite(profile.data);
  showBilling(profile.data);
  await showPoints(profile.data);
  await loadTemplates();

  loading.hidden = true;
  app.hidden = false;

  /* Just back from Stripe and signed in: the webhook writes the status a moment
     later, so refresh once to pick it up. Only from here, where a session is
     known to exist. */
  if (CHECKOUT_STATE === 'success' && !(profile.data && profile.data.active_plan)) {
    setTimeout(function () { location.replace('/account.html'); }, 6000);
  }
}

/* The wizard runs before the email is confirmed, so there is no session to
   write with. It stashes the answers; this puts them into the profile the
   first time the customer arrives here properly signed in. */
async function flushPendingOnboarding() {
  var raw;
  try { raw = localStorage.getItem('one.pending-onboarding'); } catch (e) { return; }
  if (!raw) return;

  var row;
  try { row = JSON.parse(raw); } catch (e) {
    try { localStorage.removeItem('one.pending-onboarding'); } catch (e2) {}
    return;
  }

  row.id = user.id;
  row.onboarded_at = row.onboarded_at || new Date().toISOString();
  var res = await ONE.db.from('profiles').upsert(row, { onConflict: 'id' });
  // Only clear once it is safely saved, so a failure here does not lose it.
  if (!res.error) {
    try { localStorage.removeItem('one.pending-onboarding'); } catch (e) {}
  }
}

function fill(row) {
  FIELDS.forEach(function (key) {
    var el = document.getElementById(key);
    if (el && row[key] != null) el.value = row[key];
  });
  setAvatar(row.avatar_path);
}

function setAvatar(path) {
  avatarPath = path || null;
  var img = document.getElementById('avatarImg');
  var fallback = document.getElementById('avatarFallback');
  var remove = document.getElementById('avatarRemove');

  if (!avatarPath) {
    img.hidden = true;
    fallback.hidden = false;
    fallback.textContent = initials();
    remove.hidden = true;
    headerBadge(null);
    return;
  }
  var pub = ONE.db.storage.from('avatars').getPublicUrl(avatarPath);
  // Bust the browser cache so a re-upload to the same path shows immediately.
  var src = pub.data.publicUrl + '?t=' + Date.now();
  img.src = src;
  img.alt = 'Your business logo';
  img.hidden = false;
  fallback.hidden = true;
  remove.hidden = false;
  headerBadge(src);
}

/* The badge at the top of the page shows the same logo, so an upload or a
   removal is reflected in both places without a reload. */
function headerBadge(src) {
  var img = document.getElementById('idAvatar');
  var txt = document.getElementById('idInitials');
  if (!img || !txt) return;
  if (src) {
    img.src = src;
    img.alt = '';
    img.hidden = false;
    txt.hidden = true;
  } else {
    img.hidden = true;
    txt.hidden = false;
    txt.textContent = initials();
  }
}

function initials() {
  var name = (document.getElementById('business_name').value || user.email || '').trim();
  if (!name) return '—';
  return name.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
}

function say(el, message, kind) {
  el.textContent = message;
  el.className = 'note' + (kind ? ' ' + kind : '');
}

/* ---------------- logo upload ---------------- */
var avatarNote = document.getElementById('avatarNote');

document.getElementById('avatarInput').addEventListener('change', async function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) return say(avatarNote, 'That file is over 2 MB — try a smaller one.', 'bad');

  say(avatarNote, 'Uploading…');
  // Path must start with the user id: storage policy checks the first folder.
  var ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  var path = user.id + '/logo.' + ext;

  var up = await ONE.db.storage.from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) return say(avatarNote, ONE.friendlyError(up.error), 'bad');

  // Remove a previous logo saved under a different extension.
  if (avatarPath && avatarPath !== path) {
    await ONE.db.storage.from('avatars').remove([avatarPath]);
  }

  var saved = await ONE.db.from('profiles')
    .upsert({ id: user.id, avatar_path: path }, { onConflict: 'id' });
  if (saved.error) return say(avatarNote, ONE.friendlyError(saved.error), 'bad');

  setAvatar(path);
  say(avatarNote, 'Logo saved.', 'ok');
  e.target.value = '';
});

document.getElementById('avatarRemove').addEventListener('click', async function () {
  if (!avatarPath) return;
  say(avatarNote, 'Removing…');
  await ONE.db.storage.from('avatars').remove([avatarPath]);
  var saved = await ONE.db.from('profiles')
    .upsert({ id: user.id, avatar_path: null }, { onConflict: 'id' });
  if (saved.error) return say(avatarNote, ONE.friendlyError(saved.error), 'bad');
  setAvatar(null);
  say(avatarNote, 'Logo removed.', 'ok');
});

/* ---------------- details ---------------- */
var saveNote = document.getElementById('saveNote');
var saveBtn  = document.getElementById('save');

document.getElementById('profileForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  var row = { id: user.id };
  FIELDS.forEach(function (key) {
    var el = document.getElementById(key);
    row[key] = el && el.value.trim() ? el.value.trim() : null;
  });

  var res = await ONE.db.from('profiles').upsert(row, { onConflict: 'id' });
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save';

  if (res.error) return say(saveNote, ONE.friendlyError(res.error), 'bad');
  say(saveNote, 'Saved.', 'ok');
  if (!avatarPath) setAvatar(null);   // refresh initials if the name changed
  var named = document.getElementById('business_name').value.trim();
  document.getElementById('idName').textContent = named || 'Your business';
});

/* ---------------- identity, site, points ---------------- */

/* Points per plan. api/_plans.js carries the same numbers for the server side;
   change both. An edit costs one point, a feature three. */
var PLAN_POINTS = { business: 0, pro: 3, max: 5 };
var PLAN_NAME   = { business: 'Business', pro: 'Pro', max: 'Max' };
var COST        = { edit: 1, feature: 3 };

/* The plan we ration points from is active_plan, written only by the Stripe
   webhook. selected_plan is whatever the customer last picked and they can
   write it themselves, so it must never decide entitlements. */
function entitledPlan(row) {
  return row && row.active_plan && PLAN_POINTS[row.active_plan] !== undefined ? row.active_plan : null;
}

function showIdentity(row) {
  var name = (row && row.business_name || '').trim();
  document.getElementById('idName').textContent = name || 'Your business';

  var chip = document.getElementById('idPlan');
  var plan = entitledPlan(row);
  chip.textContent = plan ? PLAN_NAME[plan] : 'No plan yet';
  chip.className = 'plan-chip' + (plan ? '' : ' is-none');
}

function showSite(row) {
  var link   = document.getElementById('siteUrl');
  var none   = document.getElementById('siteNone');
  var pill   = document.getElementById('sitePill');
  var pillTx = document.getElementById('sitePillText');

  var url = row && row.site_url;
  var status = (row && row.site_status) || 'building';

  if (url) {
    var href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    link.href = href;
    link.textContent = href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    link.hidden = false;
    none.hidden = true;
  } else {
    link.hidden = true;
    none.hidden = false;
  }

  /* The green pill is only earned by a site that is actually up. Anything
     else says so plainly rather than dressing up a build as live. */
  if (status === 'live' && url) {
    pill.hidden = false;
    pill.className = 'site-pill';
    pillTx.textContent = 'Live';
  } else if (url && status === 'paused') {
    pill.hidden = false;
    pill.className = 'site-pill is-building';
    pillTx.textContent = 'Paused';
  } else {
    pill.hidden = false;
    pill.className = 'site-pill is-building';
    pillTx.textContent = 'In build';
  }
}

/* Start of the current billing period. Points reset with the invoice, not the
   calendar, so this walks back one month from the renewal date. */
function periodStart(row) {
  var end = row && row.current_period_end ? new Date(row.current_period_end) : null;
  if (end && !isNaN(end)) {
    var start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

var pointsState = { allowance: 0, used: 0, plan: null };

async function showPoints(row) {
  var plan = entitledPlan(row);

  /* Until there is a subscription there is nothing to charge a request to, so
     the panel stays out of the way rather than offering work we cannot bill. */
  var live = row && (row.subscription_status === 'active' || row.subscription_status === 'trialing');
  document.getElementById('pointsPanel').hidden = !live;
  if (!live) return;

  var allowance = plan ? PLAN_POINTS[plan] : 0;
  var start = periodStart(row);

  var used = 0;
  var recent = [];
  var q = await ONE.db.from('requests')
    .select('id, kind, points, detail, status, created_at, billed_at, billed_amount, confirm_token')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!q.error && q.data) {
    recent = q.data;
    q.data.forEach(function (r) {
      if (r.status !== 'declined' && new Date(r.created_at) >= start) used += r.points;
    });
  }

  pointsState = { allowance: allowance, used: used, plan: plan };

  var left = Math.max(0, allowance - used);
  document.getElementById('pointsLeft').textContent = String(left);
  document.getElementById('pointsOf').textContent = 'of ' + allowance + (allowance === 1 ? ' point' : ' points');

  var bar = document.getElementById('pointsBar');
  var note = document.getElementById('pointsNote');
  var upsell = document.getElementById('pointsUpsell');

  if (allowance > 0) {
    bar.hidden = false;
    document.getElementById('pointsFill').style.width = Math.round((left / allowance) * 100) + '%';
    upsell.hidden = true;
    note.textContent = left === 0
      ? 'You have used this month\u2019s points. Anything else is charged at the normal rate \u2014 \u00a335 an edit, \u00a3105 a feature.'
      : 'An edit costs 1 point, a new feature 3. Points reset each month and do not roll over.';
  } else {
    bar.hidden = true;
    upsell.hidden = false;
    note.textContent = used > 0
      ? String(used) + (used === 1 ? ' point' : ' points') + ' asked for this month, charged to the card on file once done.'
      : '';
  }

  updatePricePreview();
  renderRequests(recent);
}

var STATUS_TEXT_LABEL = { new: 'Request', accepted: 'Accepted', in_progress: 'In build', done: 'Live', declined: 'Declined' };

function requestRow(r) {
  var li = document.createElement('li');

  var what = document.createElement('span');
  what.className = 'req-what';
  what.textContent = r.detail;
  var when = document.createElement('span');
  when.className = 'req-when';
  when.textContent = new Date(r.created_at).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' });
  what.appendChild(when);

  // Reclassifying resets a request to Request and re-sends this - surfaced
  // right here so confirming does not depend on finding the email again.
  if (r.confirm_token) {
    var confirmLink = document.createElement('a');
    confirmLink.className = 'req-confirm';
    confirmLink.href = '/api/confirm-request?token=' + encodeURIComponent(r.confirm_token);
    confirmLink.textContent = 'Confirm the price';
    what.appendChild(confirmLink);
  }

  var cost = document.createElement('span');
  cost.className = 'req-cost';
  cost.textContent = r.billed_at
    ? 'Charged £' + (r.billed_amount / 100).toFixed(0)
    : r.points + (r.points === 1 ? ' pt' : ' pts');

  var state = document.createElement('span');
  state.className = 'req-state' + (r.status === 'done' ? ' is-done' : '');
  state.textContent = STATUS_TEXT_LABEL[r.status] || r.status;

  li.appendChild(what);
  li.appendChild(cost);
  li.appendChild(state);
  return li;
}

/* Edits and features are kept as two separate lists rather than one mixed
   feed, since a customer with a lot of history would otherwise have to scan
   past features to find their last edit or the other way round. */
function renderRequests(rows) {
  var wrap = document.getElementById('reqList');
  if (!rows || !rows.length) { wrap.hidden = true; return; }

  var groups = [
    { kind: 'edit',    group: document.getElementById('reqGroupEdit'),    list: document.getElementById('reqItemsEdit') },
    { kind: 'feature', group: document.getElementById('reqGroupFeature'), list: document.getElementById('reqItemsFeature') }
  ];

  var any = false;
  groups.forEach(function (g) {
    var items = rows.filter(function (r) { return r.kind === g.kind; }).slice(0, 6);
    g.list.textContent = '';
    if (!items.length) { g.group.hidden = true; return; }
    any = true;
    items.forEach(function (r) { g.list.appendChild(requestRow(r)); });
    g.group.hidden = false;
  });

  wrap.hidden = !any;
}

/* ---------------- request picker: templates, price preview ---------------- */

var templates = [];

async function loadTemplates() {
  if (!ONE.ready) return;
  var q = await ONE.db.from('templates').select('id, kind, name, description').eq('active', true);
  templates = (!q.error && q.data) || [];
  renderPicker();
}

function renderPicker() {
  var groups = [
    { kind: 'edit',    group: document.getElementById('tplGroupEdit'),    list: document.getElementById('tplListEdit') },
    { kind: 'feature', group: document.getElementById('tplGroupFeature'), list: document.getElementById('tplListFeature') }
  ];
  groups.forEach(function (g) {
    var items = templates.filter(function (t) { return t.kind === g.kind; });
    g.list.textContent = '';
    if (!items.length) { g.group.hidden = true; return; }
    items.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tpl-tile';
      btn.textContent = t.name;
      btn.addEventListener('click', function () { pickTemplate(t); });
      g.list.appendChild(btn);
    });
    g.group.hidden = false;
  });
}

function pickTemplate(t) {
  var radio = document.querySelector('input[name="kind"][value="' + t.kind + '"]');
  if (radio) radio.checked = true;
  document.getElementById('reqDetail').value = t.description || '';
  openForm();
}

function openForm() {
  document.getElementById('reqLaunch').hidden = true;
  document.getElementById('reqPicker').hidden = true;
  document.getElementById('reqForm').hidden = false;
  updatePricePreview();
  document.getElementById('reqDetail').focus();
}

document.getElementById('reqOpenBtn').addEventListener('click', function () {
  document.getElementById('reqLaunch').hidden = true;
  document.getElementById('reqPicker').hidden = false;
});

document.getElementById('tplSomethingElse').addEventListener('click', function () {
  document.getElementById('reqDetail').value = '';
  openForm();
});

document.querySelectorAll('input[name="kind"]').forEach(function (r) {
  r.addEventListener('change', updatePricePreview);
});

/* What this specific request would actually cost right now - the points
   left this month, not the flat per-kind rate - so the price shown is the
   true one, the same shortfall math the server itself will check. Seeing
   this before sending is what lets sending it count as agreeing to it. */
function updatePricePreview() {
  var el = document.getElementById('reqPrice');
  if (!el) return;
  var kind = (document.querySelector('input[name="kind"]:checked') || {}).value || 'edit';
  var cost = COST[kind];
  var remaining = Math.max(0, pointsState.allowance - pointsState.used);
  var covered = Math.min(cost, remaining);
  var shortfall = cost - covered;

  if (shortfall <= 0) {
    el.textContent = 'Uses ' + cost + (cost === 1 ? ' point' : ' points')
      + ' \u2014 you will have ' + (remaining - covered) + ' left this month.';
    el.className = 'req-price';
  } else if (covered > 0) {
    el.textContent = 'Uses your last ' + covered + (covered === 1 ? ' point' : ' points')
      + ', plus \u00a3' + (shortfall * 35) + ' on the card on file once it is done.';
    el.className = 'req-price is-charge';
  } else {
    el.textContent = 'No points left this month \u2014 \u00a3' + (shortfall * 35)
      + ' on the card on file once it is done.';
    el.className = 'req-price is-charge';
  }
}

document.getElementById('reqForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var note = document.getElementById('reqNote');
  var btn  = document.getElementById('reqBtn');
  var detail = document.getElementById('reqDetail').value.trim();
  var kind = (document.querySelector('input[name="kind"]:checked') || {}).value || 'edit';

  if (!detail) { say(note, 'Tell us what you would like changed.', 'bad'); return; }

  btn.disabled = true;
  say(note, 'Sending\u2026');

  try {
    var sess = await ONE.db.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) throw new Error('Your session has expired. Log in and try again.');

    var res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ kind: kind, detail: detail })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');

    /* The preview already showed this exact number before they hit send, so
       sending was already their agreement to it - nothing further to ask. */
    say(note, data.shortfall > 0
      ? 'Accepted \u2014 \u00a3' + (data.amount / 100).toFixed(0) + ' will be charged to your card on file once it is done.'
      : 'Accepted \u2014 covered by your points.', 'ok');

    document.getElementById('reqDetail').value = '';
    var fresh = await ONE.db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    await showPoints(fresh.data);
  } catch (err) {
    say(note, ONE.friendlyError(err), 'bad');
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- billing ---------------- */
var STATUS_TEXT = {
  active:             ['Active', 'Your subscription is live.'],
  trialing:           ['Trial',  'You are on a trial.'],
  past_due:           ['Past due', 'The last payment failed — update your card to stay live.'],
  unpaid:             ['Unpaid', 'The last payment failed — update your card to stay live.'],
  incomplete:         ['Pending', 'Payment did not finish. Try setting it up again.'],
  incomplete_expired: ['Expired', 'That payment attempt expired. Start again when ready.'],
  canceled:           ['Cancelled', 'Your subscription has ended.'],
  paused:             ['Paused', 'Your subscription is paused.']
};

var PLAN_LABEL = { business: 'Business — £50/month', pro: 'Pro — £90/month', max: 'Max — £150/month' };

function showBilling(row) {
  var badge = document.getElementById('billBadge');
  var planEl = document.getElementById('billPlan');
  var stateEl = document.getElementById('billState');
  var payBtn = document.getElementById('payBtn');
  var pick = document.getElementById('planChoice');

  var current = entitledPlan(row);
  if (current) pick.value = current;
  else if (row && row.selected_plan && PLAN_LABEL[row.selected_plan]) pick.value = row.selected_plan;

  /* Tell them which direction the selection moves before they commit. */
  var ORDER = ['business', 'pro', 'max'];
  function describeMove() {
    var move = document.getElementById('billMove');
    var chosen = pick.value;
    if (!current || chosen === current) { move.hidden = true; return; }
    var up = ORDER.indexOf(chosen) > ORDER.indexOf(current);
    var pts = PLAN_POINTS[chosen];
    move.hidden = false;
    move.textContent = (up ? 'Upgrading' : 'Downgrading') + ' from ' + PLAN_NAME[current] +
      ' to ' + PLAN_NAME[chosen] + ' \u2014 ' +
      (pts ? pts + (pts === 1 ? ' point' : ' points') + ' a month' : 'no points included') +
      '. Takes effect from your next payment.';
  }
  pick.addEventListener('change', describeMove);
  describeMove();

  /* Managing a card only makes sense once there is a customer to manage. */
  document.getElementById('billManage').hidden = !(row && row.stripe_customer_id);

  var status = row && row.subscription_status;
  if (!status) {
    planEl.textContent = 'No plan yet';
    stateEl.textContent = 'Pick a plan to get your build started.';
    badge.hidden = true;
    payBtn.textContent = 'Set up payment';
    return;
  }

  var info = STATUS_TEXT[status] || [status, ''];
  planEl.textContent = PLAN_LABEL[row.selected_plan] || 'Your plan';
  stateEl.textContent = info[1];
  badge.hidden = false;
  badge.textContent = info[0];
  badge.className = 'bill-badge' + (status === 'active' || status === 'trialing' ? ' is-live' : ' is-warn');

  if (row.current_period_end && (status === 'active' || status === 'trialing')) {
    var when = new Date(row.current_period_end);
    if (!isNaN(when)) {
      stateEl.textContent = info[1] + ' Renews ' + when.toLocaleDateString('en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
    }
  }

  payBtn.textContent = (status === 'active' || status === 'trialing') ? 'Change plan' : 'Set up payment';
}

document.getElementById('portalBtn').addEventListener('click', async function () {
  var note = document.getElementById('portalNote');
  var btn = this;
  btn.disabled = true;
  say(note, 'Opening\u2026');
  try {
    var sess = await ONE.db.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) throw new Error('Your session has expired. Log in and try again.');

    var res = await fetch('/api/portal', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing.');
    location.href = data.url;
  } catch (err) {
    say(note, ONE.friendlyError(err), 'bad');
    btn.disabled = false;
  }
});

document.getElementById('payBtn').addEventListener('click', async function () {
  var note = document.getElementById('billNote');
  var btn = this;
  var plan = document.getElementById('planChoice').value;

  btn.disabled = true;
  btn.textContent = 'Opening checkout…';
  say(note, '');

  try {
    var sess = await ONE.db.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) throw new Error('Your session has expired. Log in and try again.');

    var res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ plan: plan })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
    location.href = data.url;
  } catch (err) {
    say(note, ONE.friendlyError(err), 'bad');
    btn.disabled = false;
    btn.textContent = 'Set up payment';
  }
});

/* Coming back from Stripe. The webhook is what actually flips the status, so
   this only explains what is happening rather than claiming success. */
(function () {
  var state = CHECKOUT_STATE;
  if (!state) return;
  var note = document.getElementById('billNote');
  if (state === 'success') {
    say(note, 'Payment set up — thanks. It can take a few seconds to show here.', 'ok');
    /* The reload that picks up the webhook's write is scheduled by start(),
       once it knows there is a session. Reloading without one would land on the
       stripped URL, find no checkout state, and bounce a customer who has just
       paid to a login they cannot get through yet. */
  } else if (state === 'cancelled') {
    say(note, 'Checkout cancelled — nothing was charged.', '');
  }
  history.replaceState(null, '', '/account.html');
})();

/* ---------------- log out ---------------- */
document.getElementById('logout').addEventListener('click', async function () {
  if (ONE.ready) await ONE.db.auth.signOut();
  location.href = '/login.html';
});
})();
