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
  showReferral(profile.data);
  showClaude(profile.data);
  await showPoints(profile.data);
  await showFeatures();

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
  if (!fields.hidden) document.getElementById('pwCurrent').focus();
});

/* Already signed in, so this is a straight update rather than the emailed
   reset link the login page uses for people who cannot get in at all.
 *
 * Being signed in is not the same as being the account holder, though: a
 * session left open on a borrowed phone is one, and without the current
 * password anyone who found it could lock the owner out of their own
 * account. Supabase has no verify-password call, so the check is a sign-in
 * with the address already on the session - it either works or it does not,
 * and it tells us nothing we are not entitled to know. */
document.getElementById('pwSave').addEventListener('click', async function () {
  var current = document.getElementById('pwCurrent');
  var next = document.getElementById('pwNew');
  var confirm = document.getElementById('pwConfirm');
  var btn = this;

  if (!current.value) return say(pwNote, 'Enter your current password.', 'bad');
  if (next.value.length < 8) return say(pwNote, 'Use at least 8 characters.', 'bad');
  if (next.value !== confirm.value) return say(pwNote, 'Those two passwords do not match.', 'bad');
  if (next.value === current.value) {
    return say(pwNote, 'That is the password you already have.', 'bad');
  }

  btn.disabled = true;
  say(pwNote, 'Checking\u2026');

  var check = await ONE.db.auth.signInWithPassword({
    email: user.email, password: current.value
  });
  if (check.error) {
    btn.disabled = false;
    return say(pwNote, 'That is not your current password.', 'bad');
  }

  say(pwNote, 'Saving\u2026');
  var res = await ONE.db.auth.updateUser({ password: next.value });
  btn.disabled = false;

  if (res.error) return say(pwNote, ONE.friendlyError(res.error), 'bad');

  current.value = ''; next.value = ''; confirm.value = '';
  document.getElementById('pwFields').hidden = true;
  say(pwNote, 'Password changed. You are still signed in here.', 'ok');
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

/* Which plans exist. Requests are unlimited on all of them; the plan decides
   queue position, not allowance. Kept as a map so entitledPlan() can tell a
   real plan from junk in the column. */
var PLAN_POINTS = { starter: 1, business: 1, pro: 3, max: 5 }; // values legacy, keys authoritative
var PLAN_NAME   = { starter: 'Starter', business: 'Business', pro: 'Pro', max: 'Max' };

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
/* A request's first line is the feature's name; anything after it is the
   customer's notes. The admin side splits the same way when a finished
   feature lands on the site_features list. */
function featureName(detail) {
  return String(detail || '').split('\n')[0].trim();
}
function requestTitle(r) { return r.title || featureName(r.detail); }
var siteFeatureNames = [];

async function showFeatures() {
  var list = document.getElementById('featureList');

  var q = await ONE.db.from('site_features').select('id, name, updated_at').order('updated_at', { ascending: false });
  var live = (!q.error && q.data) || [];

  var pending = (recentRequests || []).filter(function (r) {
    return r.kind === 'feature' && r.status !== 'done' && r.status !== 'declined';
  });
  // The one being built sits above the ones still waiting their turn.
  pending.sort(function (a, b) {
    return (b.status === 'in_progress') - (a.status === 'in_progress');
  });

  /* Both halves of the list feed the idea library's exclusions: no point
     offering a feature the site already has or has already asked for. The
     first line of a request is its name; anything after is their notes. */
  siteFeatureNames = pending.map(function (r) { return requestTitle(r).toLowerCase(); })
    .concat(live.map(function (f) { return String(f.name).toLowerCase(); }));

  if (!live.length && !pending.length) { list.hidden = true; return; }

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
    list.appendChild(row(requestTitle(r), r.status === 'in_progress' ? 'Being built' : 'Requested', 'is-pending'));
  });
  live.forEach(function (f) {
    var fresh = !isNaN(new Date(f.updated_at))
      && (Date.now() - new Date(f.updated_at).getTime()) <= FEATURE_NEW_DAYS * 24 * 60 * 60 * 1000;
    list.appendChild(row(f.name, fresh ? 'New' : 'Live', fresh ? 'is-new' : 'is-live'));
  });
  list.hidden = false;
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

/* The last fetch of their requests, shared with showFeatures() so it can show
   a feature that is asked for but not built yet without refetching. */
var recentRequests = [];

async function showPoints(row) {
  /* Until there is a subscription the panel stays out of the way: nothing
     to add a feature to yet. */
  var live = row && (row.subscription_status === 'active' || row.subscription_status === 'trialing');
  document.getElementById('pointsPanel').hidden = !live;
  if (!live) return;

  var recent = [];
  var q = await ONE.db.from('requests')
    .select('id, kind, title, detail, status, created_at')
    .order('created_at', { ascending: false })
    .limit(40);
  if (!q.error && q.data) recent = q.data;
  recentRequests = recent;
}

/* ---------------- referral: their code, and the copy button ---------------- */
/*
 * The code is minted server-side on first ask (it has to be unique - money
 * hangs off it), then shown with a one-tap copy of the share link. Only a
 * paying customer sees the panel: the reward is a skipped payment, which
 * only means something when there are payments.
 */
async function showReferral(row) {
  var panel = document.getElementById('referralPanel');
  if (!panel) return;

  var live = row && (row.subscription_status === 'active' || row.subscription_status === 'trialing');
  if (!live) { panel.hidden = true; return; }

  try {
    var res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + window.ONE_SESSION.token() },
      body: JSON.stringify({ action: 'getReferralCode' })
    });
    var data = await res.json();
    if (!res.ok || !data.code) throw new Error(data.error || 'No code');

    document.getElementById('refCodeShow').textContent = data.code;
    panel.hidden = false;

    var btn = document.getElementById('refCopy');
    btn.addEventListener('click', function () {
      var done = function () {
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy link'; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data.link).then(done, function () {});
      } else {
        var hint = document.getElementById('refHint');
        hint.textContent = data.link;
        done();
      }
    });
  } catch (e) {
    /* No code, no panel - the page works fine without it. */
    console.log('referral panel skipped:', e && e.message);
    panel.hidden = true;
  }
}

