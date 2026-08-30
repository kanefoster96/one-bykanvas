/* one — accounts */
(function () {
  'use strict';

/* Account page: business details + logo. Requires a session. */

var loading = document.getElementById('loading');
var app     = document.getElementById('app');

/* Split by where they are edited: the business ones sit behind the pencil on
   the identity header, contact_name is personal and stays on the account
   card. Saving a business field emails us, since their live site usually
   needs the same change - see api/business-updated.js. */
var BIZ_FIELDS = ['business_name','business_type','public_email','phone','address',
                  'service_area','opening_hours','services','site_goals','existing_links'];
var FIELDS = BIZ_FIELDS.concat(['contact_name']);

var user = null;
var avatarPath = null;

/* Read once, at load. The block that greets people coming back from Stripe
   strips the query string off the URL, and it runs before the session lookup
   resolves, so anything reading location.search later finds it already gone. */
var CHECKOUT_STATE = new URLSearchParams(location.search).get('checkout');

/* Read at load for the same reason, and because supabase-js clears the hash
   once it has looked at it.

   A confirmation link that does not work reports itself here rather than by
   landing somewhere different, so without this the customer is bounced
   silently to the login page with no idea why the link did nothing. The usual
   cause is the link having already been opened - mail scanners follow links
   in mail they are filtering, and the token is single-use, so the scan spends
   it before the customer ever clicks. */
var LINK_ERROR = (function () {
  var hash  = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
  var query = new URLSearchParams(location.search);
  function pick(name) { return hash.get(name) || query.get(name) || ''; }
  if (!pick('error') && !pick('error_code') && !pick('error_description')) return null;
  return { code: pick('error_code'), desc: pick('error_description').replace(/\+/g, ' ') };
})();

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

  /* Before the Stripe cases: someone whose link failed needs telling that,
     whatever else brought them here. */
  if (LINK_ERROR) {
    /* Supabase's own wording is written for developers, and it arrives in the
       URL where anyone could put anything - so it goes to the console for us
       and never into the page. */
    console.warn('auth link rejected:', LINK_ERROR.code, LINK_ERROR.desc);

    var expired = /expired|invalid|otp/i.test(LINK_ERROR.code + ' ' + LINK_ERROR.desc);
    loading.innerHTML =
      '<div class="acct-land">' +
      '<h1>That link didn&rsquo;t work.</h1>' +
      (expired
        ? '<p>Confirmation links can only be opened once, and they expire after 24 hours. ' +
          'If your email provider scanned the message before you got to it, the link was ' +
          'already spent by the time you clicked.</p>'
        : '<p>The link was rejected before it could sign you in.</p>') +
      '<p>Log in with the password you chose and we&rsquo;ll take it from there.</p>' +
      '<p><a class="btn btn-ghost" href="/login.html">Go to log in</a></p>' +
      '</div>';
    return;
  }

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
  await showFeatures();
  await loadTemplates();

  var loginEmail = document.getElementById('loginEmail');
  if (loginEmail) loginEmail.value = user.email || '';

  var notify = document.getElementById('notifyOptIn');
  if (notify) notify.checked = !(profile.data && profile.data.notify_optout);

  var marketing = document.getElementById('marketingOptIn');
  if (marketing) marketing.checked = !(profile.data && profile.data.marketing_optin === false);

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

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
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

  var el = document.getElementById('contact_name');
  var res = await ONE.db.from('profiles')
    .upsert({ id: user.id, contact_name: el.value.trim() || null }, { onConflict: 'id' });
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save';

  if (res.error) return say(saveNote, ONE.friendlyError(res.error), 'bad');
  say(saveNote, 'Saved.', 'ok');
});

/* ---------------- password ---------------- */
var pwNote = document.getElementById('pwNote');

document.getElementById('pwOpen').addEventListener('click', function () {
  var fields = document.getElementById('pwFields');
  fields.hidden = !fields.hidden;
  if (!fields.hidden) document.getElementById('pwNew').focus();
});

/* Already signed in, so this is a straight update rather than the emailed
   reset link the login page uses for people who cannot get in at all. */
document.getElementById('pwSave').addEventListener('click', async function () {
  var input = document.getElementById('pwNew');
  var btn = this;
  if (input.value.length < 8) return say(pwNote, 'Use at least 8 characters.', 'bad');

  btn.disabled = true;
  say(pwNote, 'Saving…');
  var res = await ONE.db.auth.updateUser({ password: input.value });
  btn.disabled = false;

  if (res.error) return say(pwNote, ONE.friendlyError(res.error), 'bad');
  input.value = '';
  document.getElementById('pwFields').hidden = true;
  say(pwNote, 'Password changed.', 'ok');
});

