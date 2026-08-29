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
  markOverage();
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

var REQUEST_PRICE = { edit: 3500, feature: 10500 }; // pence — must match api/_plans.js

/* Marks each request .overAllowance: true once the running total for that
   customer, within the current billing period, passes their plan's points -
   the same rule the account page's own copy states ("charged at the normal
   rate"). Declined requests and anything from a previous period are excluded,
   matching pointsUsed() above, so the two views can never disagree. */
function markOverage() {
  var byUser = {};
  state.requests.forEach(function (r) { (byUser[r.user_id] = byUser[r.user_id] || []).push(r); });

  Object.keys(byUser).forEach(function (uid) {
    var p = state.profiles.filter(function (x) { return x.id === uid; })[0];
    var allowance = p && p.active_plan ? PLAN_POINTS[p.active_plan] : 0;
    var start = p ? periodStart(p) : new Date(0);

    var used = 0;
    byUser[uid]
      .filter(function (r) { return r.status !== 'declined' && new Date(r.created_at) >= start; })
      .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })
      .forEach(function (r) {
        r.overAllowance = used >= allowance;
        used += r.points;
      });
  });
}

function render() {
  var live = state.profiles.filter(function (p) { return p.site_status === 'live'; }).length;
  var paying = state.profiles.filter(function (p) {
    return p.subscription_status === 'active' || p.subscription_status === 'trialing';
  }).length;
  /* "Open" also holds a done request nobody has charged yet, so an
     over-allowance job never quietly falls out of view once it is finished -
     it only leaves the queue once billed_at is set. */
  var open = state.requests.filter(function (r) {
    if (r.status === 'new' || r.status === 'in_progress') return true;
    return r.status === 'done' && r.overAllowance && !r.billed_at;
  });

  document.getElementById('adminSummary').textContent =
    state.profiles.length + ' signed up · ' + paying + ' paying · ' + live + ' live · ' +
    open.length + ' open request' + (open.length === 1 ? '' : 's');

  renderQueue(open);
  renderCustomers();
}

/* One item of the queue: the status picker every request gets, plus a
   Charge card button that only appears once it is done, fell outside the
   month's points, and nobody has charged it yet. */
function queueItem(r) {
  var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
  var li = el('li', 'queue-item');

  var main = el('div', 'queue-main');
  main.appendChild(el('p', 'queue-who', (owner && owner.business_name) || 'Unknown business'));
  main.appendChild(el('p', 'queue-what', r.detail));
  main.appendChild(el('p', 'queue-meta',
    (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · ' + r.points +
    (r.points === 1 ? ' point' : ' points') +
    (r.overAllowance ? ' · over allowance' : '') + ' · asked ' + when(r.created_at)));
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

  if (r.status === 'done' && r.overAllowance) {
    if (r.billed_at) {
      actions.appendChild(el('p', 'queue-billed', 'Charged £' + (r.billed_amount / 100).toFixed(0) + ' · ' + when(r.billed_at)));
    } else {
      var charge = el('button', 'btn btn-ghost admin-charge',
        'Charge card — £' + (REQUEST_PRICE[r.kind] / 100).toFixed(0));
      charge.type = 'button';
      charge.addEventListener('click', async function () {
        charge.disabled = true;
        var was = charge.textContent;
        charge.textContent = 'Charging…';
        try {
          var res = await api({ action: 'chargeRequest', requestId: r.id });
          r.billed_at = new Date().toISOString();
          r.billed_amount = res.amount;
          say('Charged.', 'ok');
          render();
        } catch (err) {
          say(err.message, 'bad');
          charge.disabled = false;
          charge.textContent = was;
        }
      });
      actions.appendChild(charge);
    }
  }

  li.appendChild(actions);
  return li;
}

/* Edits and features get their own list, same as the customer's own account
   page, so a run of feature builds does not bury the one-line edits (or the
   other way round). */
function renderQueue(open) {
  var panel = document.getElementById('queuePanel');
  var wrap = document.getElementById('queue');
  if (!open.length) { panel.hidden = true; return; }

  wrap.textContent = '';
  [['edit', 'Edit requests'], ['feature', 'Feature requests']].forEach(function (pair) {
    var items = open.filter(function (r) { return r.kind === pair[0]; })
      // Oldest first: the thing waiting longest is the thing to do next.
      .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    if (!items.length) return;

    wrap.appendChild(el('h3', 'req-list-title', pair[1]));
    var list = el('ul', 'queue');
    items.forEach(function (r) { list.appendChild(queueItem(r)); });
    wrap.appendChild(list);
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
                (over ? ' \u2014 ' + (used - allow) + ' over, charge from the queue once done' : '')
              : used ? used + (used === 1 ? ' point' : ' points') + ' asked for this month \u2014 charge from the queue once done'
                     : 'No points included');
      card.appendChild(line);
    }

    /* What they asked for in the wizard, so it can be bought. */
    if (p.requested_domain) {
      var want = el('p', 'cust-want');
      /* Owning it already is a different job - a move, not a purchase - so the
         two do not read the same. */
      want.appendChild(el('span', null, p.domain_owned ? 'Already owns ' : 'Wants '));
      want.appendChild(el('strong', null, p.requested_domain));
      want.appendChild(el('span', null, p.domain_owned ? ' \u2014 move it across' : ' \u2014 to register'));
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
