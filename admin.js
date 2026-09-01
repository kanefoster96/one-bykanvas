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
var PLAN_PRICE  = { business: 5000, pro: 12000, max: 25000 }; // pence/month — must match api/_plans.js PLANS
var STATUS_NAME = { new: 'Request', accepted: 'Accepted', in_progress: 'In build', done: 'Live', declined: 'Declined' };
/* info is a business-details change the customer made themselves - free, and
   raised by api/business-updated.js rather than asked for. */
var KIND_NAME = { edit: 'Edit', feature: 'Feature', info: 'Business info' };
function kindName(k) { return KIND_NAME[k] || 'Edit'; }

var state = { profiles: [], requests: [], templates: [], seoUpdates: [], siteFeatures: [] };

/* Simple line icons, stroke-only, matching the site's weight. Drawn inline
   rather than fetched so the menu never waits on anything. */
var ICONS = {
  requests:  '<path d="M3 13.5 5.5 5h13L21 13.5V19H3z"/><path d="M3 13.5h5a4 4 0 0 0 8 0h5"/>',
  customers: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/>',
  contacts:  '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 3.5v17M12.5 9h4M12.5 12.5h4"/>',
  plans:     '<path d="m12 3.5 8.5 4.75L12 13 3.5 8.25z"/><path d="m3.5 13 8.5 4.75L20.5 13"/>',
  payments:  '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  templates: '<rect x="7.5" y="7.5" width="13" height="13" rx="2.5"/><path d="M16.5 7.5v-2a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
  marketing: '<path d="M3 7.5 12 13l9-5.5"/><rect x="3" y="5" width="18" height="14" rx="2.5"/>',
  enquiries: '<rect x="3" y="8" width="18" height="4.2" rx="1"/><path d="M4.8 12.2v7.9c0 .5.4.9.9.9h12.6c.5 0 .9-.4.9-.9v-7.9"/><path d="M12 8v13"/><path d="M12 8c0-2.5-1-4.2-2.8-4.2a2.1 2.1 0 0 0 0 4.2z"/><path d="M12 8c0-2.5 1-4.2 2.8-4.2a2.1 2.1 0 0 1 0 4.2z"/>'
};

var SECTIONS = [
  { key: 'requests',  label: 'Requests' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'customers', label: 'Customers' },
  { key: 'contacts',  label: 'Contacts' },
  { key: 'plans',     label: 'Plans' },
  { key: 'payments',  label: 'Payments' },
  { key: 'templates', label: 'Templates' },
  { key: 'marketing', label: 'Marketing' }
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
  showBellCount();
}

/* Unread count for the header bell. Row level security already scopes the
   query to what this signed-in admin may see, and the seen timestamp lives
   on their own profile row - the same mechanics as a customer's bell. */
