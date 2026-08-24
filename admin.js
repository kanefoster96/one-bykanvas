/* one — admin */
(function () {
  'use strict';

/* Customer list, the open request queue, and the two things only we can set:
   a customer's site address and whether it is live.

   Nothing here decides who is allowed in. Every call goes to /api/admin, which
   verifies the token and the email before it touches the service role; if you
   are not the admin this page loads and then shows you nothing. */

var loading = document.getElementById('loading');
var app     = document.getElementById('app');
var note    = document.getElementById('adminNote');

var PLAN_NAME   = { business: 'Business', pro: 'Pro', max: 'Max' };
var PLAN_POINTS = { business: 0, pro: 3, max: 5 };
var STATUS_NAME = { new: 'Received', in_progress: 'In progress', done: 'Done', declined: 'Declined' };

var state = { profiles: [], requests: [] };

if (!ONE.ready) {
  loading.innerHTML = '<p>Accounts are not connected yet.</p>';
} else {
  start();
}

async function start() {
  var res = await ONE.db.auth.getSession();
  if (!res.data.session) { location.replace('/login.html'); return; }
  await load();
}

async function api(payload) {
  var sess = await ONE.db.auth.getSession();
  var token = sess.data && sess.data.session && sess.data.session.access_token;
  if (!token) throw new Error('Your session has expired. Log in again.');

  var res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  var data = await res.json().catch(function () { return {}; });
  if (res.status === 404) throw new Error('This page is not for this account.');
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function load() {
  try {
    state = await api({ action: 'list' });
  } catch (err) {
    loading.innerHTML = '<p>' + esc(err.message) + '</p>';
    return;
  }
  render();
  loading.hidden = true;
  app.hidden = false;
}

function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function say(msg, kind) {
  note.textContent = msg || '';
  note.className = 'note' + (kind ? ' ' + kind : '');
}

function when(iso) {
  var d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Points spent this billing period, worked out the same way the customer's own
   page works it out so the two never disagree. */
function periodStart(p) {
  var end = p.current_period_end ? new Date(p.current_period_end) : null;
  if (end && !isNaN(end)) { var s = new Date(end); s.setMonth(s.getMonth() - 1); return s; }
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function pointsUsed(p) {
  var start = periodStart(p);
  return state.requests.reduce(function (n, r) {
    return r.user_id === p.id && r.status !== 'declined' && new Date(r.created_at) >= start
      ? n + r.points : n;
  }, 0);
}

function render() {
  var live = state.profiles.filter(function (p) { return p.site_status === 'live'; }).length;
  var paying = state.profiles.filter(function (p) {
    return p.subscription_status === 'active' || p.subscription_status === 'trialing';
  }).length;
  var open = state.requests.filter(function (r) { return r.status === 'new' || r.status === 'in_progress'; });

  document.getElementById('adminSummary').textContent =
    state.profiles.length + ' signed up · ' + paying + ' paying · ' + live + ' live · ' +
    open.length + ' open request' + (open.length === 1 ? '' : 's');

  renderQueue(open);
  renderCustomers();
}

function renderQueue(open) {
  var panel = document.getElementById('queuePanel');
  var list = document.getElementById('queue');
  if (!open.length) { panel.hidden = true; return; }

  list.textContent = '';
  // Oldest first: the thing waiting longest is the thing to do next.
  open.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })
      .forEach(function (r) {
    var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
    var li = el('li', 'queue-item');

    var main = el('div', 'queue-main');
    main.appendChild(el('p', 'queue-who', (owner && owner.business_name) || 'Unknown business'));
    main.appendChild(el('p', 'queue-what', r.detail));
    main.appendChild(el('p', 'queue-meta',
      (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · ' + r.points +
      (r.points === 1 ? ' point' : ' points') + ' · asked ' + when(r.created_at)));
    li.appendChild(main);

    var actions = el('div', 'queue-actions');
    var sel = el('select', 'admin-select');
    ['new', 'in_progress', 'done', 'declined'].forEach(function (s) {
      var o = el('option', null, STATUS_NAME[s]);
      o.value = s;
      if (s === r.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', async function () {
      sel.disabled = true;
      try {
        await api({ action: 'setRequestStatus', requestId: r.id, status: sel.value });
        r.status = sel.value;
        say('Updated.', 'ok');
        render();
      } catch (err) { say(err.message, 'bad'); sel.value = r.status; }
      sel.disabled = false;
    });
    actions.appendChild(sel);
    li.appendChild(actions);
    list.appendChild(li);
  });
  panel.hidden = false;
}

function renderCustomers() {
  var wrap = document.getElementById('custList');
  wrap.textContent = '';

  if (!state.profiles.length) {
    wrap.appendChild(el('p', 'site-none', 'Nobody has signed up yet.'));
    return;
  }

  state.profiles.forEach(function (p) {
    var card = el('div', 'cust');

    var head = el('div', 'cust-head');
    var names = el('div', 'cust-names');
    names.appendChild(el('h3', null, p.business_name || 'Unnamed business'));
    names.appendChild(el('p', 'cust-sub',
      [p.contact_name, p.business_type].filter(Boolean).join(' · ') || 'No details yet'));
    head.appendChild(names);

    var plan = p.active_plan;
    var chip = el('span', 'plan-chip' + (plan ? '' : ' is-none'),
      plan ? PLAN_NAME[plan] : (p.selected_plan ? PLAN_NAME[p.selected_plan] + ' (unpaid)' : 'No plan'));
    head.appendChild(chip);
    card.appendChild(head);

    if (plan) {
      var used = pointsUsed(p);
      var allow = PLAN_POINTS[plan];
      /* Over the allowance is the one number here worth chasing, so it is
         marked rather than left to blend in with the rest. */
      var over = allow > 0 && used > allow;
      var line = el('p', 'cust-points' + (over || (!allow && used) ? ' is-over' : ''),
        allow ? used + ' of ' + allow + ' points used this month' +
                (over ? ' \u2014 ' + (used - allow) + ' over, invoice the extra' : '')
              : used ? used + (used === 1 ? ' point' : ' points') + ' asked for this month \u2014 invoice separately'
                     : 'No points included');
      card.appendChild(line);
    }

    /* What they asked for in the wizard, so it can be bought. */
    if (p.requested_domain) {
      var want = el('p', 'cust-want');
      want.appendChild(el('span', null, 'Asked for '));
      var strong = el('strong', null, p.requested_domain);
      want.appendChild(strong);
      card.appendChild(want);
    }

    /* The site row: the only two fields on this page we can write. */
    var row = el('div', 'cust-site');

    var url = el('input', 'admin-input');
    url.type = 'text';
    /* Prefilled with what they asked for once it is bought, so marking a site
       live is one click rather than retyping the address. */
    url.value = p.site_url || '';
    url.placeholder = p.requested_domain || 'their-site.co.uk';
    url.setAttribute('aria-label', 'Site address for ' + (p.business_name || 'this customer'));

    var status = el('select', 'admin-select');
    [['building', 'In build'], ['live', 'Live'], ['paused', 'Paused']].forEach(function (pair) {
      var o = el('option', null, pair[1]);
      o.value = pair[0];
      if (pair[0] === (p.site_status || 'building')) o.selected = true;
      status.appendChild(o);
    });

    var save = el('button', 'btn btn-ghost admin-save', 'Save');
    save.type = 'button';
    save.addEventListener('click', async function () {
      save.disabled = true;
      var was = save.textContent;
      save.textContent = 'Saving…';
      try {
        await api({ action: 'setSite', userId: p.id, siteUrl: url.value, siteStatus: status.value });
        p.site_url = url.value.trim() || null;
        p.site_status = status.value;
        say('Saved.', 'ok');
        render();
      } catch (err) { say(err.message, 'bad'); }
      save.disabled = false;
      save.textContent = was;
    });

    row.appendChild(url);
    row.appendChild(status);
    row.appendChild(save);
    card.appendChild(row);

    wrap.appendChild(card);
  });
}
})();
