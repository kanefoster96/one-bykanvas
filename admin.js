/* one — admin */
(function () {
  'use strict';

/* A menu of sections rather than one long page: Requests, Customers,
   Contacts, Plans, Payments, Templates. Each renders lazily, only when its
   nav button is clicked, straight from the one `state` object load() already
   has in memory - switching sections never refetches.

   Nothing here decides who is allowed in. Every call goes to /api/admin, which
   verifies the token and the email before it touches the service role; if you
   are not the admin this page loads and then shows you nothing. */

var loading = document.getElementById('loading');
var app     = document.getElementById('app');
var note    = document.getElementById('adminNote');

var PLAN_NAME   = { business: 'Business', pro: 'Pro', max: 'Max' };
var PLAN_POINTS = { business: 1, pro: 3, max: 5 };
var PLAN_PRICE  = { business: 5000, pro: 12000, max: 25000 }; // pence/month — must match api/_plans.js PLANS
var STATUS_NAME = { new: 'Request', accepted: 'Accepted', in_progress: 'In build', done: 'Live', declined: 'Declined' };

var state = { profiles: [], requests: [], templates: [], seoUpdates: [], siteFeatures: [] };

/* Simple line icons, stroke-only, matching the site's weight. Drawn inline
   rather than fetched so the menu never waits on anything. */
var ICONS = {
  requests:  '<path d="M3 13.5 5.5 5h13L21 13.5V19H3z"/><path d="M3 13.5h5a4 4 0 0 0 8 0h5"/>',
  customers: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/>',
  contacts:  '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 3.5v17M12.5 9h4M12.5 12.5h4"/>',
  plans:     '<path d="m12 3.5 8.5 4.75L12 13 3.5 8.25z"/><path d="m3.5 13 8.5 4.75L20.5 13"/>',
  payments:  '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  templates: '<rect x="7.5" y="7.5" width="13" height="13" rx="2.5"/><path d="M16.5 7.5v-2a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>'
};

var SECTIONS = [
  { key: 'requests',  label: 'Requests' },
  { key: 'customers', label: 'Customers' },
  { key: 'contacts',  label: 'Contacts' },
  { key: 'plans',     label: 'Plans' },
  { key: 'payments',  label: 'Payments' },
  { key: 'templates', label: 'Templates' }
];
var activeSection = null; // null = the menu itself
var selectedCustomerId = null;
var selectedContactId = null;

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
  markShortfall();
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
   page works it out so the two never disagree. Also the period an SEO log or
   a shortfall walk is measured against - one function, three uses. */
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

function isCustomer(p) { return !!p.active_plan; }

function lifetimeSpent(userId) {
  return state.requests.reduce(function (sum, r) {
    return r.user_id === userId && r.billed_at ? sum + (r.billed_amount || 0) : sum;
  }, 0);
}

function seoHistoryFor(userId) {
  return state.seoUpdates.filter(function (s) { return s.user_id === userId; })
    .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
}

var FEATURE_NEW_DAYS = 30;

function isFreshFeature(iso) {
  var d = new Date(iso);
  return !isNaN(d) && (Date.now() - d.getTime()) <= FEATURE_NEW_DAYS * 24 * 60 * 60 * 1000;
}

function featuresFor(userId) {
  return state.siteFeatures.filter(function (f) { return f.user_id === userId; })
    .sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
}

function seoLoggedThisPeriod(p) {
  var start = periodStart(p);
  return state.seoUpdates.some(function (s) { return s.user_id === p.id && new Date(s.created_at) >= start; });
}

/* A customer whose site is still marked "building" - the one thing worth a
   notification dot, since it means work is owed regardless of the request
   queue being empty. */
function unbuiltCustomers() {
  return state.profiles.filter(function (p) { return p.active_plan && p.site_status === 'building'; });
}

function pendingSeoCustomers() {
  return state.profiles.filter(function (p) { return p.active_plan === 'max' && !seoLoggedThisPeriod(p); });
}

/* "Open" also holds a done request nobody has charged yet, so an
   over-allowance job never quietly falls out of view once it is finished -
   it only leaves the queue once billed_at is set. */
function openRequests() {
  return state.requests.filter(function (r) {
    if (r.status === 'new' || r.status === 'accepted' || r.status === 'in_progress') return true;
    return r.status === 'done' && r.shortfallPoints > 0 && !r.billed_at;
  });
}

/* Marks each request .shortfallPoints: how many of its points the plan's
   allowance did not cover, worked out in the order requests were made. A
   feature that lands once the allowance is half spent is billed only for the
   points that ran out, not the whole thing - one point left and a 3-point
   feature bills 2 points (£80), not the full £120. Declined requests and
   anything from a previous period are excluded, matching pointsUsed() above,
   so the two views can never disagree. */
function markShortfall() {
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
        var covered = Math.max(0, Math.min(r.points, allowance - used));
        r.shortfallPoints = r.points - covered;
        used += r.points;
      });
  });
}

/* ---------------- nav + top-level render ---------------- */

function switchSection(key) {
  activeSection = key;
  selectedCustomerId = null;
  selectedContactId = null;
  render();
}