/* ---------------- business details: its own view ---------------- */
var bizNote = document.getElementById('bizNote');

function showBizView(on) {
  document.getElementById('app').hidden = on;
  document.getElementById('bizView').hidden = !on;
  window.scrollTo(0, 0);
}

document.getElementById('bizEditBtn').addEventListener('click', function () { showBizView(true); });
document.getElementById('bizBack').addEventListener('click', function () { showBizView(false); });

document.getElementById('bizForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('bizSave');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  var row = { id: user.id };
  BIZ_FIELDS.forEach(function (key) {
    var el = document.getElementById(key);
    row[key] = el && el.value.trim() ? el.value.trim() : null;
  });

  var res = await ONE.db.from('profiles').upsert(row, { onConflict: 'id' });
  btn.disabled = false;
  btn.textContent = 'Save changes';
  if (res.error) return say(bizNote, ONE.friendlyError(res.error), 'bad');

  // Reflect it on the page behind before anything else.
  if (!avatarPath) setAvatar(null);
  document.getElementById('idName').textContent = row.business_name || 'Your business';

  /* Telling us is the point of saving here - their live site usually needs
     the same change. Best effort: the save already happened, so a failed
     notify is worth saying out loud but is not a failed save. */
  try {
    var sess = await ONE.db.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    var notify = await fetch('/api/business-updated', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }
    });
    if (!notify.ok) throw new Error('notify failed');
    say(bizNote, 'Saved — we’ll update your site to match.', 'ok');
  } catch (err) {
    say(bizNote, 'Saved, but we could not let anyone know — message us so your site gets updated too.', 'bad');
  }
});

/* ---------------- identity, site, points ---------------- */

/* Points per plan. api/_plans.js carries the same numbers for the server side;
   change both. An edit costs one point, a feature three. */
var PLAN_POINTS = { business: 1, pro: 3, max: 5 };
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

  /* Same "live" fact, repeated right under the name rather than only further
     down the page - the first thing worth seeing once there is a site to see. */
  var idSite = document.getElementById('idSite');
  var idSiteLink = document.getElementById('idSiteLink');
  if (status === 'live' && url) {
    var liveHref = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    idSiteLink.href = liveHref;
    idSiteLink.textContent = liveHref.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    idSite.hidden = false;
  } else {
    idSite.hidden = true;
  }
}

var FEATURE_NEW_DAYS = 30;

/* What the site can do, added by us - by hand, or when a feature request is
   delivered. A green New pill marks anything touched in the last 30 days,
   measured from updated_at rather than created_at so re-marking one keeps
   it fresh without renaming it. */
/* What the site can do, and what is on the way - one row per feature with a
   single pill saying where it stands. Live ones come from site_features (the
   list we keep), anything still moving comes from their own open feature
   requests, so a customer can see a feature they asked for before it exists.
   Deliberately no prices or screenshots here: this is what the site has, not
   what it cost. */
async function showFeatures() {
  var panel = document.getElementById('featuresPanel');
  var list = document.getElementById('featureList');

  var q = await ONE.db.from('site_features').select('id, name, updated_at').order('updated_at', { ascending: false });
  var live = (!q.error && q.data) || [];

  var pending = (recentRequests || []).filter(function (r) {
    return r.kind === 'feature' && r.status !== 'done' && r.status !== 'declined';
  });

  if (!live.length && !pending.length) { panel.hidden = true; return; }

  function row(name, label, cls) {
    var li = document.createElement('li');
    li.className = 'feature-item';
    var main = document.createElement('div');
    main.className = 'feature-item-main';
    main.appendChild(document.createTextNode(name));
    li.appendChild(main);
    li.appendChild(el('span', 'feature-pill ' + cls, label));
    return li;
  }

  list.textContent = '';
  pending.forEach(function (r) {
    list.appendChild(row(r.detail, r.status === 'in_progress' ? 'In build' : 'Requested', 'is-pending'));
  });
  live.forEach(function (f) {
    var fresh = !isNaN(new Date(f.updated_at))
      && (Date.now() - new Date(f.updated_at).getTime()) <= FEATURE_NEW_DAYS * 24 * 60 * 60 * 1000;
    list.appendChild(row(f.name, fresh ? 'New' : 'Live', fresh ? 'is-new' : 'is-live'));
  });
  panel.hidden = false;
}

