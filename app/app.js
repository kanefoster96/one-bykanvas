/* one — the One app.
 *
 * A notification layer, live chat and analytics for a site we built. Five
 * tabs: Dashboard (their own site's dashboard, opened inside the app),
 * Analytics (the beacon's numbers), Payments (money in, once Stripe is
 * connected), Chat (only when the site has live chat) and Support (the
 * Requests feature, loaded from the same requests.js the website uses).
 *
 * Runs in a browser at kanvas.one/app and, unchanged, inside the native
 * wrapper (Capacitor). Native is detected at runtime: API calls go to
 * kanvas.one instead of the page's origin, push notifications register
 * through the native plugin, and a tap on one opens the record it points
 * at. Tab state is in memory; the URL hash belongs to requests.js.
 */
(function () {
  'use strict';

  var loading = document.getElementById('loading');
  var login = document.getElementById('login');
  var app = document.getElementById('app');

  var native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  var platform = native ? Capacitor.getPlatform() : 'web';
  var BASE = native ? 'https://kanvas.one' : '';
  window.ONE_API_BASE = BASE;

  if (!window.ONE || !ONE.ready) {
    loading.innerHTML = '<p>Accounts are not connected yet.</p>';
    return;
  }

  var user = null;
  var me = null;          // the /api/app me payload
  var site = null;        // the site in hand (first of theirs)
  var tab = 'Analytics';
  var days = 30;
  var seenAt = 0;
  var pushToken = null;
  var requestsLoaded = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function say(node, message, kind) { node.textContent = message || ''; node.className = 'note' + (kind ? ' ' + kind : ''); }
  function $(id) { return document.getElementById(id); }

  async function token() {
    var sess = await ONE.db.auth.getSession();
    var t = sess.data && sess.data.session && sess.data.session.access_token;
    if (!t) throw new Error('Your session has expired. Log in again.');
    return t;
  }

  async function api(payload) {
    var res = await fetch(BASE + '/api/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
      body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 401) { await showLogin(); throw new Error(data.error || 'Please log in again.'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  }

  /* ---------------------------------------------------------- log in -- */

  async function showLogin() {
    loading.hidden = true;
    app.hidden = true;
    login.hidden = false;
  }

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var note = $('loginNote');
    var btn = $('loginBtn');
    var email = $('loginEmail').value.trim();
    var pw = $('loginPassword').value;
    if (!email || !pw) { say(note, 'Email and password, please.', 'bad'); return; }
    btn.disabled = true;
    say(note, 'Logging in…');
    try {
      var res = await ONE.db.auth.signInWithPassword({ email: email, password: pw });
      if (res.error) throw res.error;
      say(note, '');
      await boot();
    } catch (err) { say(note, ONE.friendlyError(err), 'bad'); }
    btn.disabled = false;
  });

  $('logoutBtn').addEventListener('click', async function () {
    closeSheets();
    try { if (pushToken) await api({ action: 'device_remove', token: pushToken }); } catch (e) { /* the row expires on its own */ }
    try { await ONE.db.auth.signOut({ scope: 'local' }); } catch (e) { /* cleared below regardless */ }
    if (window.ONE_SESSION) await ONE_SESSION.logOut();
    $('dashFrame').src = 'about:blank';
    location.hash = '';
    location.reload();
  });

  /* ------------------------------------------------------------ tabs -- */

  var TABS = ['Dashboard', 'Analytics', 'Payments', 'Chat', 'Support'];

  function showTab(next) {
    if (next === 'Chat' && !hasModule('chat')) next = 'Analytics';
    tab = next;
    TABS.forEach(function (t) {
      $('tab' + t).hidden = t !== tab;
    });
    document.querySelectorAll('.oa-nav-btn').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.tab === tab);
      b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
    });
    window.scrollTo(0, 0);
    if (tab === 'Analytics') loadAnalytics();
    if (tab === 'Dashboard') renderDashboard();
    if (tab === 'Support') loadRequests();
  }

  document.querySelectorAll('.oa-nav-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      // Leaving the requests deep view when the tab changes keeps the
      // hash honest; coming back lands on the list.
      if (b.dataset.tab !== 'Support' && location.hash) history.replaceState(null, '', location.pathname);
      showTab(b.dataset.tab);
    });
  });

  /* requests.js routes on the hash: #new, #new/edit, #r/<id>. Any of
     those means the Support tab, whoever set it. */
  window.addEventListener('hashchange', function () {
    var h = location.hash.replace(/^#/, '');
    if (/^(new|r\/)/.test(h) && tab !== 'Support') showTab('Support');
  });

  function hasModule(m) { return !!(site && (site.modules || []).indexOf(m) >= 0); }

  /* -------------------------------------------------------- dashboard -- */

  /* Signed-in opening of the dashboard inside the app is the next piece
     (a one-time handoff token minted by the server). Until it is agreed
     and built, this tab shows where the dashboard is and opens it in the
     browser. The iframe is already here for the handoff to use. */
  function renderDashboard() {
    var stub = $('dashStub');
    var open = $('dashOpen');
    var hint = $('dashHint');
    var url = site && site.dashboard_url;
    $('dashTitle').textContent = site && site.name ? site.name : 'Your dashboard';
    if (!site) { hint.textContent = 'We have not started your site yet. It appears here the moment we do.'; open.hidden = true; return; }
    if (!url) {
      hint.textContent = site.status === 'live'
        ? 'Your dashboard is being connected to the app. Until then it opens in your browser as usual.'
        : 'Your site is being built. Your dashboard appears here once it is live.';
      open.hidden = true;
      return;
    }
    hint.textContent = 'Customers, jobs, bookings and everything else on your site are managed in your dashboard.';
    open.hidden = false;
    open.href = url;
    stub.hidden = false;
  }

  /* Where a notification points. Chat opens natively; everything else is
     a place in the dashboard. */
  function openLink(n) {
    var link = n.deep_link || null;
    if (link && link.kind === 'chat') { showTab('Chat'); return; }
    if (link && link.kind === 'support' && link.id) { location.hash = 'r/' + link.id; showTab('Support'); return; }
    if (n.href && /^\/requests\.html#(r\/.+)$/.test(n.href)) { location.hash = RegExp.$1; showTab('Support'); return; }
    var url = null;
    if (link && link.path && site && site.dashboard_url) url = site.dashboard_url + link.path;
    else if (n.href && /^https:\/\//.test(n.href)) url = n.href;
    if (url) { showTab('Dashboard'); openExternal(url); return; }
    showTab('Dashboard');
  }

  function openExternal(url) {
    try {
      if (native && Capacitor.Plugins && Capacitor.Plugins.Browser) { Capacitor.Plugins.Browser.open({ url: url }); return; }
    } catch (e) { /* fall back */ }
    window.open(url, '_blank', 'noopener');
  }
  $('dashOpen').addEventListener('click', function (e) {
    if (native) { e.preventDefault(); openExternal(this.href); }
  });

  /* -------------------------------------------------------- analytics -- */

  var anCache = {};
  document.querySelectorAll('.oa-pill').forEach(function (p) {
    p.addEventListener('click', function () {
      days = Number(p.dataset.days) || 30;
      document.querySelectorAll('.oa-pill').forEach(function (q) {
        q.classList.toggle('is-on', q === p);
        q.setAttribute('aria-selected', String(q === p));
      });
      loadAnalytics();
    });
  });

  function fmt(n) { return Number(n || 0).toLocaleString('en-GB'); }
  function delta(node, now, before) {
    node.className = 'oa-delta';
    if (!before && !now) { node.textContent = ''; return; }
    if (!before) { node.textContent = 'new'; node.classList.add('is-up'); return; }
    var pct = Math.round(((now - before) / before) * 100);
    if (pct === 0) { node.textContent = 'same as before'; return; }
    node.textContent = (pct > 0 ? '+' : '') + pct + '%';
    node.classList.add(pct > 0 ? 'is-up' : 'is-down');
  }

  function spark(series) {
    var box = $('anSpark');
    box.innerHTML = '';
    var W = 320, H = 96, pad = 4;
    var max = Math.max.apply(null, series.map(function (d) { return d.visitors; }).concat([1]));
    var step = series.length > 1 ? (W - pad * 2) / (series.length - 1) : 0;
    var pts = series.map(function (d, i) { return [pad + i * step, H - pad - (d.visitors / max) * (H - pad * 2)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - pad) + ' Z';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var a = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    a.setAttribute('d', area); a.setAttribute('fill', '#1d1d1f'); a.setAttribute('opacity', '0.08');
    var l = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    l.setAttribute('d', line); l.setAttribute('fill', 'none'); l.setAttribute('stroke', '#1d1d1f'); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-linejoin', 'round'); l.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(a); svg.appendChild(l);
    box.appendChild(svg);
    var last = series[series.length - 1];
    var first = series[0];
    box.setAttribute('title', first.day + ' to ' + last.day);
  }

  function list(id, rows, keyName, nName, empty) {
    var ol = $(id);
    ol.innerHTML = '';
    if (!rows.length) { ol.appendChild(el('li', 'oa-list-empty', empty)); return; }
    var max = rows[0][nName] || 1;
    rows.forEach(function (r) {
      var li = el('li');
      li.appendChild(el('span', 'oa-list-key', r[keyName]));
      var bar = el('span', 'oa-list-bar');
      bar.style.width = Math.max(6, Math.round((r[nName] / max) * 60)) + 'px';
      li.appendChild(bar);
      li.appendChild(el('span', 'oa-list-n', fmt(r[nName])));
      ol.appendChild(li);
    });
  }

  async function loadAnalytics() {
    if (!site) { $('anEmpty').hidden = false; $('anEmpty').textContent = 'Analytics start the moment your site is live.'; return; }
    var key = site.site_id + ':' + days;
    var data = anCache[key];
    try {
      if (!data) { data = await api({ action: 'analytics', site_id: site.site_id, days: days }); anCache[key] = data; setTimeout(function () { delete anCache[key]; }, 60000); }
    } catch (err) { $('anEmpty').hidden = false; $('anEmpty').textContent = 'Could not load your numbers: ' + err.message; return; }
    renderAnalytics(data);
  }

  function renderAnalytics(d) {
    $('anCompare').textContent = 'Last ' + d.days + ' days, against the ' + d.days + ' before.';
    $('anVisitors').textContent = fmt(d.visitors);
    $('anViews').textContent = fmt(d.views);
    $('anRequests').textContent = fmt(d.requests_open);
    delta($('anVisitorsDelta'), d.visitors, d.previous.visitors);
    delta($('anViewsDelta'), d.views, d.previous.views);
    if (d.payments == null) { $('anPayments').textContent = '–'; $('anPaymentsNote').textContent = hasModule('payments') ? 'connecting' : 'once connected'; }
    else { $('anPayments').textContent = '£' + fmt(Math.round(d.payments / 100)); $('anPaymentsNote').textContent = ''; }
    $('anEmpty').hidden = d.beacon_seen;
    spark(d.series);
    list('anPages', d.pages, 'path', 'views', 'No pages viewed yet.');
    list('anRefs', d.referrers, 'host', 'visitors', d.visitors ? 'Everyone typed your address or came from Google with no referrer.' : 'Nothing yet.');
    var total = d.devices.phone + d.devices.desktop;
    var bar = $('anDevices');
    bar.innerHTML = '';
    var ph = el('span', 'is-phone'), dk = el('span', 'is-desktop');
    ph.style.width = (total ? (d.devices.phone / total) * 100 : 0) + '%';
    dk.style.width = (total ? (d.devices.desktop / total) * 100 : 0) + '%';
    bar.appendChild(ph); bar.appendChild(dk);
    $('anDevicesNote').textContent = total ? Math.round((d.devices.phone / total) * 100) + '% on a phone, ' + Math.round((d.devices.desktop / total) * 100) + '% on a desktop.' : 'No visitors yet.';
  }

  /* ---------------------------------------------------------- support -- */

  /* The Requests feature, from the same file the website uses. Loaded
     once, after login, because it starts itself and needs a session. */
  function loadRequests() {
    if (requestsLoaded) { if (ONE.refreshRequestBadge) ONE.refreshRequestBadge(); return; }
    requestsLoaded = true;
    var base = native ? BASE + '/' : '../';
    [base + 'requests-badge.js?v=1', base + 'requests.js?v=5'].forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      document.body.appendChild(s);
    });
  }

  /* --------------------------------------------------------- activity -- */

  var ICON = { money_in: '£', money_failed: '!', money_refund: '↩', money_cancelled: '✕', work: '🛠', booking: '📅', person: '👤', chat: '💬', review: '★', support: '?' };

  function ago(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function openSheet(id) { $('sheetBack').hidden = false; $(id).hidden = false; }
  function closeSheets() { $('sheetBack').hidden = true; $('activitySheet').hidden = true; $('accountSheet').hidden = true; }
  $('sheetBack').addEventListener('click', closeSheets);
  $('activityClose').addEventListener('click', closeSheets);
  $('accountClose').addEventListener('click', closeSheets);
  $('accountBtn').addEventListener('click', function () { openSheet('accountSheet'); });
  $('deleteLink').addEventListener('click', function () { closeSheets(); showTab('Support'); });

  $('bellBtn').addEventListener('click', async function () {
    openSheet('activitySheet');
    var ul = $('activityList');
    ul.innerHTML = '';
    try {
      var res = await api({ action: 'events' });
      var rows = res.events || [];
      $('activityEmpty').hidden = rows.length > 0;
      rows.forEach(function (n) {
        var li = el('li', new Date(n.created_at).getTime() > seenAt ? 'is-new' : '');
        li.appendChild(el('span', 'oa-act-icon', ICON[n.kind] || '•'));
        var body = el('div', 'oa-act-body');
        body.appendChild(el('p', 'oa-act-title', n.title));
        if (n.body) body.appendChild(el('p', 'oa-act-text', n.body));
        li.appendChild(body);
        li.appendChild(el('span', 'oa-act-when', ago(n.created_at)));
        li.addEventListener('click', function () { closeSheets(); openLink(n); });
        ul.appendChild(li);
      });
      await api({ action: 'seen' });
      seenAt = Date.now();
      $('bellDot').hidden = true;
    } catch (err) {
      $('activityEmpty').hidden = false;
      $('activityEmpty').textContent = 'Could not load activity: ' + err.message;
    }
  });

  /* ------------------------------------------------------------- push -- */

  /* Native only. Asked for after login, not at launch: the person has
     seen what the app is for by then, which is what the stores want. */
  async function setupPush() {
    var note = $('accountPush');
    if (!native) { note.textContent = 'Install the app on your phone to get notifications.'; return; }
    var P = (Capacitor.Plugins && Capacitor.Plugins.PushNotifications) || (Capacitor.registerPlugin && Capacitor.registerPlugin('PushNotifications'));
    if (!P) { note.textContent = 'Notifications are not available in this build.'; return; }
    try {
      var perm = await P.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await P.requestPermissions();
      if (perm.receive !== 'granted') { note.textContent = 'Notifications are off. Turn them on in your phone’s settings to hear about payments and messages.'; return; }
      await P.addListener('registration', async function (t) {
        pushToken = t.value;
        try { await api({ action: 'device', token: t.value, platform: platform, app_version: (window.ONE_APP_VERSION || '1.0.0') }); note.textContent = 'Notifications are on for this phone.'; }
        catch (err) { note.textContent = 'Could not register this phone: ' + err.message; }
      });
      await P.addListener('registrationError', function (e) { note.textContent = 'Could not register for notifications.'; console.error('push', e); });
      await P.addListener('pushNotificationActionPerformed', function (a) {
        var d = (a && a.notification && a.notification.data) || {};
        var link = null;
        try { link = d.deep_link ? JSON.parse(d.deep_link) : null; } catch (e) { link = null; }
        openLink({ kind: d.kind, href: d.href, deep_link: link });
      });
      await P.register();
    } catch (err) { note.textContent = 'Notifications are not available: ' + err.message; }
  }

  /* ------------------------------------------------------------- boot -- */

  async function boot() {
    var res = await ONE.db.auth.getSession();
    if (!res.data.session) { await showLogin(); return; }
    user = res.data.session.user;
    login.hidden = true;
    try {
      me = await api({ action: 'me' });
    } catch (err) {
      loading.innerHTML = '<p>Could not load your account: ' + ONE.friendlyError(err) + '</p>';
      loading.hidden = false;
      return;
    }
    site = (me.sites && me.sites[0]) || null;
    $('siteName').textContent = site ? site.name : '';
    $('accountEmail').textContent = me.user.email || '';
    $('navChat').hidden = !hasModule('chat');
    $('bellDot').hidden = !(me.unread && me.unread.notifications > 0);
    var reqBadge = $('navReqCount');
    reqBadge.textContent = String(me.unread ? me.unread.requests : 0);
    reqBadge.hidden = !(me.unread && me.unread.requests > 0);
    seenAt = Date.now() - 1; // what is unread now stays highlighted until the sheet opens

    loading.hidden = true;
    app.hidden = false;

    var h = location.hash.replace(/^#/, '');
    showTab(/^(new|r\/)/.test(h) ? 'Support' : 'Analytics');
    setupPush();
  }

  boot();
})();