/* The Wix-style home: one row per area - icon, label, a count badge where
   something needs doing, and a chevron. Only shown while no section is
   open; opening one swaps the whole menu for that section's page. */
function renderMenu(requestsDot, customersDot) {
  var nav = document.getElementById('adminNav');
  nav.textContent = '';
  SECTIONS.forEach(function (s) {
    var row = el('button', 'menu-row');
    row.type = 'button';

    var icon = el('span', 'menu-icon');
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[s.key] + '</svg>';
    row.appendChild(icon);

    row.appendChild(el('span', 'menu-label', s.label));

    var count = s.key === 'requests' ? requestsDot : s.key === 'customers' ? customersDot : 0;
    if (count > 0) row.appendChild(el('span', 'nav-dot', String(count)));
    row.appendChild(el('span', 'menu-chevron', '›'));

    row.addEventListener('click', function () { switchSection(s.key); });
    nav.appendChild(row);
  });
}

var SECTION_IDS = {
  requests: 'sectionRequests', customers: 'sectionCustomers', contacts: 'sectionContacts',
  plans: 'sectionPlans', payments: 'sectionPayments', templates: 'sectionTemplates'
};

function render() {
  var live = state.profiles.filter(function (p) { return p.site_status === 'live'; }).length;
  var paying = state.profiles.filter(isCustomer).length;
  var open = openRequests();
  var unbuilt = unbuiltCustomers();
  var pendingSeo = pendingSeoCustomers();

  document.getElementById('adminSummary').textContent =
    state.profiles.length + ' signed up · ' + paying + ' paying · ' + live + ' live · ' +
    open.length + ' open request' + (open.length === 1 ? '' : 's');

  var onMenu = activeSection === null;
  var nav = document.getElementById('adminNav');
  nav.hidden = !onMenu;
  if (onMenu) renderMenu(open.length + unbuilt.length, pendingSeo.length);

  var back = document.getElementById('backToMenu');
  back.hidden = onMenu;
  if (!back.dataset.bound) {
    back.dataset.bound = '1';
    back.addEventListener('click', function () { switchSection(null); });
  }

  Object.keys(SECTION_IDS).forEach(function (key) {
    document.getElementById(SECTION_IDS[key]).hidden = activeSection !== key;
  });

  if (activeSection === 'requests') renderRequestsSection(open, unbuilt);
  else if (activeSection === 'customers') renderCustomersSection();
  else if (activeSection === 'contacts') renderContactsSection();
  else if (activeSection === 'plans') renderPlansSection();
  else if (activeSection === 'payments') renderPaymentsSection();
  else if (activeSection === 'templates') renderTemplatesSection();
}

/* ---------------- shared: the site address/status editor ---------------- */

/* The only two fields on this page we write to a profile directly - reused
   wherever a site needs marking live: a fresh build in Requests, and a
   customer's own detail page. */
function siteEditorRow(p) {
  var row = el('div', 'cust-site');

  var url = el('input', 'admin-input');
  url.type = 'text';
  // Prefilled with what they asked for once it is bought, so marking a site
  // live is one click rather than retyping the address.
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
  return row;
}

/* What they told us in the onboarding wizard - shown as reference on both a
   fresh build card and a customer/contact's own detail page. */
function onboardingLines(p) {
  var frag = document.createDocumentFragment();
  [
    ['Wants the site to', p.site_goals], ['Asked for', (p.site_uses || []).join(', ')],
    ['Menu/services', p.services], ['Opening hours', p.opening_hours],
    ['Address', p.address], ['Covers', p.service_area], ['Already online', p.existing_links]
  ].filter(function (pair) { return pair[1]; }).forEach(function (pair) {
    var line = el('p', 'cust-sub');
    line.appendChild(el('strong', null, pair[0] + ': '));
    line.appendChild(document.createTextNode(pair[1]));
    frag.appendChild(line);
  });
  return frag;
}

function domainWantLine(p) {
  if (!p.requested_domain) return null;
  var want = el('p', 'cust-want');
  want.appendChild(el('span', null, p.domain_owned ? 'Already owns ' : 'Wants '));
  want.appendChild(el('strong', null, p.requested_domain));
  want.appendChild(el('span', null, p.domain_owned ? ' — move it across' : ' — to register'));
  return want;
}

/* ---------------- Requests: new builds + the open queue ---------------- */

function newBuildCard(p) {
  var card = el('div', 'cust');
  var head = el('div', 'cust-head');
  var names = el('div', 'cust-names');
  names.appendChild(el('h3', null, p.business_name || 'Unnamed business'));
  names.appendChild(el('p', 'cust-sub',
    [p.contact_name, p.business_type].filter(Boolean).join(' · ') || 'No details yet'));
  head.appendChild(names);
  head.appendChild(el('span', 'plan-chip', PLAN_NAME[p.active_plan]));
  card.appendChild(head);

  card.appendChild(onboardingLines(p));
  var want = domainWantLine(p);
  if (want) card.appendChild(want);

  card.appendChild(siteEditorRow(p));
  return card;
}