async function showBellCount() {
  try {
    var me = (await ONE.db.auth.getSession()).data.session.user.id;
    var prof = await ONE.db.from('profiles')
      .select('notifications_seen_at').eq('id', me).maybeSingle();
    var seenAt = (prof.data && prof.data.notifications_seen_at) || '1970-01-01';
    var q = await ONE.db.from('notifications')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', seenAt);
    var n = q && Number.isFinite(q.count) ? q.count : 0;
    var badge = document.getElementById('navBellCount');
    if (badge && n > 0) { badge.textContent = String(n); badge.hidden = false; }
  } catch (e) { /* a bell that cannot count stays quiet */ }
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

/* How long something has been sitting. In a queue this is the thing that
   matters - "asked 3 weeks ago" reads as a problem in a way that a date
   never does. */
function howLong(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return '';
  var days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return 'asked today';
  if (days === 1) return 'asked yesterday';
  if (days < 14) return 'asked ' + days + ' days ago';
  if (days < 60) return 'asked ' + Math.floor(days / 7) + ' weeks ago';
  return 'asked ' + when(iso);
}

/* Splits rows into [{ day, rows }] runs, newest first, for lists that read
   as a ledger - the date is a heading rather than a repeated field. Assumes
   rows are already sorted; it only breaks the run when the day changes. */
function dayGroups(rows, field) {
  var out = [];
  rows.forEach(function (r) {
    var day = when(r[field]);
    var last = out[out.length - 1];
    if (!last || last.day !== day) { last = { day: day, rows: [] }; out.push(last); }
    last.rows.push(r);
  });
  return out;
}

/* Points spent this billing period, worked out the same way the customer's own
   page works it out so the two never disagree. Also the period an SEO log or
   a shortfall walk is measured against - one function, three uses. */
/* Same rule as account.js and api/_billing.js - points_reset_at when it is
   set, the old derivation only for rows written before it existed. */
function periodStart(p) {
  var stamped = p && p.points_reset_at ? new Date(p.points_reset_at) : null;
  if (stamped && !isNaN(stamped)) return stamped;

  var end = p.current_period_end ? new Date(p.current_period_end) : null;
  if (end && !isNaN(end)) { var s = new Date(end); s.setMonth(s.getMonth() - 1); return s; }
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function openCountFor(userId) {
  return state.requests.filter(function (r) {
    return r.user_id === userId
      && (r.status === 'new' || r.status === 'accepted' || r.status === 'in_progress');
  }).length;
}

/* How each plan's requests are treated - the thing the plan actually buys. */
var PLAN_QUEUE = { business: 'in turn', pro: 'priority', max: 'top priority' };

/* Queue rank for sorting: lower goes first. */
function planRankFor(userId) {
  var p = state.profiles.filter(function (x) { return x.id === userId; })[0];
  var order = { max: 0, pro: 1, business: 2 };
  return p && order[p.active_plan] !== undefined ? order[p.active_plan] : 3;
}

function planPriorityLabel(userId) {
  var p = state.profiles.filter(function (x) { return x.id === userId; })[0];
  return (p && PLAN_QUEUE[p.active_plan]) || 'in turn';
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

/* Requests are included on every plan now, so nothing is ever over an
   allowance. The field survives at zero because openRequests() and the
   charge pill read it; historic billed rows keep their billed_at record. */
function markShortfall() {
  state.requests.forEach(function (r) { r.shortfallPoints = 0; });
}

/* ---------------- nav + top-level render ---------------- */

function switchSection(key) {
  activeSection = key;
  selectedCustomerId = null;
  selectedContactId = null;
  render();
  /* The audience counts are asked for when the section opens rather than at
     boot: they are a server round trip nobody needs until they are looking. */
  if (key === 'marketing') loadAudiences();
}

/* The Wix-style home: one row per area - icon, label, a count badge where
   something needs doing, and a chevron. Only shown while no section is
   open; opening one swaps the whole menu for that section's page. */
function renderMenu(counts) {
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

    var count = counts[s.key] || 0;
    if (count > 0) row.appendChild(el('span', 'nav-dot', String(count)));
    row.appendChild(el('span', 'menu-chevron', '›'));

    row.addEventListener('click', function () { switchSection(s.key); });
    nav.appendChild(row);
  });
}

var SECTION_IDS = {
  requests: 'sectionRequests', enquiries: 'sectionEnquiries',
  customers: 'sectionCustomers', contacts: 'sectionContacts',
  plans: 'sectionPlans', payments: 'sectionPayments', templates: 'sectionTemplates',
  marketing: 'sectionMarketing'
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
  if (onMenu) renderMenu({
    requests: open.length + unbuilt.length,
    customers: pendingSeo.length
  });

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
  else if (activeSection === 'enquiries') renderEnquiriesSection();
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

/* The sending address for a Pro customer's campaigns. Saving it flips the
   feature on (and tells them), so the hint spells out the order: verify the
   domain in Resend first, then put the address here. Clearing it turns the
   feature back off. */
function campaignFromRow(p) {
  var row = el('div', 'cust-site');

  var addr = el('input', 'admin-input');
  addr.type = 'email';
  addr.value = p.campaign_from || '';
  addr.placeholder = 'hello@' + ((p.site_url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'their-domain.co.uk');
  addr.setAttribute('aria-label', 'Campaign sending address for ' + (p.business_name || 'this customer'));

  var save = el('button', 'btn btn-ghost admin-save', 'Save');
  save.type = 'button';
  save.addEventListener('click', async function () {
    save.disabled = true;
    var was = save.textContent;
    save.textContent = 'Saving…';
    try {
      await api({ action: 'setCampaignFrom', userId: p.id, fromAddress: addr.value });
      p.campaign_from = addr.value.trim().toLowerCase() || null;
      say('Saved.', 'ok');
      render();
    } catch (err) { say(err.message, 'bad'); }
    save.disabled = false;
    save.textContent = was;
  });

  row.appendChild(addr);
  row.appendChild(save);

  var hint = el('div', 'cust-detail-note');
  hint.appendChild(el('p', 'cust-sub', p.campaign_from
    ? 'Live - their campaigns send from this address. Clear it and save to switch the feature off.'
    : 'Not set - their campaigns are off. Verify their domain in Resend first, then save the address here; they get a notification when it goes live.'));

  var out = el('div', null);
  out.appendChild(row);
  out.appendChild(hint);
  return out;
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
    [['info', 'Business details changed'], ['edit', 'Edit requests'], ['feature', 'Feature requests']].forEach(function (pair) {
      var items = open.filter(function (r) { return r.kind === pair[0]; })
        // Plan priority first - Max, then Pro, then Business - and inside a
        // plan, oldest first. This IS the queue the terms promise.
        .sort(function (a, b) {
          var d = planRankFor(a.user_id) - planRankFor(b.user_id);
          return d !== 0 ? d : new Date(a.created_at) - new Date(b.created_at);
        });
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
  /* How long it has been waiting, not the date it landed - in a queue the
     age is the thing that tells you what to pick up next. */
  var meta = el('p', 'queue-meta',
    kindName(r.kind) + ' · ' + planPriorityLabel(r.user_id)
    + ' · ' + howLong(r.created_at));
  main.appendChild(meta);

  // The money flag, given its own pill so it cannot be skim-read past.
  if (r.shortfallPoints > 0) {
    main.appendChild(el('span', 'over-pill',
      r.shortfallPoints + (r.shortfallPoints === 1 ? ' point' : ' points') + ' over allowance'));
  }
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

    // Requests are included in the plan, so accepting one charges nothing -
    // it just moves the work into the queue.

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
  if (r.kind !== 'info' && (r.status === 'new' || r.status === 'accepted' || r.status === 'in_progress')) {
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

  card.appendChild(el('p', 'cust-points',
    openCountFor(p.id) + ' open · ' + PLAN_QUEUE[p.active_plan] + ' · £' + (lifetimeSpent(p.id) / 100).toFixed(0) + ' spent lifetime'));

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
  wrap.appendChild(ideaChips(p, input));

  return wrap;
}

/* The same idea library the wizard and every account page show, as
   tap-to-fill chips - typing is for the ones the library doesn't have.
   Ideas already on this customer's site drop out. Custom ideas (the ones
   added from here, held in feature_ideas) carry an x that removes them
   from the library everywhere; the thirty starters are baked in and stay. */
function ideaChips(p, input) {
  var box = el('div', 'use-suggest');
  box.appendChild(el('p', 'use-suggest-title', 'Tap to fill — the library customers see'));
  var chips = el('div', 'use-chips');
  box.appendChild(chips);

  function paint() {
    chips.textContent = '';
    var mine = featuresFor(p.id).map(function (f) { return String(f.name).toLowerCase(); });
    var customById = {};
    (window.FEATURE_IDEAS_CUSTOM || []).forEach(function (r) { customById[r.name.toLowerCase()] = r.id; });

    (window.FEATURE_IDEAS || []).forEach(function (idea) {
      var low = idea.toLowerCase();
      if (mine.indexOf(low) !== -1) return;
      var chip = el('button', 'use-chip', idea);
      chip.type = 'button';
      chip.addEventListener('click', function () { input.value = idea; input.focus(); });

      var customId = customById[low];
      if (customId) {
        var x = el('span', 'idea-rm', '×');
        x.setAttribute('role', 'button');
        x.setAttribute('aria-label', 'Remove ' + idea + ' from the library');
        x.addEventListener('click', async function (e) {
          e.stopPropagation();
          if (!confirm('Remove "' + idea + '" from the ideas library everywhere?')) return;
          try {
            await api({ action: 'removeFeatureIdea', ideaId: customId });
            window.FEATURE_IDEAS = window.FEATURE_IDEAS.filter(function (n) { return n !== idea; });
            window.FEATURE_IDEAS_CUSTOM = window.FEATURE_IDEAS_CUSTOM.filter(function (r) { return r.id !== customId; });
            say('Removed from the library.', 'ok');
            paint();
          } catch (err) { say(err.message, 'bad'); }
        });
        chip.appendChild(x);
      }
      chips.appendChild(chip);
    });
  }

  /* Grows the shared library from whatever is typed above - it shows in
     the wizard and on every account page from the next load. */
  var grow = el('button', 'linkish idea-grow', 'Add what’s typed to the ideas library');
  grow.type = 'button';
  grow.addEventListener('click', async function () {
    var val = input.value.trim().replace(/\s+/g, ' ');
    if (!val) return say('Type the idea first.', 'bad');
    var dupe = (window.FEATURE_IDEAS || []).some(function (n) { return n.toLowerCase() === val.toLowerCase(); });
    if (dupe) return say('That one is already in the library.', 'bad');
    grow.disabled = true;
    try {
      var res = await api({ action: 'addFeatureIdea', name: val });
      window.FEATURE_IDEAS.push(res.idea.name);
      window.FEATURE_IDEAS_CUSTOM.push(res.idea);
      say('In the library — it now shows in the wizard and on every account.', 'ok');
      paint();
    } catch (err) { say(err.message, 'bad'); }
    grow.disabled = false;
  });
  box.appendChild(grow);

  // The custom ideas load async on this page like everywhere else; redraw
  // once when they land, if this editor painted first.
  document.addEventListener('one:ideas-loaded', paint, { once: true });
  paint();
  return box;
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
      main.appendChild(el('p', 'queue-meta', kindName(r.kind) + ' · £' +
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
    main.appendChild(el('p', 'queue-meta', kindName(r.kind) + ' · ' +
      when(r.created_at) +
      (r.billed_at ? ' · charged £' + (r.billed_amount / 100).toFixed(0) : '')));
    li.appendChild(main);

    // Where it got to, set right as a pill rather than buried mid-sentence.
    var side = el('div', 'queue-actions');
    side.appendChild(el('span', 'req-state' + (r.status === 'done' ? ' is-done' : ''), STATUS_NAME[r.status]));
    li.appendChild(side);
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

  wrap.appendChild(el('p', 'cust-points',
    openCountFor(p.id) + ' open request' + (openCountFor(p.id) === 1 ? '' : 's') + ' · ' + PLAN_QUEUE[p.active_plan]));
  wrap.appendChild(paymentsPanel(p));

  wrap.appendChild(el('h3', 'req-list-title', 'Features on your site'));
  wrap.appendChild(featureEditor(p));

  if (p.active_plan === 'max') {
    wrap.appendChild(el('h3', 'req-list-title', 'SEO updates'));
    wrap.appendChild(seoLogPanel(p));
  }

  /* Pro and Max: the address their marketing campaigns send from. Saving an
     address here is what turns the feature on for them - do it only after
     their domain is verified with Resend. */
  if (p.active_plan === 'pro' || p.active_plan === 'max') {
    wrap.appendChild(el('h3', 'req-list-title', 'Email marketing'));
    wrap.appendChild(campaignFromRow(p));
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

  wrap.appendChild(el('h3', 'req-list-title', 'Membership'));
  wrap.appendChild(billingPanel(p));

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


/* ---------------- Enquiries: the free-example queue ---------------- */
/*
 * Everything in the leads table: free examples waiting to be made, and
 * enquiries from the homepage form. These never appeared here at all, which
 * meant the only record of them was an inbox.
 *
 * Loaded when the section is opened rather than with everything else. It is a
 * work queue, not a dashboard, and most visits to this page are not about it.
 */
var leadState = { loaded: false, loading: false, rows: [], error: '' };

async function loadLeads(force) {
  if (leadState.loading) return;
  if (leadState.loaded && !force) return;
  leadState.loading = true;
  leadState.error = '';
  try {
    var out = await api({ action: 'listLeads' });
    leadState.rows = (out && out.leads) || [];
    leadState.loaded = true;
  } catch (err) {
    leadState.error = err.message;
  }
  leadState.loading = false;
  render();
}

function leadCard(row) {
  var free = row.source === 'free-preview';
  var card = el('div', 'cust');

  var head = el('div', 'cust-head');
  var names = el('div', 'cust-names');
  names.appendChild(el('h3', null, row.business || row.name || 'No name'));
  names.appendChild(el('p', 'cust-sub', when(row.created_at)
    + (row.name && row.business ? ' · ' + row.name : '')));
  head.appendChild(names);

  var chip = el('span', 'plan-chip' + (free ? ' is-free' : ''), free ? 'Free example' : 'Enquiry');
  head.appendChild(chip);
  card.appendChild(head);

  var reach = el('p', 'cust-contact');
  var mail = el('a', null, row.email);
  mail.href = 'mailto:' + row.email;
  reach.appendChild(mail);
  if (row.handle) reach.appendChild(el('span', 'cust-sub', ' · ' + row.handle));
  if (row.requested_domain) reach.appendChild(el('span', 'cust-sub', ' · ' + row.requested_domain));
  card.appendChild(reach);

  if (row.about) card.appendChild(el('p', 'queue-what', row.about));
  if (!free && row.plan_interest) {
    card.appendChild(el('p', 'cust-sub', 'Interested in ' + row.plan_interest
      + (row.want_app ? ', wants an app' : '')));
  }

  if (free) card.appendChild(previewSender(row));
  card.appendChild(leadRemover(row));
  return card;
}

/* The whole job in one row: paste where it lives, press send. Everything else
   in the email is already known from what they told us. */
function previewSender(row) {
  var wrap = el('div', 'send-preview');
  var note = el('p', 'note');

  if (row.preview_sent_at) {
    wrap.appendChild(el('p', 'cust-points', 'Sent ' + when(row.preview_sent_at)));
    if (row.preview_url) {
      var seen = el('a', 'cust-sub', row.preview_url);
      seen.href = row.preview_url;
      seen.target = '_blank';
      seen.rel = 'noopener';
      wrap.appendChild(seen);
    }
  }

  var input = el('input', 'admin-input');
  input.type = 'url';
  input.placeholder = 'https://… where their example lives';
  input.value = row.preview_url || '';
  input.setAttribute('aria-label', 'Where the example for ' + (row.business || 'this business') + ' lives');

  var btn = el('button', 'btn btn-ghost admin-save',
    row.preview_sent_at ? 'Send again' : 'Send free website design');
  btn.type = 'button';

  /* A second send lands a second email in a customer's inbox, so it takes a
     second click - same shape as delete. The first send stays one click. */
  var armed = false, disarm = null;

  btn.addEventListener('click', async function () {
    var url = input.value.trim();
    if (!url) { note.textContent = 'Paste the address first.'; note.className = 'note bad'; return; }

    if (row.preview_sent_at && !armed) {
      armed = true;
      btn.textContent = 'They already have it — send again?';
      disarm = setTimeout(function () {
        armed = false;
        btn.textContent = 'Send again';
      }, 6000);
      return;
    }
    if (disarm) clearTimeout(disarm);

    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await api({ action: 'sendPreview', leadId: row.id, url: url,
                  again: Boolean(row.preview_sent_at) });
      note.textContent = 'Sent to ' + row.email + '.';
      note.className = 'note ok';
      await loadLeads(true);
    } catch (err) {
      note.textContent = err.message;
      note.className = 'note bad';
      btn.disabled = false;
      btn.textContent = row.preview_sent_at ? 'Send again' : 'Send free website design';
    }
  });

  var row2 = el('div', 'send-row');
  row2.appendChild(input);
  row2.appendChild(btn);
  wrap.appendChild(row2);
  wrap.appendChild(el('p', 'hint', 'They get the design on the button, and '
    + 'WELCOME26 for 50% off their first three months.'));
  wrap.appendChild(note);
  wrap.appendChild(badgeSnippet(row));
  return wrap;
}

/* The tag that puts the pill on the example itself. Built here with their
   address already in it, because the one moment worth asking is while they
   are looking at their own business on their own phone - and the example is
   the only page that happens on. */
function badgeSnippet(row) {
  var wrap = el('details', 'badge-snippet');
  var head = document.createElement('summary');
  head.textContent = 'Pill for the example site';
  wrap.appendChild(head);

  var tag = '<script src="' + location.origin + '/preview-badge.js"'
          + (row.requested_domain ? '\n        data-domain="' + row.requested_domain + '"' : '')
          + ' defer><\/script>';

  var pre = el('pre', 'badge-code');
  pre.textContent = tag;
  wrap.appendChild(pre);

  var copy = el('button', 'btn btn-ghost admin-save', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', function () {
    /* A page can reach the clipboard, unlike an email. Older browsers and
       insecure origins cannot, so there is a fallback that selects it. */
    function done() {
      copy.textContent = 'Copied';
      setTimeout(function () { copy.textContent = 'Copy'; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tag).then(done, select);
    } else {
      select();
    }
    function select() {
      var r = document.createRange();
      r.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      copy.textContent = 'Press ⌘C';
      setTimeout(function () { copy.textContent = 'Copy'; }, 2600);
    }
  });
  wrap.appendChild(copy);

  wrap.appendChild(el('p', 'hint', 'Paste before </body> on the example. It checks '
    + 'the address is still free before saying so, and says nothing about it if '
    + 'it is not.'));
  return wrap;
}

function leadRemover(row) {
  var wrap = el('div', 'lead-remove');
  var armed = false, disarm = null;
  var btn = el('button', 'linkish', 'Delete');
  btn.type = 'button';
  btn.addEventListener('click', async function () {
    if (!armed) {
      armed = true;
      btn.textContent = 'Really delete?';
      /* Left alone, the armed state would sit there until an eventual stray
         click deleted something. It stands down by itself. */
      disarm = setTimeout(function () {
        armed = false;
        btn.textContent = 'Delete';
      }, 5000);
      return;
    }
    if (disarm) clearTimeout(disarm);
    btn.disabled = true;
    try {
      await api({ action: 'deleteLead', leadId: row.id });
      await loadLeads(true);
    } catch (err) {
      btn.disabled = false;
      armed = false;
      btn.textContent = 'Delete';
      say(err.message, 'bad');
    }
  });
  wrap.appendChild(btn);
  return wrap;
}

function renderEnquiriesSection() {
  var wrap = document.getElementById('enquiriesBody');
  wrap.textContent = '';

  if (!leadState.loaded) {
    wrap.appendChild(el('p', 'site-none', leadState.error || 'Loading…'));
    /* A failed load waits for the button. Kicking off another load here would
       loop: the load failing calls render, and render would load again. */
    if (leadState.error) {
      var retry = el('button', 'btn btn-ghost admin-save', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', function () { loadLeads(true); });
      wrap.appendChild(retry);
    } else {
      loadLeads(false);
    }
    return;
  }

  var free = leadState.rows.filter(function (r) { return r.source === 'free-preview'; });
  var waiting = free.filter(function (r) { return !r.preview_sent_at; });
  var done = free.filter(function (r) { return r.preview_sent_at; });
  var asked = leadState.rows.filter(function (r) { return r.source !== 'free-preview'; });

  /* Oldest first where there is work to do: somebody who has waited three days
     should not be under somebody who asked this morning. */
  waiting.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });

  function group(title, rows, empty) {
    wrap.appendChild(el('h3', 'req-list-title', title));
    if (!rows.length) { wrap.appendChild(el('p', 'site-none', empty)); return; }
    rows.forEach(function (r) { wrap.appendChild(leadCard(r)); });
  }

  group('Free examples to make (' + waiting.length + ')', waiting, 'Nothing waiting.');
  group('Enquiries (' + asked.length + ')', asked, 'None yet.');
  group('Already sent (' + done.length + ')', done, 'None yet.');
}

/* ---------------- Ending a membership ---------------- */
/*
 * Cancels at the end of the period they have paid for, which is what the terms
 * promise, and can be undone right up until it happens.
 *
 * The current state comes from Stripe when the panel opens rather than from a
 * column here, so it cannot go stale after a change made in the Stripe
 * dashboard or a webhook that never landed.
 *
 * Two clicks to cancel. "End membership" sitting one stray tap from a
 * customer's plan is how a plan gets ended by accident.
 */
function billingPanel(p) {
  var wrap = el('div', 'danger-panel');
  var note = el('p', 'note');

  if (!p.stripe_subscription_id) {
    wrap.appendChild(el('p', 'hint', 'No subscription on this account.'));
    return wrap;
  }

  var body = el('div');
  wrap.appendChild(body);
  wrap.appendChild(note);
  body.appendChild(el('p', 'hint', 'Checking with Stripe…'));

  function fail(msg) {
    body.textContent = '';
    body.appendChild(el('p', 'hint', msg));
  }

  async function paint() {
    var out;
    try {
      out = await api({ action: 'subscriptionState', userId: p.id });
    } catch (err) { return fail(err.message); }

    var sub = out && out.subscription;
    body.textContent = '';
    if (!sub) return fail('Stripe has no live subscription for this account.');

    var ends = sub.endsAt ? when(sub.endsAt) : 'their next payment date';

    if (sub.cancelAtPeriodEnd) {
      body.appendChild(el('p', 'hint', 'Set to end on ' + ends
        + '. They keep everything until then.'));
      body.appendChild(actionBtn('Keep them on', false, 'Restoring…'));
      return;
    }

    body.appendChild(el('p', 'hint', 'Ends at their next payment date, not today \u2014 they '
      + 'keep the month they have paid for, which is what the terms say. '
      + 'You can undo it any time before ' + ends + '.'));

    var armed = false;
    var btn = el('button', 'btn btn-ghost admin-save danger', 'End membership');
    btn.type = 'button';
    var stand = el('button', 'linkish', 'Keep it');
    stand.type = 'button';
    stand.hidden = true;

    stand.addEventListener('click', function () {
      armed = false;
      btn.textContent = 'End membership';
      btn.classList.remove('is-armed');
      stand.hidden = true;
      note.textContent = '';
      note.className = 'note';
    });

    btn.addEventListener('click', async function () {
      if (!armed) {
        armed = true;
        btn.textContent = 'Yes, end it at the next payment';
        btn.classList.add('is-armed');
        stand.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Ending…';
      try {
        var res = await api({ action: 'setCancelAtPeriodEnd', userId: p.id, cancel: true });
        note.textContent = res && res.endsAt
          ? 'Ending on ' + when(res.endsAt) + '.'
          : 'Ending at their next payment date.';
        note.className = 'note ok';
        await paint();
      } catch (err) {
        note.textContent = err.message;
        note.className = 'note bad';
        btn.disabled = false;
        btn.textContent = 'End membership';
        btn.classList.remove('is-armed');
        stand.hidden = true;
        armed = false;
      }
    });

    var row = el('div', 'danger-row');
    row.appendChild(btn);
    row.appendChild(stand);
    body.appendChild(row);
  }

  /* Undoing takes one click - it is the safe direction. */
  function actionBtn(label, cancel, busyLabel) {
    var b = el('button', 'btn btn-ghost admin-save', label);
    b.type = 'button';
    b.addEventListener('click', async function () {
      b.disabled = true;
      b.textContent = busyLabel;
      try {
        await api({ action: 'setCancelAtPeriodEnd', userId: p.id, cancel: cancel });
        note.textContent = 'Back on. Their plan will renew as normal.';
        note.className = 'note ok';
        await paint();
      } catch (err) {
        note.textContent = err.message;
        note.className = 'note bad';
        b.disabled = false;
        b.textContent = label;
      }
    });
    return b;
  }

  paint();
  return wrap;
}

/* ---------------- Deleting a contact ---------------- */
/*
 * Removes the account and everything hanging off it. There is no undo, so it
 * asks for the business name to be typed rather than settling for a second
 * click: the point is to make it impossible to do to the wrong person while
 * half looking at something else.
 *
 * The endpoint refuses while a subscription is live, whatever this says.
 */
function deletePanel(p) {
  var wrap = el('div', 'danger-panel');
  var note = el('p', 'note');
  var label = p.business_name || p.contact_name || '';

  var live = ['active', 'trialing', 'past_due', 'unpaid'].indexOf(p.subscription_status) !== -1;
  if (live) {
    wrap.appendChild(el('p', 'hint', 'This account has a live subscription. End the membership '
      + 'on their customer page first \u2014 deleting them here would leave Stripe billing a '
      + 'person who no longer exists.'));
    return wrap;
  }

  wrap.appendChild(el('p', 'hint', 'Deletes the account, their profile, their requests and '
    + 'anything they uploaded. This cannot be undone.'));

  var open = el('button', 'btn btn-ghost admin-save danger', 'Delete this contact');
  open.type = 'button';

  var confirm = el('div', 'danger-confirm');
  confirm.hidden = true;

  var prompt = el('label', 'hint', label
    ? 'Type ' + label + ' to confirm'
    : 'Type DELETE to confirm');
  var want = label || 'DELETE';

  var field = el('input');
  field.type = 'text';
  field.autocomplete = 'off';
  field.className = 'danger-input';

  var go = el('button', 'btn btn-ghost admin-save danger', 'Delete permanently');
  go.type = 'button';
  go.disabled = true;

  var stand = el('button', 'linkish', 'Keep them');
  stand.type = 'button';

  field.addEventListener('input', function () {
    go.disabled = field.value.trim().toLowerCase() !== want.trim().toLowerCase();
  });

  open.addEventListener('click', function () {
    confirm.hidden = false;
    open.hidden = true;
    field.focus();
  });

  stand.addEventListener('click', function () {
    confirm.hidden = true;
    open.hidden = false;
    field.value = '';
    go.disabled = true;
    note.textContent = '';
    note.className = 'note';
  });

  go.addEventListener('click', async function () {
    go.disabled = true;
    go.textContent = 'Deleting…';
    try {
      await api({ action: 'deleteContact', userId: p.id });
      selectedContactId = null;
      selectedCustomerId = null;
      await load();
    } catch (err) {
      note.textContent = err.message;
      note.className = 'note bad';
      go.disabled = false;
      go.textContent = 'Delete permanently';
    }
  });

  confirm.appendChild(prompt);
  confirm.appendChild(field);
  var row = el('div', 'danger-row');
  row.appendChild(go);
  row.appendChild(stand);
  confirm.appendChild(row);

  wrap.appendChild(open);
  wrap.appendChild(confirm);
  wrap.appendChild(note);
  return wrap;
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

  wrap.appendChild(el('h3', 'req-list-title', 'Danger zone'));
  wrap.appendChild(deletePanel(p));

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
      row.appendChild(el('p', 'cust-sub', openCountFor(p.id) + ' open request' + (openCountFor(p.id) === 1 ? '' : 's')));
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

  /* Three numbers worth seeing at a glance, side by side rather than as a
     paragraph each - the summary is scanned, not read. */
  var stats = el('div', 'pay-stats');
  [['Monthly recurring', mrr], ['Charged this month', thisMonth], ['Charged all-time', allTime]]
    .forEach(function (pair) {
      var box = el('div', 'pay-stat');
      box.appendChild(el('span', 'pay-stat-label', pair[0]));
      box.appendChild(el('span', 'pay-stat-value', '£' + (pair[1] / 100).toFixed(0)));
      stats.appendChild(box);
    });
  wrap.appendChild(stats);
  wrap.appendChild(el('p', 'hint', 'Recurring is what active plans bill each month. The other two count '
    + 'edits and features charged beyond a plan’s points — plan payments themselves live in Stripe.'));

  wrap.appendChild(el('h3', 'req-list-title', 'All payments'));
  if (!charged.length) { wrap.appendChild(el('p', 'site-none', 'Nothing charged yet.')); return; }

  /* Grouped under a date heading, newest first, with the amount set against
     the description rather than buried in it. */
  var byDay = [];
  charged.slice().sort(function (a, b) { return new Date(b.billed_at) - new Date(a.billed_at); })
    .forEach(function (r) {
      var day = when(r.billed_at);
      var group = byDay[byDay.length - 1];
      if (!group || group.day !== day) { group = { day: day, rows: [] }; byDay.push(group); }
      group.rows.push(r);
    });

  byDay.forEach(function (group) {
    wrap.appendChild(el('h4', 'pay-day', group.day));
    var list = el('ul', 'pay-list');
    group.rows.forEach(function (r) {
      var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
      var li = el('li', 'pay-row');

      var main = el('div', 'pay-main');
      main.appendChild(el('p', 'pay-who', ownerLabel(owner)));
      main.appendChild(el('p', 'pay-what', r.detail));
      main.appendChild(el('p', 'pay-meta', r.kind === 'feature' ? 'Feature request' : 'Edit request'));
      li.appendChild(main);

      var side = el('div', 'pay-side');
      side.appendChild(el('p', 'pay-amount', '£' + (r.billed_amount / 100).toFixed(2)));
      side.appendChild(el('span', 'pay-pill', 'Paid'));
      li.appendChild(side);

      list.appendChild(li);
    });
    wrap.appendChild(list);
  });
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

  dayGroups(items, 'created_at').forEach(function (group) {
  wrap.appendChild(el('h4', 'pay-day', group.day));
  var list = el('ul', 'queue');
  group.rows.forEach(function (r) {
    var owner = state.profiles.filter(function (p) { return p.id === r.user_id; })[0];
    var li = el('li', 'queue-item');

    var main = el('div', 'queue-main');
    main.appendChild(el('p', 'queue-who', ownerLabel(owner)));
    main.appendChild(el('p', 'queue-what', r.detail));
    main.appendChild(el('p', 'queue-meta', kindName(r.kind)));
    var links = attachmentLinks(r);
    if (links) main.appendChild(links);
    li.appendChild(main);

    var actions = el('div', 'queue-actions');
    var save = el('button', 'linkish queue-reclass', 'Save as template');
    save.type = 'button';
    save.addEventListener('click', function () {
      save.hidden = true;
      main.appendChild(saveTemplateForm(r, save));
    });
    actions.appendChild(save);
    li.appendChild(actions);
    list.appendChild(li);
  });
  wrap.appendChild(list);
  });
}

/* Saving a finished job as something other businesses can ask for.
   A name and a description in the customer's language - the raw request
   text is only ever a starting point, since it was written about one
   business - plus build notes that stay ours. */
function saveTemplateForm(r, launchBtn) {
  var wrap = el('div', 'tpl-form');

  var name = el('input', 'admin-input');
  name.type = 'text';
  name.placeholder = 'Name customers see, e.g. Online table booking';
  name.maxLength = 120;
  wrap.appendChild(labelled('Name', name));

  var desc = document.createElement('textarea');
  desc.className = 'admin-input notes-textarea';
  desc.rows = 3;
  desc.placeholder = 'What it does, in their language — shown before they request it.';
  desc.value = r.detail || '';
  wrap.appendChild(labelled('Description customers see', desc));

  var notes = document.createElement('textarea');
  notes.className = 'admin-input notes-textarea';
  notes.rows = 3;
  notes.placeholder = 'Code, gotchas, how you built it — only you ever see this.';
  wrap.appendChild(labelled('Build notes (only you see these)', notes));

  var row = el('div', 'feature-add');
  var go = el('button', 'btn btn-ghost admin-save', 'Save template');
  go.type = 'button';
  go.addEventListener('click', async function () {
    if (!name.value.trim()) { say('Give the template a name.', 'bad'); return; }
    go.disabled = true;
    try {
      await api({ action: 'saveTemplate', kind: r.kind, name: name.value.trim(),
                  description: desc.value.trim(), adminNotes: notes.value.trim() });
      say('Saved as a template.', 'ok');
      await load();
    } catch (err) { say(err.message, 'bad'); go.disabled = false; }
  });
  var cancel = el('button', 'linkish', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', function () { wrap.remove(); launchBtn.hidden = false; });
  row.appendChild(go);
  row.appendChild(cancel);
  wrap.appendChild(row);

  return wrap;
}

function labelled(text, field) {
  var f = el('div', 'field full');
  f.appendChild(el('label', null, text));
  f.appendChild(field);
  return f;
}

/* Everything about one template in one place: what customers read, and the
   notes and reference shots that never leave this page. */
function templateEditor(t) {
  var wrap = el('div', 'tpl-form');

  var name = el('input', 'admin-input');
  name.type = 'text';
  name.value = t.name || '';
  name.maxLength = 120;
  wrap.appendChild(labelled('Name customers see', name));

  var desc = document.createElement('textarea');
  desc.className = 'admin-input notes-textarea';
  desc.rows = 3;
  desc.value = t.description || '';
  desc.placeholder = 'What it does, in their language.';
  wrap.appendChild(labelled('Description customers see', desc));

  var notes = document.createElement('textarea');
  notes.className = 'admin-input notes-textarea';
  notes.rows = 4;
  notes.value = t.admin_notes || '';
  notes.placeholder = 'Code, gotchas, how you built it — only you ever see this.';
  wrap.appendChild(labelled('Build notes (only you see these)', notes));

  // Reference shots, private to the admin bucket.
  var shots = el('div', 'tpl-shots');
  function paintShots() {
    shots.textContent = '';
    (t.images || []).forEach(function (img) {
      var a = document.createElement('a');
      a.className = 'tpl-shot';
      a.href = img.url; a.target = '_blank'; a.rel = 'noopener';
      var thumb = document.createElement('img');
      thumb.src = img.url; thumb.alt = '';
      a.appendChild(thumb);
      shots.appendChild(a);
    });
  }
  paintShots();
  wrap.appendChild(shots);

  var file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp';
  file.multiple = true;
  file.className = 'admin-input';
  file.addEventListener('change', async function () {
    var files = Array.prototype.slice.call(file.files || []);
    if (!files.length) return;
    say('Uploading…');
    try {
      var paths = (t.admin_images || []).slice();
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (f.size > 5 * 1024 * 1024) throw new Error(f.name + ' is over 5 MB.');
        var ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        var path = t.id + '/' + Date.now() + '-' + i + '.' + ext;
        var up = await ONE.db.storage.from('template-assets').upload(path, f, { contentType: f.type });
        if (up.error) throw new Error(up.error.message);
        paths.push(path);
      }
      var res = await api({ action: 'updateTemplate', templateId: t.id, adminImages: paths });
      t.admin_images = res.template.admin_images;
      t.images = res.template.images;
      file.value = '';
      paintShots();
      say('Uploaded.', 'ok');
    } catch (err) { say(err.message, 'bad'); }
  });
  wrap.appendChild(labelled('Reference shots (only you see these)', file));

  var row = el('div', 'feature-add');
  var save = el('button', 'btn btn-ghost admin-save', 'Save changes');
  save.type = 'button';
  save.addEventListener('click', async function () {
    save.disabled = true;
    try {
      await api({ action: 'updateTemplate', templateId: t.id, name: name.value,
                  description: desc.value, adminNotes: notes.value });
      t.name = name.value.trim();
      t.description = desc.value.trim();
      t.admin_notes = notes.value.trim();
      say('Saved.', 'ok');
      render();
    } catch (err) { say(err.message, 'bad'); save.disabled = false; }
  });
  row.appendChild(save);
  wrap.appendChild(row);

  return wrap;
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
    main.appendChild(el('p', 'queue-meta', kindName(t.kind)
      + ((t.admin_notes || (t.images || []).length) ? ' · has your notes' : '')));
    if (t.description) main.appendChild(el('p', 'queue-what', t.description));

    var edit = el('button', 'linkish queue-reclass', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', function () {
      if (li.querySelector('.tpl-form')) { li.querySelector('.tpl-form').remove(); return; }
      main.appendChild(templateEditor(t));
    });
    main.appendChild(edit);
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
/* ---------------------------------------------------------------- marketing
 *
 * The counts come from the server rather than from the profiles already
 * loaded here, because the server is what decides who is actually in a group -
 * having two answers to "who gets this" is how somebody gets emailed twice or
 * not at all.
 */
var AUDIENCE_LABEL = {
  all: 'Everyone', customers: 'Paying customers', contacts: 'Contacts (no plan yet)',
  business: 'Business plan', pro: 'Pro plan', max: 'Max plan'
};
var bcImageUrl = null;

/* The page-wide say() writes to one shared note at the top; this panel has its
   own two, so it gets its own writers. */
function noteWriter(id) {
  return function (msg, kind) {
    var n = document.getElementById(id);
    if (!n) return;
    n.textContent = msg || '';
    n.className = 'note' + (kind ? ' ' + kind : '');
  };
}
var bcSay = noteWriter('bcNote');
var imgSay = noteWriter('bcImageNote');

async function loadAudiences() {
  var sel = document.getElementById('bcAudience');
  if (!sel) return;
  var keep = sel.value;
  try {
    var res = await api({ action: 'broadcastAudience', audience: 'all' });
    sel.textContent = '';
    Object.keys(AUDIENCE_LABEL).forEach(function (key) {
      var n = res.counts[key];
      if (n === undefined) return;
      var o = document.createElement('option');
      o.value = key;
      o.textContent = AUDIENCE_LABEL[key] + ' — ' + n + (n === 1 ? ' person' : ' people');
      o.disabled = n === 0;
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
    bcSay(res.optedOut ? res.optedOut + ' opted out and are never included.' : '');
  } catch (err) {
    bcSay(ONE.friendlyError(err), 'bad');
  }
}

function bcFields() {
  return {
    audience: document.getElementById('bcAudience').value,
    subject: document.getElementById('bcSubject').value.trim(),
    title: document.getElementById('bcTitle').value.trim(),
    body: document.getElementById('bcBody').value.trim(),
    buttonText: document.getElementById('bcButtonText').value.trim(),
    buttonUrl: document.getElementById('bcButtonUrl').value.trim(),
    imageUrl: bcImageUrl || ''
  };
}

/* The picture goes up before the send rather than with it: an email needs a
   URL its reader's mail client can fetch, and that means the file has to
   already be somewhere public. */
async function uploadBroadcastImage(file) {
  if (!file) { bcImageUrl = null; imgSay(''); return; }
  if (file.size > 5 * 1024 * 1024) return imgSay('That is over 5 MB.', 'bad');

  imgSay('Uploading\u2026');
  var ext = (file.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
  var path = 'broadcast/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

  var up = await ONE.db.storage.from('broadcast-images').upload(path, file, { upsert: false });
  if (up.error) { bcImageUrl = null; return imgSay(ONE.friendlyError(up.error), 'bad'); }

  var pub = ONE.db.storage.from('broadcast-images').getPublicUrl(path);
  bcImageUrl = pub && pub.data && pub.data.publicUrl;
  imgSay(bcImageUrl ? 'Picture ready.' : 'Uploaded, but no address came back.',
         bcImageUrl ? 'ok' : 'bad');
}

function wireMarketing() {
  var img = document.getElementById('bcImage');
  if (!img) return;

  img.addEventListener('change', function () { uploadBroadcastImage(this.files && this.files[0]); });

  /* Preview builds the same email the server would, by asking for one
     addressed to nobody - so what is on screen is not a second guess at the
     layout that could drift from the real thing. */
  document.getElementById('bcPreview').addEventListener('click', async function () {
    var f = bcFields();
    if (!f.subject || !f.title || !f.body) {
      return bcSay('Subject, heading and body first.', 'bad');
    }
    var wrap = document.getElementById('bcPreviewWrap');
    var frame = document.getElementById('bcPreviewFrame');
    try {
      var res = await api(Object.assign({ action: 'sendBroadcast', preview: true }, f));
      frame.srcdoc = res.html;
      wrap.hidden = false;
      bcSay('This is what ' + AUDIENCE_LABEL[f.audience] + ' would get.', 'ok');
    } catch (err) {
      bcSay(ONE.friendlyError(err), 'bad');
    }
  });

  document.getElementById('bcSend').addEventListener('click', async function () {
    var f = bcFields();
    var btn = this;

    var count = (document.getElementById('bcAudience').selectedOptions[0] || {}).textContent || '';
    if (!confirm('Send "' + f.subject + '" to ' + count + '?\n\nThis cannot be taken back.')) return;

    btn.disabled = true;
    bcSay('Sending\u2026');
    try {
      var res = await api(Object.assign({ action: 'sendBroadcast' }, f));
      bcSay('Sent to ' + res.sent + (res.sent === 1 ? ' person' : ' people')
        + (res.failed ? ', ' + res.failed + ' failed' : '') + '.', res.failed ? 'bad' : 'ok');
      if (!res.failed) {
        ['bcSubject', 'bcTitle', 'bcBody', 'bcButtonText', 'bcButtonUrl'].forEach(function (id) {
          document.getElementById(id).value = '';
        });
        document.getElementById('bcImage').value = '';
        bcImageUrl = null;
        document.getElementById('bcPreviewWrap').hidden = true;
      }
    } catch (err) {
      bcSay(ONE.friendlyError(err), 'bad');
    }
    btn.disabled = false;
  });
}

/* Bound once, at load: the marketing section's controls live in the page from
   the start, hidden, so there is nothing to re-bind when it opens. */
if (document.getElementById('bcSend')) wireMarketing();

})();