/* Start of the current billing period. Points reset with the invoice, not the
   calendar, so this walks back one month from the renewal date. */
/* When this month's points started counting.
 *
 * points_reset_at is the answer whenever it is set - the webhook moves it at
 * each renewal and an upgrade stamps it, so it already accounts for a change
 * of plan part-way through a month. The fallback is only for rows written
 * before that column existed. api/_billing.js and admin.js carry the same
 * rule; change all three. */
function periodStart(row) {
  var stamped = row && row.points_reset_at ? new Date(row.points_reset_at) : null;
  if (stamped && !isNaN(stamped)) return stamped;

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
/* The last fetch of their requests, shared with showFeatures() so it can show
   a feature that is asked for but not built yet without refetching. */
var recentRequests = [];

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
    .select('id, kind, points, detail, status, created_at, billed_at, billed_amount, attachment_paths')
    .order('created_at', { ascending: false })
    .limit(40);

  if (!q.error && q.data) {
    recent = q.data;
    q.data.forEach(function (r) {
      if (r.status !== 'declined' && new Date(r.created_at) >= start) used += r.points;
    });
  }

  pointsState = { allowance: allowance, used: used, plan: plan };
  recentRequests = recent;

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
      ? 'You have used this month\u2019s points. Anything else is charged at the normal rate \u2014 \u00a340 an edit, \u00a3120 a feature \u2014 once we accept the request, before we start.'
      : 'An edit costs 1 point, a new feature 3. Points reset each month and do not roll over.';
  } else {
    bar.hidden = true;
    upsell.hidden = false;
    note.textContent = used > 0
      ? String(used) + (used === 1 ? ' point' : ' points') + ' asked for this month \u2014 charged to the card on file once we accept the request, before we start.'
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

  if (r.attachment_paths && r.attachment_paths.length) {
    var viewLink = document.createElement('a');
    viewLink.className = 'req-confirm';
    viewLink.href = '#';
    viewLink.textContent = 'View ' + r.attachment_paths.length
      + (r.attachment_paths.length === 1 ? ' screenshot' : ' screenshots');
    viewLink.addEventListener('click', function (e) {
      e.preventDefault();
      viewAttachments(r.attachment_paths, viewLink);
    });
    what.appendChild(viewLink);

    // The point of a screenshot is to show us something before the work
    // happens - once the site is live it has done its job.
    if (r.status === 'done') {
      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'linkish req-confirm';
      clearBtn.textContent = 'Clear screenshots';
      clearBtn.addEventListener('click', function () { clearAttachments(r.id, clearBtn); });
      what.appendChild(clearBtn);
    }
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

/* Signed on demand rather than up front, since most requests are never
   opened again - no point paying for a round trip nobody asked for. Our own
   session can sign these itself; the storage policy already scopes reads to
   our own folder. */
async function viewAttachments(paths, linkEl) {
  linkEl.textContent = 'Loading…';
  try {
    var q = await ONE.db.storage.from('request-attachments').createSignedUrls(paths, 3600);
    if (q.error) throw q.error;
    var frag = document.createDocumentFragment();
    (q.data || []).forEach(function (s, i) {
      if (i) frag.appendChild(document.createTextNode(' · '));
      var a = document.createElement('a');
      a.href = s.signedUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'req-confirm';
      a.textContent = 'Screenshot' + (paths.length > 1 ? ' ' + (i + 1) : '');
      frag.appendChild(a);
    });
    linkEl.replaceWith(frag);
  } catch (err) {
    linkEl.textContent = 'Could not load screenshots.';
  }
}

async function clearAttachments(requestId, btn) {
  if (!confirm('Delete the screenshots for this request? This frees storage and cannot be undone.')) return;
  btn.disabled = true;
  try {
    var sess = await ONE.db.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) throw new Error('Your session has expired. Log in and try again.');

    var res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'clearAttachments', requestId: requestId })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not clear those. Try again.');

    var fresh = await ONE.db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    await showPoints(fresh.data);
    await showFeatures();
  } catch (err) {
    alert(ONE.friendlyError(err));
    btn.disabled = false;
  }
}

/* Edits still moving. Features are not here - they have their own panel,
   where a requested one sits alongside the ones already live. */