function renderRequestsSection(open, unbuilt) {
  var newWrap = document.getElementById('newBuilds');
  newWrap.textContent = '';
  if (unbuilt.length) {
    newWrap.appendChild(el('h3', 'req-list-title', 'New customer builds'));
    unbuilt.forEach(function (p) { newWrap.appendChild(newBuildCard(p)); });
  }

  var queueWrap = document.getElementById('queue');
  queueWrap.textContent = '';
  if (!open.length) {
    queueWrap.appendChild(el('p', 'site-none', 'No open edit or feature requests.'));
  } else {
    [['edit', 'Edit requests'], ['feature', 'Feature requests']].forEach(function (pair) {
      var items = open.filter(function (r) { return r.kind === pair[0]; })
        // Oldest first: the thing waiting longest is the thing to do next.
        .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      if (!items.length) return;

      queueWrap.appendChild(el('h3', 'req-list-title', pair[1]));
      var list = el('ul', 'queue');
      items.forEach(function (r) { list.appendChild(queueItem(r)); });
      queueWrap.appendChild(list);
    });
  }
}

/* Signed links straight to storage - generated once, server-side, in the
   list response, since our own session has no read access to a customer's
   folder to sign them on demand. */
function attachmentLinks(r) {
  if (!r.attachments || !r.attachments.length) return null;
  var p = el('p', 'queue-attachments');
  r.attachments.forEach(function (url, i) {
    if (i) p.appendChild(document.createTextNode(' · '));
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Screenshot' + (r.attachments.length > 1 ? ' ' + (i + 1) : '');
    p.appendChild(a);
  });
  return p;
}

/* One item of the queue: the status picker every request gets, plus a
   Charge card button that only appears once it is done, fell outside the
   month's points, and nobody has charged it yet. */