/* ---------------- Connect Claude ---------------- */
/*
 * A personal token for the MCP server. Minted on the server, shown once
 * here, listed by label afterwards with a Revoke. Paying customers only:
 * it talks about a plan and requests, which a free account has none of.
 */
async function claudeApi(payload) {
  var res = await fetch('/api/mcp-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + window.ONE_SESSION.token() },
    body: JSON.stringify(payload)
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function showClaude(row) {
  var panel = document.getElementById('claudePanel');
  if (!panel) return;
  var live = row && (row.subscription_status === 'active' || row.subscription_status === 'trialing');
  if (!live) { panel.hidden = true; return; }
  panel.hidden = false;

  var list = document.getElementById('claudeList');
  var note = document.getElementById('claudeNote');

  async function paintList() {
    list.textContent = '';
    try {
      var data = await claudeApi({ action: 'list' });
      (data.tokens || []).forEach(function (t) {
        var li = el('li', 'claude-item');
        var main = el('div', 'claude-item-main');
        main.appendChild(el('strong', null, t.label));
        main.appendChild(el('span', 'hint', 'Connected ' + new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          + (t.last_used_at ? ', last used ' + new Date(t.last_used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ', not used yet')));
        li.appendChild(main);
        var rm = el('button', 'linkish', 'Revoke');
        rm.type = 'button';
        rm.addEventListener('click', async function () {
          if (!confirm('Disconnect ' + t.label + '? Claude will stop being able to see your site until you connect again.')) return;
          rm.disabled = true;
          try { await claudeApi({ action: 'revoke', id: t.id }); await paintList(); }
          catch (e) { say(note, ONE.friendlyError(e), 'bad'); rm.disabled = false; }
        });
        li.appendChild(rm);
        list.appendChild(li);
      });
    } catch (e) { say(note, ONE.friendlyError(e), 'bad'); }
  }

  document.getElementById('claudeConnect').addEventListener('click', async function () {
    var btn = this;
    btn.disabled = true;
    say(note, 'Making your link\u2026');
    try {
      var data = await claudeApi({ action: 'create', label: 'Claude' });
      var box = document.getElementById('claudeNew');
      document.getElementById('claudeUrl').textContent = data.url;
      box.hidden = false;
      say(note, '');
      await paintList();
    } catch (e) { say(note, ONE.friendlyError(e), 'bad'); }
    btn.disabled = false;
  });

  document.getElementById('claudeCopy').addEventListener('click', function () {
    var url = document.getElementById('claudeUrl').textContent;
    var btn = this;
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () {});
    else done();
  });

  await paintList();
}

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

var PLAN_LABEL = { starter: 'Starter — £25/month', business: 'Business — £50/month', pro: 'Pro — £120/month', max: 'Max — £250/month' };

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
  var ORDER = ['starter', 'business', 'pro', 'max'];
  var previewSeq = 0;

  function describeMove() {
    var move = document.getElementById('billMove');
    var chosen = pick.value;
    if (!current || chosen === current) { move.hidden = true; return; }

    var up = ORDER.indexOf(chosen) > ORDER.indexOf(current);
    var PERK = {
      starter: 'your live site with one change a month. Bookings, forms, chat and customer records are part of Business',
      business: 'unlimited changes made by us, plus bookings, forms, chat, customer records and automated emails',
      pro: 'priority requests and business email',   // legacy, no longer sold
      max: 'top priority, business email, and SEO work every month'
    };
    var head = (up ? 'Upgrading' : 'Downgrading') + ' from ' + PLAN_NAME[current] +
      ' to ' + PLAN_NAME[chosen] + ' \u2014 ' + (PERK[chosen] || '') + '.';

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
    /* The code they arrived with, said out loud before they pay - a discount
       nobody mentions is one they assume was lost on the way. */
    var offer = (window.ONE_SESSION && window.ONE_SESSION.offerCode
                 && window.ONE_SESSION.offerCode()) || '';
    if (offer) stateEl.textContent += ' Your code ' + offer + ' will be applied at checkout.';
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
        /* Carried from the link in their email, if they came from one. */
        body: JSON.stringify({ plan: plan,
          offer: (window.ONE_SESSION && window.ONE_SESSION.offerCode
                  && window.ONE_SESSION.offerCode()) || '' })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');

      /* Same event the wizard sends, so both routes to Stripe look alike to
         Meta. A no-op unless they accepted cookies. */
      if (window.oneTrack) window.oneTrack('InitiateCheckout', { content_category: plan });
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
    /* The offer has done its job. Left behind, it would quietly ride along
       on any future checkout - a re-subscribe months from now would claim a
       welcome discount that is not theirs any more. */
    if (window.ONE_SESSION && window.ONE_SESSION.clearOffer) window.ONE_SESSION.clearOffer();
    /* The reload that picks up the webhook's write is scheduled by start(),
       once it knows there is a session. Reloading without one would land on the
       stripped URL, find no checkout state, and bounce a customer who has just
       paid to a login they cannot get through yet. */
  } else if (state === 'cancelled') {
    say(note, 'Checkout cancelled — nothing was charged.', '');
  }
  history.replaceState(null, '', '/account.html');

  /* Ad conversion. A no-op unless they accepted cookies, and guarded so that
     re-pasting the success URL cannot report a second sale: Stripe redirects
     here once per checkout, but a URL is a thing people paste. */
  if (state === 'success' && window.oneTrack) {
    var seen;
    try { seen = sessionStorage.getItem('one.purchase-tracked'); } catch (e) {}
    if (!seen) {
      try { sessionStorage.setItem('one.purchase-tracked', '1'); } catch (e) {}
      window.oneTrack('Subscribe', { currency: 'GBP' });
    }
  }
})();

/* ---------------- log out ---------------- */
document.getElementById('logout').addEventListener('click', async function () {
  if (ONE.ready) await ONE.db.auth.signOut();
  location.href = '/login.html';
});
})();

/* ---------------- notifications badge ----------------
 *
 * The list itself lives on /notifications.html now; the account page only
 * counts what is unread and puts the number on the bell, which is a plain
 * link to the page. Reading happens there, so nothing is stamped here.
 */
(function () {
  if (!window.ONE || !ONE.ready) return;

  ONE.db.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) return;             // the page guard is already redirecting
    var userId = session.user.id;

    var bell = document.getElementById('navBell');
    if (bell) bell.hidden = false;

    ONE.db.from('profiles')
      .select('notifications_seen_at').eq('id', userId).maybeSingle()
      .then(function (prof) {
        var seenAt = prof.data && prof.data.notifications_seen_at
          ? prof.data.notifications_seen_at : '1970-01-01';
        return ONE.db.from('notifications')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', seenAt);
      })
      .then(function (q) {
        var n = q && Number.isFinite(q.count) ? q.count : 0;
        var badge = document.getElementById('navBellCount');
        if (badge && n > 0) { badge.textContent = String(n); badge.hidden = false; }
      });
  });
})();
