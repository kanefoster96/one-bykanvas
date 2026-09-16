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

  // Inside the shell the native splash covers the boot, so the page's own
  // splash logo stays out of it: one logo on the way in, not two.
  if (rn) document.documentElement.classList.add('oa-shell');

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

  var TABS = ['Website', 'Dashboard', 'Analytics', 'Payments', 'Chat', 'Support'];

  function showTab(next) {
    if (next === 'Chat' && !hasModule('chat') && !contactsAllowed() && !isStarter()) next = homeTab();
    if (next === 'Website' && !isStarter()) next = homeTab();
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
    if (tab === 'Website') renderWebsite();
    if (tab !== 'Support') clearTimeout(supportTimer);
    if (tab === 'Support' && supportMode === 'chat') showSupportChat();
    if (tab === 'Chat') { if (openConv && !pendingConv) schedulePoll(); else { openConv = null; openContact = null; $('chatThread').hidden = true; $('contactScreen').hidden = true; $('tabChat').classList.remove('is-thread'); $('chatList').hidden = false; if (chatMode === 'contacts') loadContacts(); else loadChats(); } }
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
    if (!(me && me.user && me.user.is_admin)) reqScreen(/^r\//.test(h));
  });

  /* One request open: the Support tab drops its padding and the thread
     takes the whole screen between header and tabs, like a chat. */
  function reqScreen(on) { $('tabSupport').classList.toggle('is-thread', !!on); }

  /* Pull down to refresh, on every tab. From the top of the page (or of
     the thread on screen) a pull past the mark reloads what the tab
     shows; the shell has native bounce off, so this is the only pull.
     The Dashboard frame does its own, inside the frame (kanvas-handoff.js). */
  var pullEl = el('div', 'oa-pull');
  pullEl.appendChild(el('span', 'oa-pull-spin'));
  document.body.appendChild(pullEl);
  var pull = { y0: null, dy: 0, busy: false, target: null };
  var PULL_HOLD = 64;
  function pullDist() { return Math.min(96, pull.dy * 0.5); }
  /* What slides: the message list in a thread, else the visible part of
     the tab (its open section, or the tab itself). */
  function pullTarget(t) {
    var box = t.closest('.oa-thread, .oa-contact-body');
    if (box) return box.scrollTop <= 0 ? box : null;
    if (t.closest('.oa-screen')) return null;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) return null;
    var tabEl = document.querySelector('.oa-tab:not([hidden])');
    if (!tabEl) return null;
    var inner = tabEl.querySelector(':scope > section:not([hidden])');
    return inner || tabEl;
  }
  function movePull(d, animate) {
    var el_ = pull.target;
    if (!el_) return;
    el_.classList.toggle('oa-pulling', !animate);
    el_.classList.toggle('oa-pull-back', !!animate);
    el_.style.transform = d ? 'translateY(' + d + 'px)' : '';
    pullEl.style.top = (pull.top + 14) + 'px';
    pullEl.style.opacity = d ? String(Math.min(1, d / 40)) : '';
    pullEl.classList.toggle('is-on', d > 0);
    if (!pull.busy) pullEl.firstChild.style.transform = 'rotate(' + Math.round(d * 4) + 'deg)';
  }
  document.addEventListener('touchstart', function (e) {
    pull.y0 = null;
    if (pull.busy || e.touches.length !== 1) return;
    var t = e.target;
    if (!t.closest || t.closest('.oa-sheet, .oa-sheet-back, iframe, .oa-via-scroll, .oa-conv-tools')) return;
    var target = pullTarget(t);
    if (!target) return;
    pull.target = target;
    pull.top = target.getBoundingClientRect().top;
    pull.y0 = e.touches[0].clientY; pull.dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (pull.y0 === null) return;
    pull.dy = Math.max(0, e.touches[0].clientY - pull.y0);
    movePull(pullDist(), false);
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (pull.y0 === null) return;
    pull.y0 = null;
    if (pullDist() >= PULL_HOLD) refreshTab(); else settlePull();
  }, { passive: true });
  function settlePull() {
    movePull(0, true);
    var t = pull.target;
    setTimeout(function () { if (t) t.classList.remove('oa-pulling', 'oa-pull-back'); pullEl.classList.remove('is-busy'); pullEl.firstChild.style.transform = ''; pull.busy = false; pull.target = null; }, 300);
  }
  function refreshTab() {
    pull.busy = true;
    pullEl.classList.add('is-busy');
    pullEl.firstChild.style.transform = '';
    movePull(PULL_HOLD, true);
    var work = [];
    try {
      if (tab === 'Analytics') { anCache = {}; work.push(loadAnalytics()); }
      else if (tab === 'Website') work.push(renderWebsite());
      else if (tab === 'Chat') work.push(openContact && openContact.id ? loadContact(openContact.id) : openConv ? openThread(openConv.id) : chatMode === 'contacts' ? loadContacts() : loadChats());
      else if (tab === 'Support' && supportMode === 'chat') work.push(loadSupportChat(true));
      else if (tab === 'Support') {
        if (me && me.user && me.user.is_admin) work.push(adminOpenId && !$('adminThread').hidden ? openAdminThread(adminOpenId) : loadAdminInbox());
        else if (requestsLoaded) window.dispatchEvent(new Event('hashchange')); // requests.js routes again: list or thread
        else loadRequests();
      }
      else if (tab === 'Dashboard') { framedAt = null; renderDashboard(); }
      else if (tab === 'Payments') { /* nothing to fetch yet */ }
      work.push(refreshMe());
    } catch (e) { /* a tab that failed to refresh still settles */ }
    Promise.all(work.map(function (p) { return Promise.resolve(p).catch(function () {}); })).then(function () {
      setTimeout(settlePull, 300);
    });
  }
  /* The bell, the Support badge (requests waiting plus a reply from Kane
     in the chat) and the dot on the chat pill, from the counts in me. */
  function paintUnread() {
    var u = (me && me.unread) || {};
    $('bellDot').hidden = !(u.notifications > 0);
    var n = (u.requests || 0) + (u.support || 0);
    var reqBadge = $('navReqCount');
    reqBadge.textContent = String(n);
    reqBadge.hidden = n === 0;
    $('supportChatDot').hidden = !(u.support > 0) || (tab === 'Support' && supportMode === 'chat');
  }
  /* The badges, without a reboot. */
  async function refreshMe() {
    if (!me) return;
    var fresh = await api({ action: 'me' });
    me.unread = fresh.unread;
    if (fresh.sites) { me.sites = fresh.sites; var cur = fresh.sites.filter(function (s) { return site && s.site_id === site.site_id; })[0]; if (cur) site = cur; }
    paintUnread();
  }

  function hasModule(m) { return !!(site && (site.modules || []).indexOf(m) >= 0); }

  /* Where the app opens: the Dashboard, the first tab, once the site has
     one connected; the numbers until then, rather than an empty screen. */
  function homeTab() { return isStarter() ? 'Website' : site && site.dashboard_url ? 'Dashboard' : 'Analytics'; }

  /* ---------------------------------------------------------- starter -- */

  /* Starter has no dashboard, so its app is three tabs: the website and
     whether it is up, Support for the monthly change, and a chat straight
     to Kane. The other tabs are hidden, not gated. */
  function isStarter() { return !!(me && me.user && !me.user.is_admin && me.user.plan === 'starter'); }
  function applyPlanUi() {
    var s = isStarter();
    $('navSite').hidden = !s;
    $('navDash').hidden = s;
    document.querySelector('.oa-nav-btn[data-tab="Analytics"]').hidden = s;
    document.querySelector('.oa-nav-btn[data-tab="Payments"]').hidden = s;
  }

  async function renderWebsite() {
    var dot = $('siteDot'), title = $('siteStatusTitle'), hint = $('siteStatusHint');
    var url = site && site.url ? String(site.url).replace(/\/+$/, '') : '';
    $('siteUrlText').textContent = url.replace(/^https?:\/\//, '');
    $('siteOpen').hidden = !url;
    $('sitePlanText').textContent = (site && site.plan) || 'Starter';
    $('sitePlanHint').textContent = 'One change a month to what is on your site, fresh with every payment: photos, wording, numbers, hours, prices. Ask for it under Support.';
    dot.className = 'oa-status-dot';
    if (!site) { title.textContent = 'We have not started your site yet.'; hint.textContent = 'It appears here the moment we do.'; return; }
    title.textContent = 'Checking your website…'; hint.textContent = '';
    try {
      var s = await api({ action: 'site_status', site_id: site.site_id });
      if (tab !== 'Website') return;
      if (!s.live) { dot.classList.add('is-building'); title.textContent = 'Your website is being built'; hint.textContent = 'It goes live here the moment it is ready, and you will hear about it.'; }
      else if (s.online) { dot.classList.add('is-on'); title.textContent = 'Your website is online'; hint.textContent = 'Working and reachable. Checked just now' + (s.ms ? ', answered in ' + (s.ms < 1000 ? s.ms + ' ms' : (s.ms / 1000).toFixed(1) + ' s') : '') + '.'; }
      else if (s.online === false) { dot.classList.add('is-off'); title.textContent = 'Your website is not responding'; hint.textContent = 'Checked just now from here. Pull down to check again; if it stays like this, tell Kane in the chat and it will be looked at straight away.'; }
      else { title.textContent = 'No address yet'; hint.textContent = 'Your website address appears here once it is set.'; }
    } catch (err) { title.textContent = 'Could not check just now'; hint.textContent = err.message; }
  }
  $('siteOpen').addEventListener('click', function () { if (site && site.url) openExternal(site.url); });
  $('siteRequest').addEventListener('click', function () { location.hash = '#new'; showTab('Support'); });
  $('siteChat').addEventListener('click', function () { showTab('Support'); setSupportMode('chat'); });

  /* The chat with Kane, on the Support tab for every business: the
     customer's side of a conversation on kanvas.one's own site, polled
     while it is on screen. Kane's replies arrive as app notifications. */
  var supportTimer = null, supportCount = -1, supportMode = 'requests';
  function setSupportMode(m) {
    supportMode = m;
    $('supportMode').querySelectorAll('.oa-pill').forEach(function (p) { var on = p.dataset.mode === m; p.classList.toggle('is-on', on); p.setAttribute('aria-selected', String(on)); });
    if (m === 'chat') showSupportChat();
    else { clearTimeout(supportTimer); $('supportChat').hidden = true; reqScreen(/^#r\//.test(location.hash) || !$('adminThread').hidden); }
  }
  function showSupportChat() {
    $('supportChat').hidden = false;
    reqScreen(true);
    $('supportChatDot').hidden = true;
    loadSupportChat();
  }
  $('supportMode').addEventListener('click', function (e) { var p = e.target.closest('.oa-pill'); if (p) setSupportMode(p.dataset.mode); });
  function supportBubble(m) {
    var mine = m.author === 'visitor';
    var wrap = el('div', 'msg ' + (mine ? 'from-owner' : 'from-visitor'));
    wrap.appendChild(el('div', 'msg-who', mine ? 'You' : 'Kane'));
    var box = el('div', 'msg-body');
    String(m.body).split(/\n{2,}/).forEach(function (p) {
      var para = el('p');
      p.split('\n').forEach(function (line, i) { if (i) para.appendChild(document.createElement('br')); para.appendChild(document.createTextNode(line)); });
      box.appendChild(para);
    });
    wrap.appendChild(box);
    wrap.appendChild(el('div', 'msg-when', ago(m.at)));
    return wrap;
  }
  async function loadSupportChat(quiet) {
    clearTimeout(supportTimer);
    try {
      var res = await api({ action: 'support_get' });
      var msgs = res.messages || [];
      if (msgs.length !== supportCount) {
        supportCount = msgs.length;
        var box = $('supportMsgs'); box.innerHTML = '';
        if (!msgs.length) { var s = el('div', 'msg from-system'); s.appendChild(el('div', 'msg-body', 'Say hello. Kane sees this in his inbox and replies here; if you are not in the app, by email too.')); box.appendChild(s); }
        msgs.forEach(function (m) { box.appendChild(supportBubble(m)); });
        box.scrollTop = box.scrollHeight;
      }
    } catch (err) { if (!quiet) say($('supportNote'), err.message, 'bad'); }
    if (tab === 'Support' && supportMode === 'chat') supportTimer = setTimeout(function () { loadSupportChat(true); }, 8000);
  }
  $('supportBody').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; });
  $('supportForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var ta = $('supportBody'); var text = ta.value.trim();
    if (!text) return;
    $('supportSend').disabled = true;
    try {
      var res = await api({ action: 'support_send', body: text });
      ta.value = ''; ta.style.height = 'auto'; say($('supportNote'), '');
      var box = $('supportMsgs');
      var sys = box.querySelector('.from-system'); if (sys) sys.remove();
      box.appendChild(supportBubble(res.message)); supportCount++;
      box.scrollTop = box.scrollHeight;
    } catch (err) { say($('supportNote'), err.message, 'bad'); }
    $('supportSend').disabled = false;
  });

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
    contacts = []; contactsLoaded = false; openContact = null; $('contactScreen').hidden = true;
    if (chatChannel) { try { ONE.db.removeChannel(chatChannel); } catch (e) {} chatChannel = null; }
    applyChatUi();
    var badge = $('navChatCount'); if (badge) badge.hidden = true;
    if (hasModule('chat')) { listenChat(); loadChats(); }
    showTab(tab === 'Chat' && !hasModule('chat') ? homeTab() : tab);
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
  var dashReveal = null;  // shows the frame once the page inside says it is ready
  window.addEventListener('message', function (e) {
    var frame = $('dashFrame');
    if (e.source === frame.contentWindow && e.data && e.data.kanvas === 'ready' && dashReveal) dashReveal();
  });

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
    // One loading screen: ours, centred, until the dashboard page says it
    // is ready (kanvas-handoff.js posts that; our own admin page too).
    // A page that never says so is shown a few seconds after it loads.
    wrap.classList.remove('is-framed');
    wrap.classList.add('is-loading');
    frame.hidden = true; stub.hidden = false; open.hidden = true;
    hint.textContent = 'Loading your dashboard…';
    var shown = false;
    function reveal() {
      if (shown) return;
      shown = true;
      wrap.classList.remove('is-loading');
      wrap.classList.add('is-framed'); stub.hidden = true; frame.hidden = false;
    }
    dashReveal = reveal;
    api({ action: 'dashboard', site_id: site.site_id, path: target }).then(function (res) {
      framedAt = target;
      frame.onload = function () { setTimeout(reveal, 3000); };
      frame.src = res.url;
    }).catch(function (err) {
      // No handoff: say so and offer the browser, where they log in as usual.
      wrap.classList.remove('is-framed', 'is-loading');
      frame.hidden = true; stub.hidden = false;
      hint.textContent = 'Could not open your dashboard here just now (' + err.message + '). It still opens in your browser.';
      open.hidden = false; open.href = site.dashboard_url;
    });
  }

  /* Where a notification points. Chat opens natively; everything else is
     a place in the dashboard. */
  function openLink(n) {
    var link = n.deep_link || null;
    if (link && link.kind === 'support_chat') { showTab('Support'); setSupportMode('chat'); return; }
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

  function list(id, rows, keyName, nName, empty, label) {
    var ol = $(id);
    ol.innerHTML = '';
    if (!rows.length) { ol.appendChild(el('li', 'oa-list-empty', empty)); return; }
    var max = rows[0][nName] || 1;
    rows.forEach(function (r) {
      var li = el('li');
      li.appendChild(el('span', 'oa-list-key', label ? label(r[keyName]) : r[keyName]));
      var bar = el('span', 'oa-list-bar');
      bar.style.width = Math.max(6, Math.round((r[nName] / max) * 60)) + 'px';
      li.appendChild(bar);
      li.appendChild(el('span', 'oa-list-n', fmt(r[nName])));
      ol.appendChild(li);
    });
  }

  /* Money as a person says it: £1,240, or £12.50 when the pence matter. */
  function pounds(pence, currency) {
    var sym = { gbp: '£', usd: '$', eur: '€' }[String(currency || 'gbp').toLowerCase()] || '';
    var n = Number(pence || 0) / 100;
    return sym + n.toLocaleString('en-GB', { minimumFractionDigits: n < 100 && n % 1 ? 2 : 0, maximumFractionDigits: n < 100 && n % 1 ? 2 : 0 });
  }
  function pct(part, whole) { return whole ? (part / whole < 0.01 && part ? '<1' : Math.round((part / whole) * 100)) + '%' : '0%'; }
  var countryNames = (typeof Intl !== 'undefined' && Intl.DisplayNames) ? new Intl.DisplayNames(['en-GB'], { type: 'region' }) : null;
  function countryName(code) { try { return (countryNames && countryNames.of(code)) || code; } catch (e) { return code; } }

  /* Three bars, each as wide as its share of the visitors. */
  function drawFunnel(f, hasChat, hasPay) {
    var box = $('anFunnel');
    box.innerHTML = '';
    var rows = [['Visited', f.visitors]];
    if (hasChat) rows.push(['Messaged', f.messaged]);
    if (hasPay) rows.push(['Paid', f.paid]);
    var max = f.visitors || 1;
    rows.forEach(function (r) {
      var row = el('div', 'oa-funnel-row');
      row.appendChild(el('span', 'oa-funnel-label', r[0]));
      var track = el('span', 'oa-funnel-track');
      var bar = el('span', 'oa-funnel-bar');
      bar.style.width = (r[1] ? Math.max(2, (r[1] / max) * 100) : 0) + '%';
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(el('span', 'oa-funnel-n', fmt(r[1])));
      box.appendChild(row);
    });
    var bits = [];
    if (hasPay) bits.push(f.visitors ? pct(f.paid, f.visitors) + ' of visitors paid.' : 'No visitors yet.');
    if (hasChat && hasPay) bits.push(f.messaged ? f.messaged_and_paid + ' of the ' + f.messaged + ' who messaged went on to pay.' : 'Nobody has messaged yet.');
    else if (hasChat) bits.push(f.visitors ? pct(f.messaged, f.visitors) + ' of visitors sent a message.' : '');
    $('anFunnelNote').textContent = bits.join(' ');
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
    delta($('anVisitorsDelta'), d.visitors, d.previous.visitors);
    delta($('anViewsDelta'), d.views, d.previous.views);
    $('anOnline').textContent = fmt(d.online_now);
    $('anOnlineNote').textContent = d.online_now ? 'in the last 5 minutes' : 'nobody right now';

    // The fourth tile is the one that matters most on this site.
    var j = d.journeys || { pages_per_visit: 0, top: [], one_page_pct: 0 };
    if (d.money) {
      $('anFourthLabel').textContent = 'Taken';
      $('anFourthN').textContent = pounds(d.money.amount, d.money.currency);
      delta($('anFourthDelta'), d.money.amount, d.money.previous.amount);
    } else if (d.chat) {
      $('anFourthLabel').textContent = 'Conversations';
      $('anFourthN').textContent = fmt(d.chat.conversations);
      delta($('anFourthDelta'), d.chat.conversations, d.chat.previous.conversations);
    } else {
      $('anFourthLabel').textContent = 'Pages a visit';
      $('anFourthN').textContent = String(j.pages_per_visit || 0);
      $('anFourthDelta').textContent = d.visitors ? j.one_page_pct + '% saw one page' : '';
    }

    $('anEmpty').hidden = d.beacon_seen;
    spark(d.series);

    $('anFunnelCard').hidden = !d.funnel;
    if (d.funnel) drawFunnel(d.funnel, !!d.chat, !!d.money);

    $('anMoneyCard').hidden = !d.money;
    $('anMoneyOff').hidden = !!d.money;
    if (d.money) {
      var m = d.money;
      $('anTaken').textContent = pounds(m.amount, m.currency);
      delta($('anTakenDelta'), m.amount, m.previous.amount);
      $('anPayCount').textContent = fmt(m.count);
      delta($('anPayCountDelta'), m.count, m.previous.count);
      $('anPayers').textContent = fmt(m.payers);
      $('anPayAvg').textContent = m.count ? pounds(m.average, m.currency) : '–';
      $('anRefunds').textContent = m.refunds ? m.refunds + ' refunded, ' + pounds(m.refunded, m.currency) : '';
      $('anMoneyNote').textContent = m.count ? '' : 'No payments in this period yet.';
    }

    $('anChatCard').hidden = !d.chat;
    $('anChatOff').hidden = !!d.chat;
    if (d.chat) {
      $('anConvs').textContent = fmt(d.chat.conversations);
      delta($('anConvsDelta'), d.chat.conversations, d.chat.previous.conversations);
      var f = d.funnel || { messaged: 0, messaged_and_paid: 0 };
      $('anConvsPaid').textContent = d.money ? fmt(f.messaged_and_paid) : '–';
      $('anConvsPaidNote').textContent = d.money ? (f.messaged ? pct(f.messaged_and_paid, f.messaged) + ' of them' : '') : 'once payments are connected';
    }

    list('anPages', d.pages, 'path', 'views', 'No pages viewed yet.', pageName);
    var jl = $('anJourneys');
    jl.innerHTML = '';
    if (!j.top.length) jl.appendChild(el('li', 'oa-list-empty', d.visitors ? 'Every visit so far stayed on one page.' : 'Nothing yet.'));
    j.top.forEach(function (r) {
      var li = el('li');
      var steps = el('span', 'oa-list-key oa-journey');
      r.steps.forEach(function (s, i) { if (i) steps.appendChild(el('i', 'oa-journey-arrow', '→')); steps.appendChild(el('span', '', pageName(s))); });
      li.appendChild(steps);
      li.appendChild(el('span', 'oa-list-n', fmt(r.visitors)));
      jl.appendChild(li);
    });
    $('anJourneysNote').textContent = d.visitors ? 'About ' + j.pages_per_visit + ' pages a visit. ' + j.one_page_pct + '% of visits saw one page and left.' : '';
    list('anRefs', d.referrers, 'host', 'visitors', d.visitors ? 'Everyone typed your address or came from Google with no referrer.' : 'Nothing yet.');
    list('anCountries', d.countries || [], 'country', 'visitors', 'Nothing yet.', countryName);
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
      body.appendChild(el('p', 'oa-conv-preview', (c.last_by === 'owner' ? 'You: ' : '') + (c.preview || (c.via_app ? 'From their One app' : c.page ? 'Visited ' + pageName(c.page) : ''))));
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
    bar.hidden = !here.length || tab !== 'Chat' || !!openConv || chatMode !== 'inbox' || !!openContact;
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
    renderReplyBar(c);
  }

  /* How a reply goes out: Live chat or Email, chosen by the owner, with
     the sensible one picked first. Someone on the site now gets live
     chat; someone who has gone and left an address gets email (and a
     live-chat reply to them is emailed anyway, so nothing is lost);
     someone who has gone and left nothing can only be reached in the
     chat when they return. Text and WhatsApp threads take no typed
     replies: texts are for automations only. */
  var via = 'chat';
  function setVia(v) {
    via = v;
    document.querySelectorAll('.oa-via-btn').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.via === v)); });
    if (openConv) viaHint(openConv);
  }
  document.querySelectorAll('.oa-via-btn').forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) setVia(b.dataset.via); }); });
  function viaHint(c) {
    var off = $('chatOffline');
    if (c.online) off.textContent = via === 'email' ? 'They’re on your site now, so live chat reaches them straight away. Email works too.' : 'They’re on your site now.';
    else if (c.email) off.textContent = via === 'email' ? 'They’ve left the site. They get your reply by email, with a link back to the chat, and can reply to the email.'
      : 'They’ve left the site, so a live chat reply is emailed to them as well.';
    else off.textContent = 'They’ve left the site and didn’t leave an email address. They’ll see your reply if they come back.' + (c.phone ? ' They left a number, so a call might be quickest.' : '');
  }
  function renderReplyBar(c) {
    var chan = c.channel || 'web';
    var form = $('chatForm'), row = $('chatViaRow'), none = $('chatNoReply');
    if (c.blocked) { form.hidden = true; row.hidden = true; none.hidden = false; none.textContent = 'This visitor is blocked. Unblock them to reply.'; return; }
    if (chan !== 'web') {
      form.hidden = true; row.hidden = true; none.hidden = false;
      none.textContent = (chan === 'whatsapp' ? 'WhatsApp' : 'Text') + ' threads take no typed replies: texts are automated only, to keep costs down. Call them back' + (c.email ? ', or email them.' : '.');
      return;
    }
    if (c.via_app) {
      // A business, from their One app: the reply reaches them as a notification there.
      form.hidden = false; row.hidden = true; none.hidden = false; via = 'chat';
      none.textContent = 'A Kanvas One customer, writing from their app. Your reply reaches them as a notification in the app' + (c.online ? '; they are in it now.' : '.');
      $('chatBody').placeholder = 'Write a reply';
      return;
    }
    form.hidden = false; none.hidden = true; row.hidden = false;
    $('chatBody').placeholder = 'Write a reply';
    var emailBtn = document.querySelector('.oa-via-btn[data-via="email"]');
    emailBtn.disabled = !c.email;
    emailBtn.title = c.email ? 'To ' + c.email : 'They did not leave an email address';
    setVia(c.online || !c.email ? 'chat' : 'email');
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
      var r = await api({ action: 'chat_reply', site_id: site.site_id, conversation_id: openConv.id, body: text, via: via });
      ta.value = ''; ta.style.height = 'auto';
      $('chatMsgs').appendChild(chatBubble(r.message));
      openConv = r.conversation;
      var emailed = r.delivered.indexOf('email') >= 0;
      say($('chatNote'), via === 'email' && emailed ? 'Emailed to them, with a link back to the chat. They can reply to the email too.'
        : emailed ? 'Sent. They’ve left the site, so it went by email as well.'
        : r.online === false && !openConv.email ? 'Sent. They’ll see it when they come back.' : '', 'ok');
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
    reqScreen(false);
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
    reqScreen(true);
    $('aThread').innerHTML = '';
    say($('aNote'), '');
    setAdminMode('waiting');
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
      box.scrollTop = box.scrollHeight;
    } catch (err) { say($('aNote'), err.message, 'bad'); }
  }
  $('adminBack').addEventListener('click', loadAdminInbox);

  /* What a note does: a plain reply, a status change with it, or a note
     only I see. A pill row above the reply box, like Live chat / Email. */
  var adminMode = 'waiting';
  function setAdminMode(m) {
    adminMode = m;
    $('aModes').querySelectorAll('.oa-via-btn').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mode === m)); });
    $('aBody').placeholder = m === 'private' ? 'A note just for you' : m === 'done' ? 'Tell them it is live' : 'Write a reply';
  }
  $('aModes').addEventListener('click', function (e) {
    var b = e.target.closest('.oa-via-btn');
    if (b) setAdminMode(b.dataset.mode);
  });
  $('aBody').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; });
  $('aForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!adminOpenId) return;
    var ta = $('aBody');
    var text = ta.value.trim();
    if (!text) return;
    var mode = adminMode;
    var payload = { action: 'addRequestNote', requestId: adminOpenId, body: text };
    if (mode === 'private') payload.isPrivate = true; else payload.status = mode;
    $('aSend').disabled = true;
    try {
      var r = await apiTo('/api/admin', payload);
      ta.value = ''; ta.style.height = 'auto';
      $('aThread').appendChild(noteBubble(Object.assign({ author: 'admin', private: mode === 'private' }, r.note)));
      if (r.request) { $('aStatus').textContent = STATUS_WORD[r.request.status] || 'Open'; $('aStatus').className = 'req-state ' + (STATUS_CLASS[r.request.status] || ''); }
      say($('aNote'), mode === 'private' ? 'Noted, just for you.' : 'Sent. They get it on their phone and by email.', 'ok');
      $('aThread').scrollTop = $('aThread').scrollHeight;
      if (mode !== 'waiting') setAdminMode('waiting');
    } catch (err) { say($('aNote'), err.message, 'bad'); }
    $('aSend').disabled = false;
  });

  function loadRequests() {
    if (me && me.user && me.user.is_admin) { if (pendingRequest || $('adminThread').hidden) loadAdminInbox(); return; }
    reqScreen(/^#r\//.test(location.hash));
    if (requestsLoaded) {
      if (ONE.refreshRequestBadge) ONE.refreshRequestBadge();
      // Coming back after another tab cleared the hash: route to the list.
      if (!location.hash && $('viewDetail') && !$('viewDetail').hidden) window.dispatchEvent(new Event('hashchange'));
      return;
    }
    requestsLoaded = true;
    var base = native ? BASE + '/' : '../';
    [base + 'requests-badge.js?v=1', base + 'requests.js?v=5'].forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      document.body.appendChild(s);
    });
  }

  /* --------------------------------------------------------- contacts -- */

  /* Everyone the site has dealt with, beside the inbox: filled from chats,
     enquiries and payments on the server, plus anyone added by hand. Each
     has details, Call / Email / Chat, and dated notes. Business and above;
     a site without live chat still gets them, under that name. */
  var contacts = [], contactsLoaded = false, contactFilter = '', openContact = null, chatMode = 'inbox', contactsDirty = false;
  var SOURCE_WORD = { chat: 'From live chat', enquiry: 'From an enquiry', payment: 'Paid on your site', manual: 'Added by you' };
  function contactsAllowed() { return !!site && site.plan !== 'Starter'; }

  function applyChatUi() {
    if (isStarter()) { $('navChat').hidden = true; return; }
    var chat = hasModule('chat'), people = contactsAllowed();
    $('navChat').hidden = !(chat || people);
    $('navChat').querySelector('span:not(.nav-count)').textContent = chat ? 'Chat' : 'Contacts';
    $('chatMode').hidden = !(chat && people);
    setChatMode(!chat ? 'contacts' : (people && chatMode === 'contacts') ? 'contacts' : 'inbox', true);
  }
  function setChatMode(m, quiet) {
    chatMode = m;
    $('chatMode').querySelectorAll('.oa-pill').forEach(function (p) { var on = p.dataset.mode === m; p.classList.toggle('is-on', on); p.setAttribute('aria-selected', String(on)); });
    $('inboxView').hidden = m !== 'inbox';
    $('contactsView').hidden = m !== 'contacts';
    $('chatHeading').textContent = m === 'inbox' ? 'Inbox' : 'Contacts';
    renderOnlineBar();
    if (m === 'contacts' && !quiet && !contactsLoaded) loadContacts();
  }
  $('chatMode').addEventListener('click', function (e) { var p = e.target.closest('.oa-pill'); if (p) setChatMode(p.dataset.mode); });

  function contactName(c) { return c.name || c.email || c.phone || 'Contact'; }
  function contactAvatar(c) {
    var av = el('span', 'oa-avatar');
    if (c.name) {
      av.textContent = initials(c.name);
      var n = 0; String(c.id || '').split('').forEach(function (ch) { n = (n + ch.charCodeAt(0)) % 9973; });
      av.style.background = AVATAR_COLOURS[n % AVATAR_COLOURS.length];
    } else {
      av.classList.add('is-anon');
      av.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>';
    }
    return av;
  }

  $('contactSearch').addEventListener('input', function () { contactFilter = this.value.trim().toLowerCase(); renderContacts(); });
  function renderContacts() {
    var ul = $('contactList');
    ul.innerHTML = '';
    var rows = contacts;
    if (contactFilter) rows = contacts.filter(function (c) { return [c.name, c.email, c.phone, c.company, c.address].join(' ').toLowerCase().indexOf(contactFilter) >= 0; });
    $('contactEmpty').hidden = contacts.length > 0;
    $('contactCount').textContent = contacts.length ? contacts.length + (contacts.length === 1 ? ' person' : ' people') : '';
    if (contacts.length && !rows.length) ul.appendChild(el('li', 'oa-list-none', 'Nobody matches.'));
    rows.forEach(function (c) {
      var li = el('li');
      li.appendChild(contactAvatar(c));
      var body = el('div', 'oa-conv-body');
      var top = el('div', 'oa-conv-top');
      top.appendChild(el('p', 'oa-conv-name', contactName(c)));
      top.appendChild(el('span', 'oa-conv-when', whenText(c.last_seen_at)));
      body.appendChild(top);
      var name = contactName(c);
      var sub = [c.company, c.phone, c.email].filter(function (v) { return v && v !== name; }).join(' · ');
      body.appendChild(el('p', 'oa-contact-sub', sub || (c.notes ? c.notes + (c.notes === 1 ? ' note' : ' notes') : SOURCE_WORD[c.source] || '')));
      li.appendChild(body);
      li.addEventListener('click', function () { openContactScreen(c); });
      ul.appendChild(li);
    });
  }
  async function loadContacts() {
    if (!site) return;
    try {
      var res = await api({ action: 'contacts_list', site_id: site.site_id });
      contacts = res.contacts || []; contactsLoaded = true;
      renderContacts();
    } catch (err) { $('contactEmpty').hidden = false; $('contactEmpty').textContent = err.message; }
  }

  function fillContactForm(c) {
    $('cfName').value = c.name || ''; $('cfPhone').value = c.phone || ''; $('cfEmail').value = c.email || '';
    $('cfAddress').value = c.address || ''; $('cfCompany').value = c.company || '';
  }
  function renderContactHead(c) {
    $('contactTitle').textContent = contactName(c);
    var av = contactAvatar(c); av.id = 'contactAvatar'; $('contactAvatar').replaceWith(av);
    var since = c.first_seen_at ? new Date(c.first_seen_at) : null;
    $('contactMeta').textContent = [SOURCE_WORD[c.source], since && !isNaN(since) ? 'since ' + since.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null].filter(Boolean).join(' · ');
    $('contactCall').hidden = !c.phone; $('contactCall').href = 'tel:' + String(c.phone || '').replace(/[^\d+]/g, '');
    $('contactMail').hidden = !c.email; $('contactMail').href = 'mailto:' + (c.email || '');
    $('contactMap').hidden = !c.address; $('contactMap').href = 'https://maps.apple.com/?q=' + encodeURIComponent(c.address || '');
    $('contactChat').hidden = !hasModule('chat');
  }
  function showContactExtras(on) { $('contactNotesCard').hidden = !on; $('contactTools').hidden = !on; $('contactDelete').hidden = !on; }

  function openContactScreen(c) {
    openContact = c ? Object.assign({}, c) : { id: null };
    $('chatList').hidden = true; $('chatThread').hidden = true;
    $('contactScreen').hidden = false;
    $('tabChat').classList.add('is-thread');
    $('onlineBar').hidden = true;
    fillContactForm(openContact);
    say($('contactNote'), ''); say($('noteNote'), '');
    $('noteList').innerHTML = ''; $('contactConvs').innerHTML = '';
    $('contactHistory').hidden = true;
    showContactExtras(!!openContact.id);
    $('contactScreen').querySelector('.oa-contact-body').scrollTop = 0;
    if (openContact.id) { renderContactHead(openContact); loadContact(openContact.id); }
    else {
      $('contactTitle').textContent = 'New contact';
      $('contactMeta').textContent = 'A name, a phone, an email: whatever you have.';
      var av = contactAvatar({}); av.id = 'contactAvatar'; $('contactAvatar').replaceWith(av);
      setTimeout(function () { $('cfName').focus(); }, 60);
    }
  }
  async function loadContact(id) {
    try {
      var res = await api({ action: 'contact_get', site_id: site.site_id, contact_id: id });
      if (!openContact || openContact.id !== id) return;
      openContact = res.contact;
      fillContactForm(openContact); renderContactHead(openContact); showContactExtras(true);
      renderNotes(res.notes || []);
      renderContactHistory(res);
    } catch (err) { say($('contactNote'), err.message, 'bad'); }
  }
  function renderContactHistory(res) {
    var convs = res.conversations || [], pays = res.payments || { count: 0 };
    var bits = [];
    if (pays.count) bits.push(pays.count + (pays.count === 1 ? ' payment, ' : ' payments, ') + pounds(pays.amount, 'gbp') + (pays.last_at ? ', last ' + ago(pays.last_at) : ''));
    if (convs.length) bits.push(convs.length + (convs.length === 1 ? ' conversation' : ' conversations'));
    $('contactHistory').hidden = !bits.length;
    $('contactHistoryText').textContent = bits.length ? bits.join('. ') + '.' : '';
    var ul = $('contactConvs'); ul.innerHTML = '';
    convs.slice(0, 5).forEach(function (c) {
      var li = el('li');
      li.appendChild(el('span', 'oa-list-key', (c.channel === 'sms' ? 'Text · ' : c.channel === 'whatsapp' ? 'WhatsApp · ' : '') + (c.preview || 'Conversation')));
      li.appendChild(el('span', 'oa-list-n', whenText(c.last_at)));
      li.addEventListener('click', function () { goToThread(c.id); });
      ul.appendChild(li);
    });
  }
  function closeContactScreen(keepThread) {
    openContact = null;
    $('contactScreen').hidden = true;
    if (!keepThread) { $('tabChat').classList.remove('is-thread'); $('chatList').hidden = false; renderOnlineBar(); }
    if (contactsDirty) { contactsDirty = false; loadContacts(); }
  }
  function goToThread(id) { closeContactScreen(true); setChatMode('inbox', true); return openThread(id); }
  $('contactBack').addEventListener('click', function () { closeContactScreen(false); });
  $('contactAdd').addEventListener('click', function () { openContactScreen(null); });

  $('contactForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!openContact) return;
    var btn = $('contactSave'); btn.disabled = true; say($('contactNote'), 'Saving…');
    try {
      var res = await api({ action: 'contact_save', site_id: site.site_id, contact: { id: openContact.id, name: $('cfName').value, phone: $('cfPhone').value, email: $('cfEmail').value, address: $('cfAddress').value, company: $('cfCompany').value } });
      var wasNew = !openContact.id;
      openContact = res.contact; contactsDirty = true;
      fillContactForm(openContact); renderContactHead(openContact); showContactExtras(true);
      if (wasNew) renderNotes([]);
      say($('contactNote'), wasNew ? 'Added.' : 'Saved.', 'ok');
    } catch (err) { say($('contactNote'), err.message, 'bad'); }
    btn.disabled = false;
  });
  $('contactDelete').addEventListener('click', async function () {
    if (!openContact || !openContact.id) return;
    if (!confirm('Delete ' + contactName(openContact) + ' and their notes? Their chats stay in the inbox.')) return;
    try { await api({ action: 'contact_delete', site_id: site.site_id, contact_id: openContact.id }); contactsDirty = true; closeContactScreen(false); }
    catch (err) { say($('contactNote'), err.message, 'bad'); }
  });

  function renderNotes(notes) {
    var ul = $('noteList'); ul.innerHTML = '';
    if (!notes.length) { ul.appendChild(el('li', 'oa-list-empty', 'No notes yet. The kind of thing you would otherwise keep in your head.')); return; }
    notes.forEach(function (n) { ul.appendChild(noteRow(n)); });
  }
  function noteRow(n) {
    var li = el('li'); li.dataset.id = n.id;
    li.appendChild(el('p', 'oa-note-body', n.body));
    var foot = el('div', 'oa-note-foot');
    var d = new Date(n.at);
    foot.appendChild(el('span', '', d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })));
    var del = el('button', 'linkish', 'Delete'); del.type = 'button';
    del.addEventListener('click', async function () {
      if (!confirm('Delete this note?')) return;
      try {
        await api({ action: 'contact_note_delete', site_id: site.site_id, note_id: n.id });
        li.remove(); contactsDirty = true;
        if (!$('noteList').children.length) renderNotes([]);
      } catch (err) { say($('noteNote'), err.message, 'bad'); }
    });
    foot.appendChild(del);
    li.appendChild(foot);
    return li;
  }
  $('noteBody').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(160, this.scrollHeight) + 'px'; });
  $('noteForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!openContact || !openContact.id) return;
    var ta = $('noteBody'); var text = ta.value.trim();
    if (!text) return;
    $('noteAdd').disabled = true;
    try {
      var res = await api({ action: 'contact_note_add', site_id: site.site_id, contact_id: openContact.id, body: text });
      ta.value = ''; ta.style.height = 'auto'; say($('noteNote'), '');
      var ul = $('noteList'); var empty = ul.querySelector('.oa-list-empty'); if (empty) empty.remove();
      ul.insertBefore(noteRow(res.note), ul.firstChild);
      contactsDirty = true;
    } catch (err) { say($('noteNote'), err.message, 'bad'); }
    $('noteAdd').disabled = false;
  });

  /* Chat with them: their thread if they have one, else a new one. The
     first message of a new one goes by email with a link that carries the
     thread on in the chat on the site. */
  $('contactChat').addEventListener('click', async function () {
    if (!openContact || !openContact.id) return;
    var btn = this; btn.disabled = true;
    try {
      var res = await api({ action: 'contact_chat', site_id: site.site_id, contact_id: openContact.id });
      await goToThread(res.conversation_id);
      if (res.created) say($('chatNote'), 'A new chat. Your first message goes to them by email, with a link to carry it on in the chat on your site.', 'ok');
    } catch (err) { say($('contactNote'), err.message, 'bad'); }
    btn.disabled = false;
  });

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
  /* Deleting the account, from inside the app, as both stores require.
     Two confirmations, then the server cancels the plan and removes the
     login and everything hanging off it. */
  $('deleteBtn').addEventListener('click', async function () {
    var note = $('deleteNote');
    if (!confirm('Delete your account? Your login, your site’s records, requests and chats are removed for good, and any plan is cancelled. This cannot be undone.')) return;
    if (!confirm('Last check: delete the account for ' + ((me && me.user && me.user.email) || 'this login') + '?')) return;
    this.disabled = true;
    say(note, 'Deleting…');
    try {
      await api({ action: 'delete_account' });
      try { await ONE.db.auth.signOut({ scope: 'local' }); } catch (e) { /* the login is already gone */ }
      if (window.ONE_SESSION) await ONE_SESSION.logOut();
      alert('Your account has been deleted.');
      location.hash = '';
      location.reload();
    } catch (err) { say(note, err.message, 'bad'); this.disabled = false; }
  });

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
      // Ask what is unread rather than assume: a resume with nothing new
      // must not light the bell.
      refreshMe().catch(function () {});
      if (tab === 'Support' && supportMode === 'chat') loadSupportChat(true);
      if (isStarter()) return;
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
    $('deleteWrap').hidden = !!me.user.is_admin;
    applyPlanUi();
    applyChatUi();
    paintUnread();
    seenAt = Date.now() - 1; // what is unread now stays highlighted until the sheet opens

    loading.hidden = true;
    app.hidden = false;

    var h = location.hash.replace(/^#/, '');
    $('supportModeWrap').hidden = !!me.user.is_admin;
    // A business arriving from one of Kane's emails lands in the chat with him.
    if (!me.user.is_admin && /k1chat=open/.test(location.search)) { showTab('Support'); setSupportMode('chat'); }
    else showTab(/^(new|r\/)/.test(h) ? 'Support' : homeTab());
    setupPush();
    if (hasModule('chat')) { listenChat(); loadChats(); schedulePoll(); }
    nativeReady();
    if (nativeLink) { var l = nativeLink; nativeLink = null; openLink(l); }
  }

  boot();
})();