function queueItem(r) {
  var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
  var li = el('li', 'queue-item');

  var main = el('div', 'queue-main');
  main.appendChild(el('p', 'queue-who', ownerLabel(owner)));
  main.appendChild(el('p', 'queue-what', r.detail));
  main.appendChild(el('p', 'queue-meta',
    (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · ' + r.points +
    (r.points === 1 ? ' point' : ' points') +
    (r.shortfallPoints > 0
      ? ' · ' + r.shortfallPoints + (r.shortfallPoints === 1 ? ' point' : ' points') + ' over allowance'
      : '') +
    ' · asked ' + when(r.created_at)));
  var links = attachmentLinks(r);
  if (links) main.appendChild(links);
  li.appendChild(main);

  var actions = el('div', 'queue-actions');
  var sel = el('select', 'admin-select');
  ['new', 'accepted', 'in_progress', 'done', 'declined'].forEach(function (s) {
    var o = el('option', null, STATUS_NAME[s]);
    o.value = s;
    if (s === r.status) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', async function () {
    var target = sel.value;
    var payload = { action: 'setRequestStatus', requestId: r.id, status: target };

    // Accepting is where points get redeemed or the card gets charged for
    // whatever they don't cover - ask before it happens, prefilled with the
    // shortfall already worked out above, editable for a discount (or to
    // waive it) on something that turned out easier than its points suggest.
    if (target === 'accepted' && r.status === 'new' && r.shortfallPoints > 0) {
      var suggested = (r.shortfallPoints * POINT_PRICE / 100).toFixed(0);
      var input = prompt(
        'Charge the card on file before starting this?\n\n'
        + 'Amount in pounds (0 for none - to comp it or cover it yourself):',
        suggested
      );
      if (input === null) { sel.value = r.status; return; }
      var pounds = parseFloat(input);
      if (isNaN(pounds) || pounds < 0) { say('Enter a valid amount.', 'bad'); sel.value = r.status; return; }
      payload.amount = Math.round(pounds * 100);
    }

    sel.disabled = true;
    try {
      var res = await api(payload);
      r.status = target;
      if (res.amount > 0) {
        r.billed_at = new Date().toISOString();
        r.billed_amount = res.amount;
      }
      say(res.amount > 0 ? 'Accepted — charged £' + (res.amount / 100).toFixed(0) + '.' : 'Updated.', 'ok');
      render();
    } catch (err) {
      say(err.message, 'bad');
      sel.value = r.status;
    }
    sel.disabled = false;
  });
  actions.appendChild(sel);

  // Booked as one thing, turned out to be the other. Only offered before the
  // job is finished - once billed or done, the price is settled. Whether it
  // needs charging for is decided fresh next time it is accepted - not here.
  if (r.status === 'new' || r.status === 'accepted' || r.status === 'in_progress') {
    var toKind = r.kind === 'feature' ? 'edit' : 'feature';
    var reclass = el('button', 'linkish queue-reclass',
      'Mark as ' + toKind + ' instead');
    reclass.type = 'button';
    reclass.addEventListener('click', async function () {
      if (!confirm('Reclassify this as ' + (toKind === 'feature' ? 'a feature (3 points)' : 'an edit (1 point)') + '?')) return;
      reclass.disabled = true;
      try {
        var res = await api({ action: 'reclassifyRequest', requestId: r.id, kind: toKind });
        say(res.shortfall > 0
          ? 'Reclassified — £' + (res.amount / 100).toFixed(0) + ' over allowance. '
            + 'Back to Request - accept it again to charge or redeem for the new price.'
          : 'Reclassified.', 'ok');
        await load(); // kind can move it between the Edit/Feature lists, so reload rather than patch in place
      } catch (err) {
        say(err.message, 'bad');
        reclass.disabled = false;
      }
    });
    actions.appendChild(reclass);
  }

  if (r.status === 'done' && r.shortfallPoints > 0) {
    if (r.billed_at) {
      actions.appendChild(el('p', 'queue-billed', 'Charged £' + (r.billed_amount / 100).toFixed(0) + ' · ' + when(r.billed_at)));
    } else {
      var charge = el('button', 'btn btn-ghost admin-charge',
        'Charge card — £' + (r.shortfallPoints * POINT_PRICE / 100).toFixed(0));
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

var POINT_PRICE = 4000; // pence per point — £40 either way in api/_plans.js REQUEST_COST

/* ---------------- shared: how to reach someone ---------------- */

/* Email and phone as real links - mailto/tel - so contacting someone is one
   click from anywhere their card shows, not a copy-paste job. */
function contactLine(p) {
  if (!p.email && !p.phone) return null;
  var line = el('p', 'cust-reach');
  // These sit inside clickable cards - without this, mailing someone would
  // also flip the card open underneath the compose window.
  function link(href, text) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.addEventListener('click', function (e) { e.stopPropagation(); });
    line.appendChild(a);
  }
  if (p.email) link('mailto:' + p.email, p.email);
  if (p.email && p.phone) line.appendChild(document.createTextNode(' · '));
  if (p.phone) link('tel:' + String(p.phone).replace(/\s+/g, ''), p.phone);
  return line;
}

/* The chip is the truth about money: a live plan by name, a picked-but-unpaid
   plan marked as such, or no plan at all. */
function planChip(p) {
  if (p.active_plan) return el('span', 'plan-chip', PLAN_NAME[p.active_plan]);
  return el('span', 'plan-chip is-none',
    p.selected_plan ? PLAN_NAME[p.selected_plan] + ' (unpaid)' : 'No plan');
}

/* "Riverside Cafe — Sam Wells": the business and the person, together,
   anywhere a row names who something belongs to. A business name alone
   reads fine until two customers trade under similar names, or you need
   to open an email with an actual person's name. */
function ownerLabel(p) {
  if (!p) return 'Unknown business';
  var biz = p.business_name || 'Unnamed business';
  return p.contact_name ? biz + ' — ' + p.contact_name : biz;
}

function matchesSearch(p, term) {
  if (!term) return true;
  var hay = [p.business_name, p.contact_name, p.email, p.phone, p.business_type,
             p.requested_domain, p.site_url].filter(Boolean).join(' ').toLowerCase();
  return hay.indexOf(term.toLowerCase()) !== -1;
}

/* ---------------- Customers: list + detail ---------------- */

function customerListRow(p) {
  var card = el('div', 'cust cust-clickable');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  var head = el('div', 'cust-head');
  var names = el('div', 'cust-names');
  names.appendChild(el('h3', null, p.business_name || 'Unnamed business'));
  names.appendChild(el('p', 'cust-sub',
    [p.contact_name, p.business_type].filter(Boolean).join(' · ') || 'No details yet'));
  head.appendChild(names);
  head.appendChild(el('span', 'plan-chip', PLAN_NAME[p.active_plan]));
  card.appendChild(head);

  var reach = contactLine(p);
  if (reach) card.appendChild(reach);

  var used = pointsUsed(p);
  var allow = PLAN_POINTS[p.active_plan];
  var over = used > allow;
  card.appendChild(el('p', 'cust-points' + (over ? ' is-over' : ''),
    used + ' of ' + allow + ' points used this month · £' + (lifetimeSpent(p.id) / 100).toFixed(0) + ' spent lifetime'));

  if (p.active_plan === 'max') {
    var due = !seoLoggedThisPeriod(p);
    card.appendChild(el('p', 'cust-points' + (due ? ' is-over' : ''),
      due ? 'SEO update due this month' : 'SEO update logged this month'));
  }

  function openCustomer() { selectedCustomerId = p.id; render(); }
  card.addEventListener('click', openCustomer);
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openCustomer(); });
  return card;
}

function renderCustomersList(wrap) {
  var customers = state.profiles.filter(isCustomer);
  if (!customers.length) { wrap.appendChild(el('p', 'site-none', 'No paying customers yet.')); return; }
  customers.forEach(function (p) { wrap.appendChild(customerListRow(p)); });
}

/* Each feature is its own row now, not a plain array - so one can be marked
   updated (refreshing its NEW pill and telling the customer) or removed
   (silently - nothing to tell them about a feature going away) without
   touching the rest. A feature request marked done adds one here too, the
   same way and with the same email, so what shows here is never only what
   was typed in by hand. */
function featureEditor(p) {
  var wrap = el('div', 'feature-editor');
  var features = featuresFor(p.id);

  if (!features.length) {
    wrap.appendChild(el('p', 'site-none', 'Nothing added yet.'));
  } else {
    var list = el('ul', 'feature-list');
    features.forEach(function (f) {
      var li = el('li', 'feature-item');

      var main = el('div', 'feature-item-main');
      main.appendChild(el('span', null, f.name));
      if (isFreshFeature(f.updated_at)) main.appendChild(el('span', 'feature-new', 'New'));
      li.appendChild(main);

      var actions = el('div', 'feature-item-actions');

      var refresh = el('button', 'linkish', 'Mark as updated');
      refresh.type = 'button';
      refresh.addEventListener('click', async function () {
        refresh.disabled = true;
        try {
          var res = await api({ action: 'markFeatureUpdated', featureId: f.id });
          f.updated_at = res.feature.updated_at;
          say('Marked as updated — they’ve been emailed.', 'ok');
          render();
        } catch (err) { say(err.message, 'bad'); refresh.disabled = false; }
      });
      actions.appendChild(refresh);

      var remove = el('button', 'linkish', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', async function () {
        if (!confirm('Remove "' + f.name + '" from their feature list?')) return;
        remove.disabled = true;
        try {
          await api({ action: 'removeSiteFeature', featureId: f.id });
          state.siteFeatures = state.siteFeatures.filter(function (x) { return x.id !== f.id; });
          say('Removed.', 'ok');
          render();
        } catch (err) { say(err.message, 'bad'); remove.disabled = false; }
      });
      actions.appendChild(remove);

      li.appendChild(actions);
      list.appendChild(li);
    });
    wrap.appendChild(list);
  }

  var form = el('div', 'feature-add');
  var input = el('input', 'admin-input');
  input.type = 'text';
  input.placeholder = 'e.g. Online table booking';
  input.maxLength = 200;
  var add = el('button', 'btn btn-ghost admin-save', 'Add new feature');
  add.type = 'button';
  add.addEventListener('click', async function () {
    var val = input.value.trim();
    if (!val) return;
    add.disabled = true;
    try {
      var res = await api({ action: 'addSiteFeature', userId: p.id, name: val });
      state.siteFeatures.unshift(res.feature);
      input.value = '';
      say('Added — they’ve been emailed.', 'ok');
      render();
    } catch (err) {
      say(err.message, 'bad');
      add.disabled = false;
    }
  });
  form.appendChild(input);
  form.appendChild(add);
  wrap.appendChild(form);

  return wrap;
}