function renderRequests(rows) {
  var wrap = document.getElementById('reqList');
  var list = document.getElementById('reqItemsEdit');
  var active = rows.filter(function (r) {
    if (r.kind !== 'edit' || r.status === 'declined') return false;
    /* A finished edit drops out of the list, unless its screenshots are still
       sitting in storage - that is the only place they can clear them. */
    if (r.status === 'done') return (r.attachment_paths || []).length > 0;
    return true;
  }).slice(0, 6);

  list.textContent = '';
  if (!active.length) { wrap.hidden = true; return; }
  active.forEach(function (r) { list.appendChild(requestRow(r)); });
  wrap.hidden = false;
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
    items.forEach(function (t) { g.list.appendChild(templateRow(t)); });
    g.group.hidden = false;
  });
}

/* One row per saved feature, opening to show what it actually does before
   anyone asks for it - the name alone ("Online ordering") rarely settles
   whether it is the thing they have in mind. */
function templateRow(t) {
  var row = document.createElement('div');
  row.className = 'tpl-row';

  /* Two things on the row, not one: the name picks it straight away, the
     arrow beside it only opens the description. Someone who already knows
     what they want never has to expand anything to ask for it. */
  var head = document.createElement('div');
  head.className = 'tpl-head';

  var name = document.createElement('button');
  name.type = 'button';
  name.className = 'tpl-name';
  name.textContent = t.name;
  name.addEventListener('click', function () { pickTemplate(t); });
  head.appendChild(name);

  var body = document.createElement('div');
  body.className = 'tpl-body';
  body.hidden = true;
  if (t.description) body.appendChild(el('p', 'tpl-desc', t.description));

  var pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'btn btn-ghost tpl-pick';
  pick.textContent = t.kind === 'feature' ? 'Request this feature' : 'Request this edit';
  pick.addEventListener('click', function () { pickTemplate(t); });
  body.appendChild(pick);

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tpl-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'What ' + t.name + ' does');
  toggle.appendChild(el('span', 'tpl-chevron', '\u203a'));
  toggle.addEventListener('click', function () {
    var open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('is-open', open);
  });
  head.appendChild(toggle);

  row.appendChild(head);
  row.appendChild(body);
  return row;
}

/* Their own words go on top of ours: the description explains the feature,
   and the blank line under it is where they say what they want for their
   own site. */
function pickTemplate(t) {
  var radio = document.querySelector('input[name="kind"][value="' + t.kind + '"]');
  if (radio) radio.checked = true;
  var detail = document.getElementById('reqDetail');
  detail.value = t.description ? t.name + ' — ' + t.description + '\n\n' : t.name + '\n\n';
  openForm();
  // Land the cursor at the end, ready for their own notes.
  detail.setSelectionRange(detail.value.length, detail.value.length);
}

function openForm() {
  document.getElementById('reqLaunch').hidden = true;
  document.getElementById('reqPicker').hidden = true;
  document.getElementById('reqForm').hidden = false;
  updatePricePreview();
  document.getElementById('reqDetail').focus();
}

/* Two doors into the same form, each pre-picking its kind - "edit my site"
   and "add a feature" are how a customer thinks about it, where a single
   generic button made them choose the vocabulary first. */
function openPicker(kind) {
  var radio = document.querySelector('input[name="kind"][value="' + kind + '"]');
  if (radio) radio.checked = true;
  document.getElementById('reqLaunch').hidden = true;
  document.getElementById('reqPicker').hidden = false;
  // Only the templates of that kind are worth showing now.
  document.getElementById('tplGroupEdit').hidden = kind !== 'edit' || !templates.some(function (t) { return t.kind === 'edit'; });
  document.getElementById('tplGroupFeature').hidden = kind !== 'feature' || !templates.some(function (t) { return t.kind === 'feature'; });
  updatePricePreview();
}

document.getElementById('reqEditBtn').addEventListener('click', function () { openPicker('edit'); });
document.getElementById('reqFeatureBtn').addEventListener('click', function () { openPicker('feature'); });

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
      + ', plus \u00a3' + (shortfall * 40) + ' on the card on file if we accept it, before we start.';
    el.className = 'req-price is-charge';
  } else {
    el.textContent = 'No points left this month \u2014 \u00a3' + (shortfall * 40)
      + ' on the card on file if we accept it, before we start.';
    el.className = 'req-price is-charge';
  }
}

