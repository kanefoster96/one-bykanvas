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

  /* Two native shells are understood: the Expo app (mobile/), which loads
     this page from kanvas.one inside a WebView and talks through
     window.ReactNativeWebView, and the older Capacitor bundle. */
  var capacitor = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  var rn = !!window.ReactNativeWebView;
  var native = capacitor || rn;
  var platform = capacitor ? Capacitor.getPlatform() : rn ? (window.ONE_NATIVE_PLATFORM || 'ios') : 'web';
  var BASE = capacitor ? 'https://kanvas.one' : '';
  window.ONE_API_BASE = BASE;

  function toNative(msg) {
    if (!rn) return;
    try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) { /* not in the shell after all */ }
  }
  function nativeReady() { toNative({ type: 'ready' }); }

  if (!window.ONE || !ONE.ready) {
    loading.innerHTML = '<p>Accounts are not connected yet.</p>';
    nativeReady();
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

  function api(payload) { return apiTo('/api/app', payload); }

  async function apiTo(path, payload) {
    var res = await fetch(BASE + path, {
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
    nativeReady();
  }

  /* In the shell, a link out of the app opens outside it; a WebView that
     wandered off to reset.html would have no way back. */
  $('forgotLink').addEventListener('click', function (e) {
    if (native) { e.preventDefault(); openExternal(this.href); }
  });

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
    if (tab === 'Dashboard') { var p = pendingPath; pendingPath = null; renderDashboard(p); }
    if (tab === 'Support') loadRequests();
    if (tab === 'Chat') { if (openConv && !pendingConv) schedulePoll(); else { openConv = null; $('chatThread').hidden = true; $('tabChat').classList.remove('is-thread'); $('chatList').hidden = false; loadChats(); } }
    else { $('onlineBar').hidden = true; }
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

  /* The admin sees every site; a picker in the header says which one the
     tabs are about. Everything cached per site is dropped on a switch. */
  function selectSite(id) {
    var next = (me.sites || []).filter(function (s) { return s.site_id === id; })[0];
    if (!next || (site && site.site_id === id)) return;
    site = next;
    anCache = {};
    framedAt = null; pendingPath = null;
    $('dashFrame').src = 'about:blank';
    convs = []; openConv = null; pendingConv = null;
    if (chatChannel) { try { ONE.db.removeChannel(chatChannel); } catch (e) {} chatChannel = null; }
    $('navChat').hidden = !hasModule('chat');
    var badge = $('navChatCount'); if (badge) badge.hidden = true;
    if (hasModule('chat')) { listenChat(); loadChats(); }
    showTab(tab === 'Chat' && !hasModule('chat') ? 'Analytics' : tab);
  }
  $('sitePick').addEventListener('change', function () { selectSite(this.value); });

  /* -------------------------------------------------------- dashboard -- */

  /* The customer's own dashboard, inside the tab, signed in. The app asks
     the server for a one-time handoff URL (a magic-link token minted for
     this user, carried in the fragment) and points the frame at it;
     kanvas-handoff.js on the dashboard turns it into a session there.
     Handed off once per app session, then the frame is left alone; a deep
     link with a path hands off again at that path. */
  var framedAt = null;    // the path the frame was last handed off to
  var pendingPath = null; // a deep link waiting for the tab to show

  function renderDashboard(path) {
    var stub = $('dashStub');
    var frame = $('dashFrame');
    var open = $('dashOpen');
    var hint = $('dashHint');
    var wrap = $('tabDashboard');
    $('dashTitle').textContent = site && site.name ? site.name : 'Your dashboard';
    if (!site || !site.dashboard_url) {
      wrap.classList.remove('is-framed');
      frame.hidden = true; stub.hidden = false; open.hidden = true;
      hint.textContent = !site ? 'We have not started your site yet. It appears here the moment we do.'
        : site.status === 'live' ? 'Your dashboard is being connected to the app. Until then it opens in your browser as usual.'
        : 'Your site is being built. Your dashboard appears here once it is live.';
      return;
    }
    if (framedAt !== null && !path) return; // already showing, leave it be
    var target = path || '/';
    api({ action: 'dashboard', site_id: site.site_id, path: target }).then(function (res) {
      framedAt = target;
      wrap.classList.add('is-framed');
      stub.hidden = true;
      frame.hidden = false;
      frame.src = res.url;
    }).catch(function (err) {
      // No handoff: say so and offer the browser, where they log in as usual.
      wrap.classList.remove('is-framed');
      frame.hidden = true; stub.hidden = false;
      hint.textContent = 'Could not open your dashboard here just now (' + err.message + '). It still opens in your browser.';
      open.hidden = false; open.href = site.dashboard_url;
    });
  }

  /* Where a notification points. Chat opens natively; everything else is
     a place in the dashboard. */
  function openLink(n) {
    var link = n.deep_link || null;
    if (link && link.kind === 'chat') { pendingConv = link.id || null; showTab('Chat'); return; }
    if (link && link.kind === 'support' && link.id) { location.hash = 'r/' + link.id; showTab('Support'); return; }
    if (n.href && /^\/requests\.html#(r\/.+)$/.test(n.href)) { location.hash = RegExp.$1; showTab('Support'); return; }
    if (n.href && /^\/admin\.html#r\/(.+)$/.test(n.href)) { pendingRequest = RegExp.$1; showTab('Support'); return; }
    if (link && link.path && site && site.dashboard_url) { pendingPath = link.path; showTab('Dashboard'); return; }
    if (n.href && /^https:\/\//.test(n.href)) { showTab('Dashboard'); openExternal(n.href); return; }
    showTab('Dashboard');
  }

  function openExternal(url) {
    if (rn) { toNative({ type: 'open', url: url }); return; }
    try {
      if (capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser) { Capacitor.Plugins.Browser.open({ url: url }); return; }
    } catch (e) { /* fall back */ }
    window.open(url, '_blank', 'noopener');
  }
  $('dashOpen').addEventListener('click', function (e) {
    if (native) { e.preventDefault(); openExternal(this.href); }
  });
  $('dashFrame').setAttribute('allow', 'clipboard-write; camera; microphone; geolocation');

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

  /* ------------------------------------------------------------- chat -- */

  var convs = [];
  var openConv = null;     // the conversation on screen
  var chatTimer = null;
  var chatChannel = null;
  var pendingConv = null;  // a deep link waiting for the tab

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /* A page path as a person would say it: / is the homepage, the rest is
     the file name in words. */
  function pageName(path) {
    var p = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '');
    if (!p || p === '/index.html' || p === '/index') return 'Homepage';
    var last = p.split('/').filter(Boolean).pop() || '';
    last = last.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim();
    return last ? last.charAt(0).toUpperCase() + last.slice(1) : 'Homepage';
  }

  /* An anonymous visitor gets a steady number from their conversation id,
     the way an inbox names people who never said who they were. */
  function visitorNo(id) { return String(parseInt(String(id || '').replace(/-/g, '').slice(-6), 16) % 9000 + 1000); }
  function displayName(c) {
    if (c.name) return c.name;
    if (c.channel && c.channel !== 'web' && c.phone) return c.phone;
    return 'Visitor #' + visitorNo(c.id);
  }

  var AVATAR_COLOURS = ['#f5a623', '#3b6fd6', '#2a9d8f', '#c2417f', '#7b4fd6', '#e07a3a'];
  var CHAN_ICON = {
    web: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.5 3.1 6L5 21l4.4-2.1c.8.2 1.7.3 2.6.3 5 0 9-3.6 9-8s-4-8-9-8z"/></svg>',
    sms: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm0 2a7.5 7.5 0 1 1-3.9 13.9l-.3-.2-2.6.7.7-2.5-.2-.3A7.5 7.5 0 0 1 12 4.5zm-2.7 3.6c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.2 2.4.9 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4 0-.1-.2-.2-.5-.4l-1.8-.9c-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5z"/></svg>'
  };
  function avatarFor(c, size) {
    var av = el('span', 'oa-avatar');
    if (c.name) {
      av.textContent = initials(c.name);
      var n = 0; String(c.id || '').split('').forEach(function (ch) { n = (n + ch.charCodeAt(0)) % 9973; });
      av.style.background = AVATAR_COLOURS[n % AVATAR_COLOURS.length];
    } else {
      av.classList.add('is-anon');
      av.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>';
    }
    var chan = c.channel || 'web';
    if (c.online && chan === 'web') av.appendChild(el('span', 'oa-online'));
    else { var dot = el('span', 'oa-chan-dot is-' + chan); dot.innerHTML = CHAN_ICON[chan] || CHAN_ICON.web; av.appendChild(dot); }
    return av;
  }

  /* When a conversation last moved, the way an inbox says it: a time
     today, Yesterday, a weekday this week, else a date. */
  function whenText(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var now = new Date();
    var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var t = d.getTime();
    if (t >= startToday) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (t >= startToday - 86400000) return 'Yesterday';
    if (t >= startToday - 6 * 86400000) return d.toLocaleDateString('en-GB', { weekday: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  var convFilter = '';
  $('convSearch').addEventListener('input', function () { convFilter = this.value.trim().toLowerCase(); renderConvs(); });

  function renderConvs() {
    var ul = $('convList');
    ul.innerHTML = '';
    var rows = convs;
    if (convFilter) rows = convs.filter(function (c) { return (displayName(c) + ' ' + (c.preview || '') + ' ' + (c.email || '') + ' ' + (c.phone || '')).toLowerCase().indexOf(convFilter) >= 0; });
    $('convEmpty').hidden = convs.length > 0;
    if (convs.length && !rows.length) ul.appendChild(el('li', 'oa-list-none', 'Nothing matches.'));
    rows.forEach(function (c) {
      var li = el('li', (c.unread ? 'is-unread' : '') + (c.status === 'closed' ? ' is-closed' : ''));
      li.appendChild(avatarFor(c));
      var body = el('div', 'oa-conv-body');
      var top = el('div', 'oa-conv-top');
      top.appendChild(el('p', 'oa-conv-name', displayName(c)));
      top.appendChild(el('span', 'oa-conv-when', whenText(c.last_at)));
      body.appendChild(top);
      body.appendChild(el('p', 'oa-conv-preview', (c.last_by === 'owner' ? 'You: ' : '') + (c.preview || (c.page ? 'Visited ' + pageName(c.page) : ''))));
      li.appendChild(body);
      li.addEventListener('click', function () { openThread(c.id); });
      ul.appendChild(li);
    });
    renderOnlineBar();
  }

  /* The green bar: who is on the site right now. Tapping it opens the
     newest of them. */
  function renderOnlineBar() {
    var here = convs.filter(function (c) { return c.online && c.status !== 'closed' && !c.blocked; });
    var bar = $('onlineBar');
    bar.hidden = !here.length || tab !== 'Chat' || !!openConv;
    $('onlineN').textContent = String(here.length);
    $('onlineText').textContent = here.length === 1 ? 'Visitor on your site now' : 'Visitors on your site now';
    bar.onclick = here.length ? function () { openThread(here[0].id); } : null;
  }

  async function loadChats() {
    if (!site) return;
    try {
      var res = await api({ action: 'chat_list', site_id: site.site_id });
      convs = res.conversations || [];
      renderConvs();
      var n = convs.filter(function (c) { return c.unread; }).length;
      var badge = $('navChatCount');
      if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
    } catch (err) { $('convEmpty').hidden = false; $('convEmpty').textContent = 'Could not load your chats: ' + err.message; }
    if (pendingConv) { var id = pendingConv; pendingConv = null; openThread(id); }
  }

  function scrollThread() { var box = $('chatMsgs'); box.scrollTop = box.scrollHeight; }

  function chatBubble(m) {
    var wrap = el('div', 'msg ' + (m.author === 'owner' ? 'from-owner' : m.author === 'system' ? 'from-system' : 'from-visitor'));
    wrap.dataset.id = m.id;
    var head = el('div', 'msg-who', m.author === 'owner' ? 'You' + (m.emailed ? ' · also emailed' : '') : (openConv ? displayName(openConv) : 'Visitor'));
    wrap.appendChild(head);
    var box = el('div', 'msg-body');
    String(m.body).split(/\n{2,}/).forEach(function (p) {
      var para = el('p');
      p.split('\n').forEach(function (line, i) { if (i) para.appendChild(document.createElement('br')); para.appendChild(document.createTextNode(line)); });
      box.appendChild(para);
    });
    wrap.appendChild(box);
    wrap.appendChild(el('div', 'msg-when', (m.author === 'owner' && m.emailed ? 'Also emailed · ' : '') + ago(m.at)));
    return wrap;
  }

  function renderConvHead(c) {
    var chan = c.channel || 'web';
    $('convName').textContent = displayName(c);
    var avBox = $('convAvatar');
    avBox.replaceWith(avatarFor(c)); $('chatThread').querySelector('.oa-conv-head .oa-avatar').id = 'convAvatar';
    var bits = [];
    if (chan === 'whatsapp') bits.push('WhatsApp');
    else if (chan === 'sms') bits.push('Text message' + (c.name && c.phone ? ' · ' + c.phone : ''));
    else if (c.online) bits.push('On your site now'); else bits.push('Last seen ' + ago(c.last_at));
    if (c.page) bits.push(pageName(c.page));
    if (c.status === 'closed') bits.push('Closed');
    if (c.blocked) bits.push('Blocked');
    $('convMeta').textContent = bits.join(' · ');
    var call = $('convCall'), mail = $('convMail');
    call.hidden = !c.phone; if (c.phone) call.href = 'tel:' + String(c.phone).replace(/[^\d+]/g, '');
    $('convCallBiz').hidden = !(c.phone && site && site.phone_number);
    mail.hidden = !c.email; if (c.email) mail.href = 'mailto:' + c.email;
    $('convTools').hidden = !(c.phone || c.email);
    $('convClose').textContent = c.status === 'closed' ? 'Reopen conversation' : 'Close conversation';
    $('convBlock').textContent = c.blocked ? 'Unblock this visitor' : 'Block this visitor';
    // Gone but reachable: say so, and default the reply to go by email too.
    var off = $('chatOffline'), emailToo = $('chatEmailToo');
    $('chatBody').placeholder = chan === 'whatsapp' ? 'Reply on WhatsApp' : chan === 'sms' ? 'Reply by text' : 'Write a reply';
    if (chan !== 'web') { off.hidden = true; emailToo.hidden = true; }
    else if (!c.online && c.email) { off.hidden = false; off.textContent = 'They’ve left the site. Your reply goes to ' + c.email + ' as well.'; emailToo.hidden = false; $('chatEmailBox').checked = true; }
    else if (!c.online && c.phone) { off.hidden = false; off.textContent = 'They’ve left the site. They left a number, so a call might be quickest.'; emailToo.hidden = true; }
    else if (c.email) { off.hidden = true; emailToo.hidden = false; $('chatEmailBox').checked = false; }
    else { off.hidden = true; emailToo.hidden = true; }
    $('chatForm').hidden = !!c.blocked;
  }

  async function openThread(id) {
    $('chatList').hidden = true;
    $('chatThread').hidden = false;
    $('tabChat').classList.add('is-thread');
    $('onlineBar').hidden = true;
    $('convMenu').hidden = true;
    $('chatMsgs').innerHTML = '';
    say($('chatNote'), '');
    window.scrollTo(0, 0);
    try {
      var res = await api({ action: 'chat_get', site_id: site.site_id, conversation_id: id });
      openConv = res.conversation;
      renderConvHead(openConv);
      var box = $('chatMsgs');
      res.messages.forEach(function (m) { box.appendChild(chatBubble(m)); });
      scrollThread();
      convs.forEach(function (c) { if (c.id === id) c.unread = false; });
    } catch (err) { say($('chatNote'), err.message, 'bad'); }
    schedulePoll();
  }

  function closeThread() {
    openConv = null;
    $('chatThread').hidden = true;
    $('tabChat').classList.remove('is-thread');
    $('chatList').hidden = false;
    loadChats();
  }
  $('chatBack').addEventListener('click', closeThread);
  $('convMore').addEventListener('click', function () { $('convMenu').hidden = !$('convMenu').hidden; });
  $('convClose').addEventListener('click', async function () {
    if (!openConv) return;
    try { var r = await api({ action: 'chat_set', site_id: site.site_id, conversation_id: openConv.id, status: openConv.status === 'closed' ? 'open' : 'closed' }); openConv = r.conversation; renderConvHead(openConv); $('convMenu').hidden = true; }
    catch (err) { say($('chatNote'), err.message, 'bad'); }
  });
  $('convBlock').addEventListener('click', async function () {
    if (!openConv) return;
    if (!openConv.blocked && !confirm('Block this visitor? They will not be able to message you again from this chat.')) return;
    try { var r = await api({ action: 'chat_set', site_id: site.site_id, conversation_id: openConv.id, blocked: !openConv.blocked }); openConv = r.conversation; renderConvHead(openConv); $('convMenu').hidden = true; }
    catch (err) { say($('chatNote'), err.message, 'bad'); }
  });

  $('convCallBiz').addEventListener('click', async function () {
    if (!openConv) return;
    var b = this; b.disabled = true;
    say($('chatNote'), 'Ringing your phone first, then connecting them…');
    try { await api({ action: 'call_back', site_id: site.site_id, conversation_id: openConv.id }); say($('chatNote'), 'Answer your phone and you\u2019ll be connected. They see your business number.', 'ok'); }
    catch (err) { say($('chatNote'), err.message, 'bad'); }
    b.disabled = false;
  });
  $('chatBody').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; });
  $('chatForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!openConv) return;
    var ta = $('chatBody');
    var text = ta.value.trim();
    if (!text) return;
    var btn = $('chatSend');
    btn.disabled = true;
    try {
      var via = $('chatEmailToo').hidden ? undefined : ($('chatEmailBox').checked ? 'email' : 'chat');
      var r = await api({ action: 'chat_reply', site_id: site.site_id, conversation_id: openConv.id, body: text, via: via });
      ta.value = ''; ta.style.height = 'auto';
      $('chatMsgs').appendChild(chatBubble(r.message));
      openConv = r.conversation;
      say($('chatNote'), r.delivered.indexOf('email') >= 0 ? 'Sent, and emailed to them.' : r.delivered[0] === 'sms' ? 'Sent by text.' : r.delivered[0] === 'whatsapp' ? 'Sent on WhatsApp.' : '', 'ok');
      scrollThread();
    } catch (err) { say($('chatNote'), err.message, 'bad'); }
    btn.disabled = false;
  });

  /* New messages arrive two ways: Supabase Realtime on this site's
     messages when it is up, and a slow poll regardless. */
  function onNewMessage(m) {
    if (openConv && m.conversation_id === openConv.id) {
      if (!$('chatMsgs').querySelector('[data-id="' + m.id + '"]')) {
        $('chatMsgs').appendChild(chatBubble({ id: m.id, author: m.author, body: m.body, at: m.created_at }));
        scrollThread();
      }
      if (m.author === 'visitor') api({ action: 'chat_get', site_id: site.site_id, conversation_id: openConv.id }).then(function (r) { openConv = r.conversation; renderConvHead(openConv); }).catch(function () {});
    } else if (tab === 'Chat') loadChats();
    else if (m.author === 'visitor') { var b = $('navChatCount'); if (b) { b.textContent = String((Number(b.textContent) || 0) + 1); b.hidden = false; } }
  }
  function listenChat() {
    if (chatChannel || !site || !hasModule('chat') || !ONE.db.channel) return;
    try {
      chatChannel = ONE.db.channel('site-messages-' + site.site_id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'site_id=eq.' + site.site_id }, function (payload) { if (payload && payload.new) onNewMessage(payload.new); })
        .subscribe();
    } catch (e) { chatChannel = null; }
  }
  function schedulePoll() {
    clearTimeout(chatTimer);
    if (!hasModule('chat')) return;
    chatTimer = setTimeout(async function () {
      try {
        if (openConv) {
          var r = await api({ action: 'chat_get', site_id: site.site_id, conversation_id: openConv.id });
          openConv = r.conversation; renderConvHead(openConv);
          var box = $('chatMsgs');
          var added = false;
          r.messages.forEach(function (m) { if (!box.querySelector('[data-id="' + m.id + '"]')) { box.appendChild(chatBubble(m)); added = true; } });
          if (added) scrollThread();
        } else if (tab === 'Chat') await loadChats();
      } catch (e) { /* next tick */ }
      schedulePoll();
    }, openConv ? 8000 : 20000);
  }

  /* ---------------------------------------------------------- support -- */

  /* The Requests feature, from the same file the website uses. Loaded
     once, after login, because it starts itself and needs a session. */
  var pendingRequest = null; // an admin thread waiting for the tab
  var adminRows = [];
  var adminOpenId = null;
  var STATUS_WORD = { new: 'Open', waiting: 'Waiting on them', in_progress: 'Being built', done: 'Done', declined: 'Declined' };
  var STATUS_CLASS = { waiting: 'is-waiting', in_progress: 'is-building', done: 'is-done', declined: 'is-done' };

  function adminCard(r) {
    var waiting = r.last_note_by === 'customer' && r.status !== 'done' && r.status !== 'declined';
    var a = el('a', 'req-card' + (waiting ? ' is-unread' : ''));
    a.href = '#';
    a.addEventListener('click', function (e) { e.preventDefault(); openAdminThread(r.id); });
    var top = el('div', 'req-card-top');
    var t = el('div');
    t.appendChild(el('span', 'oa-req-biz', r.business_name || r.contact_name || 'Customer'));
    t.appendChild(el('h3', 'req-card-title', r.title));
    top.appendChild(t);
    top.appendChild(el('span', 'req-state ' + (STATUS_CLASS[r.status] || ''), STATUS_WORD[r.status] || 'Open'));
    a.appendChild(top);
    var line = el('p', 'req-card-line');
    if (r.latest) {
      line.appendChild(el('span', 'req-card-snippet', r.latest.body));
      line.appendChild(el('span', 'req-card-meta' + (waiting ? ' oa-req-wait' : ''), (r.latest.author === 'admin' ? 'You' : 'Them') + ', ' + ago(r.latest.created_at) + (waiting ? ' · waiting on you' : '')));
    }
    a.appendChild(line);
    return a;
  }

  async function loadAdminInbox() {
    $('adminThread').hidden = true;
    $('adminInbox').hidden = false;
    try {
      var res = await apiTo('/api/admin', { action: 'requestsInbox' });
      adminRows = res.requests || [];
    } catch (err) { $('adminEmpty').hidden = false; $('adminEmpty').textContent = 'Could not load requests: ' + err.message; return; }
    var open = adminRows.filter(function (r) { return r.status !== 'done' && r.status !== 'declined'; });
    var done = adminRows.filter(function (r) { return r.status === 'done' || r.status === 'declined'; });
    var openBox = $('adminOpen'); openBox.innerHTML = '';
    open.forEach(function (r) { openBox.appendChild(adminCard(r)); });
    $('adminEmpty').hidden = open.length > 0;
    var doneBox = $('adminDone'); doneBox.innerHTML = '';
    done.forEach(function (r) { doneBox.appendChild(adminCard(r)); });
    $('adminDoneWrap').hidden = done.length === 0;
    $('adminDoneCount').textContent = String(done.length);
    var waiting = open.filter(function (r) { return r.last_note_by === 'customer'; }).length;
    var badge = $('navReqCount'); badge.textContent = String(waiting); badge.hidden = waiting === 0;
    if (pendingRequest) { var id = pendingRequest; pendingRequest = null; openAdminThread(id); }
  }

  function noteBubble(n) {
    var wrap = el('div', 'msg ' + (n.author === 'admin' ? 'from-owner' : 'from-visitor') + (n.private ? ' is-private' : ''));
    wrap.appendChild(el('div', 'msg-who', n.author === 'admin' ? (n.private ? 'Private note' : 'You') : 'Them'));
    var box = el('div', 'msg-body');
    String(n.body).split(/\n{2,}/).forEach(function (p) {
      var para = el('p');
      p.split('\n').forEach(function (line, i) { if (i) para.appendChild(document.createElement('br')); para.appendChild(document.createTextNode(line)); });
      box.appendChild(para);
    });
    if (n.attachments && n.attachments.length) {
      var files = el('div', 'msg-files');
      n.attachments.forEach(function (f, i) { var a = el('a', 'msg-file', 'Photo ' + (i + 1)); a.href = f.url; a.target = '_blank'; a.rel = 'noopener'; files.appendChild(a); });
      box.appendChild(files);
    }
    wrap.appendChild(box);
    wrap.appendChild(el('div', 'msg-when', ago(n.created_at)));
    return wrap;
  }

  async function openAdminThread(id) {
    $('adminInbox').hidden = true;
    $('adminThread').hidden = false;
    $('aThread').innerHTML = '';
    say($('aNote'), '');
    adminOpenId = id;
    try {
      var t = await apiTo('/api/admin', { action: 'requestThread', requestId: id });
      $('aTitle').textContent = t.request.title || 'Request';
      $('aStatus').textContent = STATUS_WORD[t.request.status] || 'Open';
      $('aStatus').className = 'req-state ' + (STATUS_CLASS[t.request.status] || '');
      var c = t.customer || {};
      $('aWho').textContent = [c.business_name, c.contact_name, c.email].filter(Boolean).join(' · ');
      var box = $('aThread');
      (t.notes || []).forEach(function (n) { box.appendChild(noteBubble(n)); });
      window.scrollTo(0, document.body.scrollHeight);
    } catch (err) { say($('aNote'), err.message, 'bad'); }
  }
  $('adminBack').addEventListener('click', loadAdminInbox);
  $('aBody').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; });
  $('aForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!adminOpenId) return;
    var ta = $('aBody');
    var text = ta.value.trim();
    if (!text) return;
    var mode = (document.querySelector('input[name="aMode"]:checked') || {}).value || 'waiting';
    var payload = { action: 'addRequestNote', requestId: adminOpenId, body: text };
    if (mode === 'private') payload.isPrivate = true; else payload.status = mode;
    $('aSend').disabled = true;
    try {
      var r = await apiTo('/api/admin', payload);
      ta.value = ''; ta.style.height = 'auto';
      $('aThread').appendChild(noteBubble(Object.assign({ author: 'admin', private: mode === 'private' }, r.note)));
      if (r.request) { $('aStatus').textContent = STATUS_WORD[r.request.status] || 'Open'; $('aStatus').className = 'req-state ' + (STATUS_CLASS[r.request.status] || ''); }
      say($('aNote'), mode === 'private' ? 'Noted, just for you.' : 'Sent. They get it on their phone and by email.', 'ok');
      window.scrollTo(0, document.body.scrollHeight);
    } catch (err) { say($('aNote'), err.message, 'bad'); }
    $('aSend').disabled = false;
  });

  function loadRequests() {
    if (me && me.user && me.user.is_admin) { if (pendingRequest || $('adminThread').hidden) loadAdminInbox(); return; }
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
  async function registerDevice(t) {
    var note = $('accountPush');
    pushToken = t;
    try { await api({ action: 'device', token: t, platform: platform, app_version: (window.ONE_APP_VERSION || '1.0.0') }); note.textContent = 'Notifications are on for this phone.'; }
    catch (err) { note.textContent = 'Could not register this phone: ' + err.message; }
  }

  /* What the Expo shell can call into the page. Defined once, before
     login: a notification tapped on a cold start arrives before the app
     has booted, and waits here until it has. */
  var nativeLink = null;
  function parseNativeLink(d) {
    d = d && typeof d === 'object' ? d : {};
    var link = d.deep_link;
    if (typeof link === 'string') { try { link = JSON.parse(link); } catch (e) { link = null; } }
    return { kind: d.kind, href: d.href, deep_link: link || null };
  }
  window.ONE_NATIVE = {
    onPushToken: function (t) { if (t) registerDevice(String(t)); },
    onPushDenied: function (why) {
      $('accountPush').textContent = why === 'simulator' ? 'Notifications need a real phone.'
        : why === 'denied' ? 'Notifications are off. Turn them on in your phone’s settings to hear about payments and messages.'
        : 'Notifications are not available right now.';
    },
    openLink: function (d) { var n = parseNativeLink(d); if (me) openLink(n); else nativeLink = n; },
    refresh: function () {
      if (!me) return;
      $('bellDot').hidden = false;
      if (hasModule('chat')) loadChats();
      if (tab === 'Support' && me.user && me.user.is_admin && $('adminThread').hidden) loadAdminInbox();
      if (tab === 'Support' && !(me.user && me.user.is_admin) && ONE.refreshRequestBadge) ONE.refreshRequestBadge();
    }
  };

  async function setupPush() {
    var note = $('accountPush');
    if (!native) { note.textContent = 'Install the app on your phone to get notifications.'; return; }
    if (rn) { note.textContent = 'Setting up notifications…'; toNative({ type: 'push:register' }); return; }
    var P = (Capacitor.Plugins && Capacitor.Plugins.PushNotifications) || (Capacitor.registerPlugin && Capacitor.registerPlugin('PushNotifications'));
    if (!P) { note.textContent = 'Notifications are not available in this build.'; return; }
    try {
      var perm = await P.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await P.requestPermissions();
      if (perm.receive !== 'granted') { note.textContent = 'Notifications are off. Turn them on in your phone’s settings to hear about payments and messages.'; return; }
      await P.addListener('registration', function (t) { registerDevice(t.value); });
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
      nativeReady();
      return;
    }
    site = (me.sites && me.sites[0]) || null;
    $('siteName').textContent = site ? site.name : '';
    if (me.sites && me.sites.length > 1) {
      var pick = $('sitePick');
      pick.innerHTML = '';
      me.sites.forEach(function (s) { var o = el('option', null, s.name || s.url || 'Site'); o.value = s.site_id; pick.appendChild(o); });
      pick.value = site.site_id;
      pick.hidden = false;
      $('siteName').hidden = true;
    }
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
    if (hasModule('chat')) { listenChat(); loadChats(); schedulePoll(); }
    nativeReady();
    if (nativeLink) { var l = nativeLink; nativeLink = null; openLink(l); }
  }

  boot();
})();