/* Tucked behind a click rather than shown inline next to the feature list -
   what they've been charged is a different question from what their site
   can do, and the two used to sit awkwardly on top of each other. */
function paymentsPanel(p) {
  var wrap = el('div', 'payments-panel');

  var toggle = el('button', 'btn btn-ghost admin-save', 'View payments');
  toggle.type = 'button';

  var body = el('div', 'payments-body');
  body.hidden = true;

  var charged = state.requests.filter(function (r) { return r.user_id === p.id && r.billed_at; })
    .sort(function (a, b) { return new Date(b.billed_at) - new Date(a.billed_at); });
  var total = lifetimeSpent(p.id);

  body.appendChild(el('p', 'cust-points', '£' + (total / 100).toFixed(0) + ' charged lifetime'));
  if (!charged.length) {
    body.appendChild(el('p', 'site-none', 'Nothing charged yet.'));
  } else {
    var list = el('ul', 'queue');
    charged.forEach(function (r) {
      var li = el('li', 'queue-item');
      var main = el('div', 'queue-main');
      main.appendChild(el('p', 'queue-what', r.detail));
      main.appendChild(el('p', 'queue-meta', (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · £' +
        (r.billed_amount / 100).toFixed(0) + ' · ' + when(r.billed_at)));
      li.appendChild(main);
      list.appendChild(li);
    });
    body.appendChild(list);
  }

  toggle.addEventListener('click', function () {
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? 'View payments' : 'Hide payments';
  });

  wrap.appendChild(toggle);
  wrap.appendChild(body);
  return wrap;
}

function notesEditor(p) {
  var wrap = el('div', 'notes-editor');
  var textarea = document.createElement('textarea');
  textarea.className = 'admin-input notes-textarea';
  textarea.rows = 3;
  textarea.value = p.admin_notes || '';
  textarea.placeholder = 'Anything worth remembering about them…';

  var save = el('button', 'btn btn-ghost admin-save', 'Save notes');
  save.type = 'button';
  save.addEventListener('click', async function () {
    save.disabled = true;
    var was = save.textContent;
    save.textContent = 'Saving…';
    try {
      await api({ action: 'setAdminNotes', userId: p.id, notes: textarea.value });
      p.admin_notes = textarea.value.trim() || null;
      say('Saved.', 'ok');
    } catch (err) { say(err.message, 'bad'); }
    save.disabled = false;
    save.textContent = was;
  });

  wrap.appendChild(textarea);
  wrap.appendChild(save);
  return wrap;
}

/* A note each time, not just a checkbox - what was actually changed this
   month, building a visible history rather than only a done/not-done flag. */
function seoLogPanel(p) {
  var wrap = el('div', 'seo-panel');
  var due = !seoLoggedThisPeriod(p);
  wrap.appendChild(el('p', 'cust-points' + (due ? ' is-over' : ''), due ? 'Due this month.' : 'Logged this month.'));

  var form = el('div', 'feature-add');
  var input = document.createElement('textarea');
  input.className = 'admin-input notes-textarea';
  input.rows = 2;
  input.placeholder = 'What did you actually change? e.g. Updated meta descriptions, added alt text to gallery photos';
  var log = el('button', 'btn btn-ghost admin-save', 'Log update');
  log.type = 'button';
  log.addEventListener('click', async function () {
    var text = input.value.trim();
    if (!text) { say('Say what was actually changed.', 'bad'); return; }
    log.disabled = true;
    try {
      var res = await api({ action: 'logSeoUpdate', userId: p.id, note: text });
      state.seoUpdates.unshift(res.entry);
      say('Logged.', 'ok');
      render();
    } catch (err) {
      say(err.message, 'bad');
      log.disabled = false;
    }
  });
  form.appendChild(input);
  form.appendChild(log);
  wrap.appendChild(form);

  var history = seoHistoryFor(p.id);
  if (history.length) {
    var list = el('ul', 'queue');
    history.forEach(function (s) {
      var li = el('li', 'queue-item');
      var main = el('div', 'queue-main');
      main.appendChild(el('p', 'queue-what', s.note));
      main.appendChild(el('p', 'queue-meta', when(s.created_at)));
      li.appendChild(main);
      list.appendChild(li);
    });
    wrap.appendChild(list);
  }
  return wrap;
}

function recentRequestsList(userId) {
  var recent = state.requests.filter(function (r) { return r.user_id === userId; })
    .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
    .slice(0, 8);
  if (!recent.length) return null;

  var list = el('ul', 'queue');
  recent.forEach(function (r) {
    var li = el('li', 'queue-item');
    var main = el('div', 'queue-main');
    main.appendChild(el('p', 'queue-what', r.detail));
    main.appendChild(el('p', 'queue-meta', (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · ' +
      STATUS_NAME[r.status] + ' · ' + when(r.created_at) +
      (r.billed_at ? ' · charged £' + (r.billed_amount / 100).toFixed(0) : '')));
    li.appendChild(main);
    list.appendChild(li);
  });
  return list;
}

function customerDetail(p) {
  var wrap = el('div', 'cust-detail');

  var back = el('button', 'linkish', '← Back to customers');
  back.type = 'button';
  back.addEventListener('click', function () { selectedCustomerId = null; render(); });
  wrap.appendChild(back);

  var head = el('div', 'cust-head');
  var names = el('div', 'cust-names');
  names.appendChild(el('h3', null, p.business_name || 'Unnamed business'));
  names.appendChild(el('p', 'cust-sub',
    [p.contact_name, p.business_type].filter(Boolean).join(' \u00b7 ') || 'No details yet'));
  head.appendChild(names);
  head.appendChild(el('span', 'plan-chip', PLAN_NAME[p.active_plan]));
  wrap.appendChild(head);

  var reach = contactLine(p);
  if (reach) wrap.appendChild(reach);
  wrap.appendChild(el('p', 'cust-sub', 'Signed up ' + when(p.created_at)
    + (p.last_sign_in_at ? ' · last signed in ' + when(p.last_sign_in_at) : '')));

  wrap.appendChild(siteEditorRow(p));

  var used = pointsUsed(p);
  var allow = PLAN_POINTS[p.active_plan];
  wrap.appendChild(el('p', 'cust-points' + (used > allow ? ' is-over' : ''), used + ' of ' + allow + ' points used this month'));
  wrap.appendChild(paymentsPanel(p));

  wrap.appendChild(el('h3', 'req-list-title', 'Features on your site'));
  wrap.appendChild(featureEditor(p));

  if (p.active_plan === 'max') {
    wrap.appendChild(el('h3', 'req-list-title', 'SEO updates'));
    wrap.appendChild(seoLogPanel(p));
  }

  var onboarding = onboardingLines(p);
  if (onboarding.childNodes.length) {
    wrap.appendChild(el('h3', 'req-list-title', 'What they told us'));
    wrap.appendChild(onboarding);
  }
  var want = domainWantLine(p);
  if (want) wrap.appendChild(want);

  wrap.appendChild(el('h3', 'req-list-title', 'Notes (only you see these)'));
  wrap.appendChild(notesEditor(p));

  var recent = recentRequestsList(p.id);
  if (recent) {
    wrap.appendChild(el('h3', 'req-list-title', 'Recent requests'));
    wrap.appendChild(recent);
  }

  return wrap;
}

function renderCustomersSection() {
  var wrap = document.getElementById('customersBody');
  wrap.textContent = '';

  var p = selectedCustomerId && state.profiles.filter(function (x) { return x.id === selectedCustomerId; })[0];
  if (p) { wrap.appendChild(customerDetail(p)); return; }
  selectedCustomerId = null;
  renderCustomersList(wrap);
}

/* ---------------- Contacts: the whole address book ---------------- */
/*
 * Everyone with an account - paying customers included, since "find this
 * person and get hold of them" should never depend on remembering whether
 * they've paid yet. Customers stay in the Customers section too; that one
 * is the work view (site, points, features), this one is the who view.
 */

var contactSearch = '';

function contactListRow(p) {
  var card = el('div', 'cust cust-clickable');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  var head = el('div', 'cust-head');
  var names = el('div', 'cust-names');
  names.appendChild(el('h3', null, p.business_name || 'Unnamed business'));
  names.appendChild(el('p', 'cust-sub',
    [p.contact_name, p.business_type].filter(Boolean).join(' · ') || 'No details yet'));
  head.appendChild(names);
  head.appendChild(planChip(p));
  card.appendChild(head);

  var reach = contactLine(p);
  if (reach) card.appendChild(reach);
  card.appendChild(el('p', 'cust-sub', 'Signed up ' + when(p.created_at)));

  function openContact() { selectedContactId = p.id; render(); }
  card.addEventListener('click', openContact);
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openContact(); });
  return card;
}