var MAX_ATTACHMENTS = 6;
var MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

document.getElementById('reqFiles').addEventListener('change', function (e) {
  var note = document.getElementById('reqFilesNote');
  var files = Array.prototype.slice.call(e.target.files || []);
  if (files.length > MAX_ATTACHMENTS) {
    say(note, 'Up to ' + MAX_ATTACHMENTS + ' screenshots — pick fewer and try again.', 'bad');
    e.target.value = '';
    return;
  }
  var tooBig = files.filter(function (f) { return f.size > MAX_ATTACHMENT_SIZE; });
  if (tooBig.length) {
    say(note, tooBig[0].name + ' is over 5 MB — try a smaller one.', 'bad');
    e.target.value = '';
    return;
  }
  say(note, files.length ? files.length + (files.length === 1 ? ' file' : ' files') + ' selected.' : '');
});

/* Uploaded straight to storage from here, same as the logo does - the
   points cost and admin email only happen once /api/requests has the
   resulting paths, so a failed upload never leaves half a request behind. */
async function uploadAttachments(files, userId) {
  var batch = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(36).slice(2);
  var paths = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    var path = userId + '/' + batch + '-' + i + '.' + ext;
    var up = await ONE.db.storage.from('request-attachments')
      .upload(path, file, { contentType: file.type });
    if (up.error) throw new Error('Could not upload ' + file.name + ': ' + ONE.friendlyError(up.error));
    paths.push(path);
  }
  return paths;
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

    var filesInput = document.getElementById('reqFiles');
    var files = Array.prototype.slice.call(filesInput.files || []);
    var attachmentPaths = [];
    if (files.length) {
      say(note, 'Uploading screenshots\u2026');
      attachmentPaths = await uploadAttachments(files, user.id);
      say(note, 'Sending\u2026');
    }

    var res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ kind: kind, detail: detail, attachmentPaths: attachmentPaths })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');

    /* Nothing is charged or redeemed yet - accepting it is what does that,
       from the admin side, before any work starts. */
    say(note, data.shortfall > 0
      ? 'Sent \u2014 if we accept it, \u00a3' + (data.amount / 100).toFixed(0) + ' will be charged to your card on file before we start.'
      : 'Sent \u2014 we\u2019ll take a look and accept it shortly.', 'ok');

    document.getElementById('reqDetail').value = '';
    filesInput.value = '';
    say(document.getElementById('reqFilesNote'), '');
    var fresh = await ONE.db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    await showPoints(fresh.data);
    await showFeatures();
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

var PLAN_LABEL = { business: 'Business — £50/month', pro: 'Pro — £120/month', max: 'Max — £250/month' };

function showBilling(row) {
  var badge = document.getElementById('billBadge');
  var planEl = document.getElementById('billPlan');
  var stateEl = document.getElementById('billState');
  var payBtn = document.getElementById('payBtn');
  var pick = document.getElementById('planChoice');

  var current = entitledPlan(row);
  if (current) pick.value = current;
  else if (row && row.selected_plan && PLAN_LABEL[row.selected_plan]) pick.value = row.selected_plan;

  /* Say what the change will actually do, and what it costs, before they
     commit. The old wording promised "takes effect from your next payment" in
     both directions, which was never true of an upgrade. */
  var ORDER = ['business', 'pro', 'max'];
  var previewSeq = 0;

  function describeMove() {
    var move = document.getElementById('billMove');
    var chosen = pick.value;
    if (!current || chosen === current) { move.hidden = true; return; }

    var up = ORDER.indexOf(chosen) > ORDER.indexOf(current);
    var pts = PLAN_POINTS[chosen];
    var head = (up ? 'Upgrading' : 'Downgrading') + ' from ' + PLAN_NAME[current] +
      ' to ' + PLAN_NAME[chosen] + ' \u2014 ' +
      (pts ? pts + (pts === 1 ? ' point' : ' points') + ' a month' : 'no points included') + '.';

    move.hidden = false;
    move.textContent = head + (up
      ? ' You only pay the difference for the rest of this month.'
      : ' Nothing to pay now, and you keep your current plan until it renews.');

    /* Then replace the vague half with the real number, once Stripe has
       worked it out. Sequenced so a quick second change cannot be overwritten
       by the first one's slower answer. */
    if (!up) return;
    var mine = ++previewSeq;
    planPreview(chosen).then(function (p) {
      if (mine !== previewSeq || !p) return;
      if (typeof p.dueNow === 'number') {
        move.textContent = head + ' You pay ' + money(p.dueNow) + ' today for the rest of '
          + 'this month, then ' + PLAN_LABEL[chosen].split(' \u2014 ')[1] + '.';
      }
    });
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
    payBtn.dataset.mode = '';
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

  var subscribed = status === 'active' || status === 'trialing';
  payBtn.textContent = subscribed ? 'Change plan' : 'Set up payment';
  payBtn.dataset.mode = subscribed ? 'change' : '';
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

function money(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2
  }).format(pence / 100);
}

