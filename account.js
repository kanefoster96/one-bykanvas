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

if (!ONE.ready) {
  loading.innerHTML = '<p>Accounts are not connected yet — add your Supabase URL and '
                    + 'publishable key to <code>supabase-config.js</code>.</p>';
} else {
  start();
}

async function start() {
  var res = await ONE.db.auth.getSession();
  if (!res.data.session) { location.replace('/login.html'); return; }
  user = res.data.session.user;
  document.getElementById('whoami').textContent = user.email;

  await flushPendingOnboarding();

  var profile = await ONE.db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (profile.error) {
    loading.innerHTML = '<p>Could not load your account: ' + ONE.friendlyError(profile.error) + '</p>';
    return;
  }
  if (profile.data) fill(profile.data);
  showBilling(profile.data);

  loading.hidden = true;
  app.hidden = false;
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
    return;
  }
  var pub = ONE.db.storage.from('avatars').getPublicUrl(avatarPath);
  // Bust the browser cache so a re-upload to the same path shows immediately.
  img.src = pub.data.publicUrl + '?t=' + Date.now();
  img.alt = 'Your business logo';
  img.hidden = false;
  fallback.hidden = true;
  remove.hidden = false;
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

  if (row && row.selected_plan && PLAN_LABEL[row.selected_plan]) {
    pick.value = row.selected_plan;
  }

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
  var state = new URLSearchParams(location.search).get('checkout');
  if (!state) return;
  var note = document.getElementById('billNote');
  if (state === 'success') {
    say(note, 'Payment set up — thanks. It can take a few seconds to show here.', 'ok');
    setTimeout(function () { location.replace('/account.html'); }, 6000);
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