function contactDetail(p) {
  var wrap = el('div', 'cust-detail');

  var back = el('button', 'linkish', '← Back to contacts');
  back.type = 'button';
  back.addEventListener('click', function () { selectedContactId = null; render(); });
  wrap.appendChild(back);

  var head = el('div', 'cust-head');
  var names = el('div', 'cust-names');
  names.appendChild(el('h3', null, p.business_name || 'Unnamed business'));
  names.appendChild(el('p', 'cust-sub',
    [p.contact_name, p.business_type].filter(Boolean).join(' \u00b7 ') || 'No details yet'));
  head.appendChild(names);
  head.appendChild(planChip(p));
  wrap.appendChild(head);

  var reach = contactLine(p);
  if (reach) wrap.appendChild(reach);
  wrap.appendChild(el('p', 'cust-sub', 'Signed up ' + when(p.created_at)
    + (p.last_sign_in_at ? ' · last signed in ' + when(p.last_sign_in_at) : '')));

  // A paying customer's real home is the Customers section - everything
  // billable lives there. This page stays the address-book view of them.
  if (isCustomer(p)) {
    var through = el('button', 'btn btn-ghost admin-save', 'Open customer page');
    through.type = 'button';
    through.addEventListener('click', function () {
      selectedContactId = null;
      selectedCustomerId = p.id;
      activeSection = 'customers';
      render();
    });
    wrap.appendChild(through);
  }

  var want = domainWantLine(p);
  if (want) wrap.appendChild(want);

  var onboarding = onboardingLines(p);
  if (onboarding.childNodes.length) {
    wrap.appendChild(el('h3', 'req-list-title', 'What they told us'));
    wrap.appendChild(onboarding);
  }

  wrap.appendChild(el('h3', 'req-list-title', 'Notes (only you see these)'));
  wrap.appendChild(notesEditor(p));

  return wrap;
}