async function billingToken() {
  var sess = await ONE.db.auth.getSession();
  var token = sess.data && sess.data.session && sess.data.session.access_token;
  if (!token) throw new Error('Your session has expired. Log in and try again.');
  return token;
}

/* What the change would cost, without committing to it. */
async function planPreview(plan) {
  try {
    var token = await billingToken();
    var res = await fetch('/api/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'preview', plan: plan })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

/* Two different jobs behind one button.
 *
 * With no subscription this starts one, which is checkout's job. With one
 * already running it changes that subscription instead - sending an existing
 * customer back through checkout charged the new plan in full and left them
 * paying for both. */
document.getElementById('payBtn').addEventListener('click', async function () {
  var note = document.getElementById('billNote');
  var btn = this;
  var plan = document.getElementById('planChoice').value;
  var changing = btn.dataset.mode === 'change';
  var label = btn.textContent;

  btn.disabled = true;
  btn.textContent = changing ? 'Changing…' : 'Opening checkout…';
  say(note, '');

  try {
    var token = await billingToken();

    if (!changing) {
      var res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ plan: plan })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
      location.href = data.url;
      return;
    }

    var cres = await fetch('/api/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'apply', plan: plan })
    });
    var cdata = await cres.json().catch(function () { return {}; });

    /* The endpoint refuses a customer with no subscription rather than
       guessing - that is checkout's job, so send them there. */
    if (!cres.ok && cdata.needsCheckout) {
      btn.dataset.mode = '';
      throw new Error('Set up payment first, then you can change plan.');
    }
    if (!cres.ok) throw new Error(cdata.error || 'Could not change your plan.');

    var when = cdata.renewsAt ? new Date(cdata.renewsAt * 1000)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

    say(note, cdata.upgrading
      ? 'You are on ' + (PLAN_NAME[cdata.to] || cdata.to) + ' from now. '
        + 'Only the difference for the rest of this month was charged.'
      : 'You will move to ' + (PLAN_NAME[cdata.to] || cdata.to)
        + (when ? ' on ' + when : ' at your next renewal')
        + '. Nothing has been charged, and your current plan runs until then.',
      'ok');

    /* The webhook writes the new plan, so re-read rather than guessing. */
    setTimeout(function () { location.replace('/account.html'); }, 2500);
  } catch (err) {
    say(note, ONE.friendlyError(err), 'bad');
    btn.disabled = false;
    btn.textContent = label;
  }
});

/* Whether they want the optional site-update emails.
 *
 * Saved on its own rather than with the Save button: a preference that only
 * takes effect after you remember to press something else is how people end up
 * getting mail they thought they had turned off. */
(function () {
  var box = document.getElementById('notifyOptIn');
  var note = document.getElementById('notifyNote');
  if (!box) return;

  /* Two switches, one saver. They are separate columns on purpose: mail about
     their own site and mail selling to them are different things to want. */
  function wire(el, column, invert, onText, offText) {
    if (!el) return;
    el.addEventListener('change', async function () {
      var wanted = el.checked;
      el.disabled = true;
      say(note, 'Saving\u2026');

      var patch = {};
      patch[column] = invert ? !wanted : wanted;
      var res = await ONE.db.from('profiles').update(patch).eq('id', user.id);

      el.disabled = false;
      if (res.error) {
        el.checked = !wanted;
        return say(note, ONE.friendlyError(res.error), 'bad');
      }
      say(note, wanted ? onText : offText, 'ok');
    });
  }

  wire(box, 'notify_optout', true,
    'We\u2019ll let you know about changes to your site.',
    'Turned off. Plan and payment emails still come through.');

  wire(document.getElementById('marketingOptIn'), 'marketing_optin', false,
    'We\u2019ll send you the occasional tip or offer.',
    'Turned off. You\u2019ll still hear about your plan and your site.');
})();

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