function renderContactsSection() {
  var wrap = document.getElementById('contactsBody');
  wrap.textContent = '';

  var p = selectedContactId && state.profiles.filter(function (x) { return x.id === selectedContactId; })[0];
  if (p) { wrap.appendChild(contactDetail(p)); return; }
  selectedContactId = null;

  if (!state.profiles.length) { wrap.appendChild(el('p', 'site-none', 'Nobody has signed up yet.')); return; }

  var search = el('input', 'admin-input contact-search');
  search.type = 'search';
  search.placeholder = 'Search name, email, phone, trade…';
  search.value = contactSearch;
  search.setAttribute('aria-label', 'Search contacts');
  var list = el('div');

  function paint() {
    list.textContent = '';
    var shown = state.profiles.filter(function (c) { return matchesSearch(c, contactSearch); });
    if (!shown.length) { list.appendChild(el('p', 'site-none', 'Nobody matches that.')); return; }
    shown.forEach(function (c) { list.appendChild(contactListRow(c)); });
  }
  // Repaint just the list on each keystroke - a full render() would rebuild
  // the input itself and drop focus mid-word.
  search.addEventListener('input', function () { contactSearch = search.value.trim(); paint(); });

  wrap.appendChild(search);
  wrap.appendChild(list);
  paint();
}

/* ---------------- Plans: everyone paying, grouped ---------------- */

function renderPlansSection() {
  var wrap = document.getElementById('plansBody');
  wrap.textContent = '';

  ['business', 'pro', 'max'].forEach(function (key) {
    var customers = state.profiles.filter(function (p) { return p.active_plan === key; });
    wrap.appendChild(el('h3', 'req-list-title', PLAN_NAME[key] + ' (' + customers.length + ')'));
    if (!customers.length) {
      wrap.appendChild(el('p', 'site-none', 'Nobody on this plan yet.'));
      return;
    }
    customers.forEach(function (p) {
      var row = el('div', 'cust cust-clickable');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.appendChild(el('h3', null, ownerLabel(p)));
      row.appendChild(el('p', 'cust-sub', pointsUsed(p) + ' of ' + PLAN_POINTS[key] + ' points used this month'));
      function openCustomer() { selectedCustomerId = p.id; activeSection = 'customers'; render(); }
      row.addEventListener('click', openCustomer);
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter') openCustomer(); });
      wrap.appendChild(row);
    });
  });
}

/* ---------------- Payments: revenue summary + charge history ---------------- */

function renderPaymentsSection() {
  var wrap = document.getElementById('paymentsBody');
  wrap.textContent = '';

  var mrr = state.profiles.reduce(function (sum, p) {
    var billing = p.subscription_status === 'active' || p.subscription_status === 'trialing';
    return p.active_plan && billing ? sum + (PLAN_PRICE[p.active_plan] || 0) : sum;
  }, 0);

  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var charged = state.requests.filter(function (r) { return r.billed_at; });
  var thisMonth = charged.filter(function (r) { return new Date(r.billed_at) >= monthStart; })
    .reduce(function (sum, r) { return sum + r.billed_amount; }, 0);
  var allTime = charged.reduce(function (sum, r) { return sum + r.billed_amount; }, 0);

  wrap.appendChild(el('p', 'cust-points', 'Estimated monthly recurring revenue: £' + (mrr / 100).toFixed(0)));
  wrap.appendChild(el('p', 'cust-points', 'Charged this month (edits/features over allowance): £' + (thisMonth / 100).toFixed(0)));
  wrap.appendChild(el('p', 'cust-points', 'Charged all-time (edits/features over allowance): £' + (allTime / 100).toFixed(0)));

  wrap.appendChild(el('h3', 'req-list-title', 'Charge history'));
  if (!charged.length) { wrap.appendChild(el('p', 'site-none', 'Nothing charged yet.')); return; }

  var list = el('ul', 'queue');
  charged.slice().sort(function (a, b) { return new Date(b.billed_at) - new Date(a.billed_at); })
    .forEach(function (r) {
      var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
      var li = el('li', 'queue-item');
      var main = el('div', 'queue-main');
      main.appendChild(el('p', 'queue-who', ownerLabel(owner)));
      main.appendChild(el('p', 'queue-what', r.detail));
      main.appendChild(el('p', 'queue-meta', (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · £' +
        (r.billed_amount / 100).toFixed(0) + ' · ' + when(r.billed_at)));
      li.appendChild(main);
      list.appendChild(li);
    });
  wrap.appendChild(list);
}

/* ---------------- Templates: recently completed + saved templates ---------------- */

/* The last 20 delivered, newest first - the one place a done request stays
   visible once it drops out of the open queue, and the only place one gets
   saved as a template. */
function renderDoneList() {
  var wrap = document.getElementById('doneList');
  wrap.textContent = '';

  var items = state.requests.filter(function (r) { return r.status === 'done'; })
    .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
    .slice(0, 20);
  if (!items.length) { wrap.appendChild(el('p', 'site-none', 'Nothing finished yet.')); return; }

  var list = el('ul', 'queue');
  items.forEach(function (r) {
    var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
    var li = el('li', 'queue-item');

    var main = el('div', 'queue-main');
    main.appendChild(el('p', 'queue-who', ownerLabel(owner)));
    main.appendChild(el('p', 'queue-what', r.detail));
    main.appendChild(el('p', 'queue-meta',
      (r.kind === 'feature' ? 'Feature' : 'Edit') + ' · ' + when(r.created_at)));
    var links = attachmentLinks(r);
    if (links) main.appendChild(links);
    li.appendChild(main);

    var actions = el('div', 'queue-actions');
    var save = el('button', 'linkish queue-reclass', 'Save as template');
    save.type = 'button';
    save.addEventListener('click', async function () {
      var name = prompt('Name this template (shown to customers):', r.detail.slice(0, 60));
      if (!name || !name.trim()) return;
      save.disabled = true;
      try {
        await api({ action: 'saveTemplate', kind: r.kind, name: name.trim(), description: r.detail });
        say('Saved as a template.', 'ok');
        await load();
      } catch (err) {
        say(err.message, 'bad');
        save.disabled = false;
      }
    });
    actions.appendChild(save);
    li.appendChild(actions);
    list.appendChild(li);
  });
  wrap.appendChild(list);
}

/* The saved templates themselves - retiring one keeps it out of the
   customer's picker without losing the history of who picked it before. */
function renderTemplates() {
  var wrap = document.getElementById('templates');
  wrap.textContent = '';

  if (!state.templates.length) {
    wrap.appendChild(el('p', 'site-none', 'None saved yet — save one from a completed request above.'));
    return;
  }

  var list = el('ul', 'queue');
  state.templates.forEach(function (t) {
    var li = el('li', 'queue-item');

    var main = el('div', 'queue-main');
    main.appendChild(el('p', 'queue-who', t.name + (t.active ? '' : ' (retired)')));
    main.appendChild(el('p', 'queue-meta', (t.kind === 'feature' ? 'Feature' : 'Edit')));
    li.appendChild(main);

    var actions = el('div', 'queue-actions');
    var toggle = el('button', 'linkish queue-reclass', t.active ? 'Retire' : 'Restore');
    toggle.type = 'button';
    toggle.addEventListener('click', async function () {
      toggle.disabled = true;
      try {
        await api({ action: 'setTemplateActive', templateId: t.id, active: !t.active });
        t.active = !t.active;
        say(t.active ? 'Restored.' : 'Retired.', 'ok');
        render();
      } catch (err) {
        say(err.message, 'bad');
        toggle.disabled = false;
      }
    });
    actions.appendChild(toggle);
    li.appendChild(actions);
    list.appendChild(li);
  });
  wrap.appendChild(list);
}

function renderTemplatesSection() {
  renderDoneList();
  renderTemplates();
}
})();
