/* Kanvas One live chat. One line on every site that has it:
 *
 *   <script src="https://kanvas.one/chat.js" data-site="<site id>" data-name="Rowan & Fig" defer></script>
 *
 * A small button in the corner, a panel, a conversation with the owner
 * who gets it on their phone. The visitor keeps a random token for their
 * thread in localStorage and nothing else; no account, no cookie.
 * Optional: data-color for the button, data-greeting for the first line,
 * data-trigger="#id" to use the site's own button (in its header, say)
 * instead of the corner one, and data-full to open the chat over the
 * whole screen on a phone and as a full-height panel on a desktop.
 * data-edits (Kanvas One's own site only) adds the "Add website edit
 * request" pull button above the box: a signed-in member's message goes in
 * as an edit request (/api/requests) instead of a chat; anyone else is told
 * what it is and how to get it.
 */
(function () {
  'use strict';
  var me = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var site = me && me.getAttribute('data-site');
  if (!site || /\/(admin|dashboard)(\/|$)/.test(location.pathname)) return;
  var base = (me.getAttribute('data-host') || (me.src ? me.src.replace(/\/chat\.js.*$/, '') : '') || 'https://kanvas.one').replace(/\/+$/, '');
  var name = me.getAttribute('data-name') || 'us';
  var color = me.getAttribute('data-color') || '#1d1d1f';
  var greeting = me.getAttribute('data-greeting') || 'Hi! Send us a message and we’ll reply here, or by email or phone if you leave one.';
  var trigger = me.getAttribute('data-trigger') || '';
  var full = me.hasAttribute('data-full');
  var edits = me.hasAttribute('data-edits');
  var KEY = 'k1chat:' + site;

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
  var conv = saved && saved.id && saved.token ? saved : null;
  var lastAt = null;
  var open = false;
  var timer = null;
  var unread = 0;
  var closedByOwner = false;
  var details = { name: null, email: null, phone: null };
  var askedDetails = false;

  /* ---- markup ---- */
  /* Text entry is 16px on purpose: anything smaller makes iOS Safari zoom
     the whole page the moment the box is tapped. */
  var css = '.k1c-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;background:' + color + ';color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit}'
    + '.k1c-btn svg{width:26px;height:26px}.k1c-n{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#e5484d;color:#fff;font:600 12px/20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:center}'
    + '.k1c-launch{position:relative}.k1c-launch .k1c-n{top:-3px;right:-5px;min-width:16px;height:16px;padding:0 4px;font-size:11px;line-height:16px}'
    + '.k1c{position:fixed;right:18px;bottom:86px;z-index:2147483000;width:min(360px,calc(100vw - 36px));max-height:min(560px,calc(100vh - 110px));display:flex;flex-direction:column;background:#fff;color:#1d1d1f;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.24);overflow:hidden;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}'
    + '.k1c[hidden]{display:none}.k1c-head{padding:14px 16px;background:' + color + ';color:#fff;display:flex;justify-content:space-between;align-items:center}.k1c-head b{font-size:15px}.k1c-head small{display:block;opacity:.85;font-size:12.5px}.k1c-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:4px 8px}'
    + '.k1c-msgs{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:8px;min-height:160px;-webkit-overflow-scrolling:touch}'
    + '.k1c-m{max-width:84%;padding:9px 13px;border-radius:16px;white-space:pre-wrap;overflow-wrap:anywhere}.k1c-m.k1c-v{align-self:flex-end;background:' + color + ';color:#fff;border-bottom-right-radius:6px}.k1c-m.k1c-o{align-self:flex-start;background:#f0f0f3;border-bottom-left-radius:6px}.k1c-sys{align-self:center;font-size:12.5px;color:#86868b;text-align:center;padding:2px 10px}'
    + '.k1c-form{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid #eee}.k1c-form textarea{flex:1;resize:none;border:1px solid #d2d2d7;border-radius:12px;padding:9px 12px;font:inherit;font-size:16px;max-height:96px;min-height:42px}.k1c-form textarea:focus{outline:none;border-color:' + color + '}.k1c-send{border:0;border-radius:12px;padding:0 14px;background:' + color + ';color:#fff;font:inherit;font-weight:600;cursor:pointer}'
    + '.k1c-details{padding:10px 12px;border-top:1px solid #eee;background:#fafafa;font-size:13px;color:#6e6e73}.k1c-details p{margin:0 0 8px}.k1c-details input{width:100%;box-sizing:border-box;border:1px solid #d2d2d7;border-radius:10px;padding:8px 10px;font:inherit;font-size:16px;margin-bottom:6px}.k1c-details .k1c-row{display:flex;gap:6px}.k1c-details button{border:0;background:' + color + ';color:#fff;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.k1c-details .k1c-skip{background:none;color:#86868b;font-weight:500}'
    /* data-edits: the pull button that sits on the box, and the card that explains it. */
    + '.k1c-edit{display:flex;justify-content:center;margin:0 0 -1px;padding:6px 12px 0;border-top:1px solid #eee}.k1c-pull{display:inline-flex;align-items:center;gap:6px;border:1px solid #d2d2d7;border-bottom:0;border-radius:12px 12px 0 0;background:#f5f5f7;color:#1d1d1f;font:inherit;font-size:13px;font-weight:600;padding:6px 14px 7px;cursor:pointer;transition:background .2s,color .2s}.k1c-pull:hover{background:#ececf0}.k1c-pull i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#1d1d1f;color:#fff;font-size:13px;line-height:1}'
    + '.k1c.is-edit .k1c-pull{background:#1a7f37;border-color:#1a7f37;color:#fff}.k1c.is-edit .k1c-pull i{background:#fff;color:#1a7f37}.k1c.is-edit .k1c-form{background:#f2faf4;border-top-color:#bfe3c9}.k1c.is-edit .k1c-form textarea{border-color:#8fcfa1}.k1c.is-edit .k1c-send{background:#1a7f37}.k1c-edit + .k1c-form{border-top:1px solid #d2d2d7}'
    + '.k1c-hint{margin:0;padding:8px 14px 0;font-size:12.5px;color:#1a7f37;background:#f2faf4}.k1c-hint[hidden]{display:none}'
    + '.k1c-card{align-self:stretch;border:1px solid #e5e5ea;border-radius:16px;padding:14px;background:#fafafa}.k1c-card b{display:block;font-size:14.5px;margin-bottom:4px}.k1c-card p{margin:0 0 10px;font-size:13.5px;color:#4a4a4f}.k1c-card a{display:inline-block;margin:0 8px 6px 0;padding:8px 13px;border-radius:10px;font-size:13.5px;font-weight:600;text-decoration:none;background:#1d1d1f;color:#fff}.k1c-card a.k1c-ghost{background:none;color:#1d1d1f;border:1px solid #d2d2d7}.k1c-card.k1c-ok{background:#f2faf4;border-color:#bfe3c9}'
    + '@media (max-width:480px){.k1c{right:10px;left:10px;width:auto;bottom:80px}}'
    /* data-full: the whole screen on a phone, a full-height panel on the right elsewhere. */
    + '.k1c-full{top:12px;right:12px;bottom:12px;width:min(420px,calc(100vw - 24px));max-height:none}'
    + '@media (max-width:700px){.k1c-full{top:0;right:0;bottom:0;left:0;width:auto;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}';
  function mount() {
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  /* The site's own button if it named one and it is on this page;
     otherwise the corner button. */
  var btn = trigger ? document.querySelector(trigger) : null;
  if (btn) {
    btn.classList.add('k1c-launch');
    btn.hidden = false;
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Chat with ' + name);
    btn.insertAdjacentHTML('beforeend', '<span class="k1c-n" hidden></span>');
  } else {
    btn = document.createElement('button');
    btn.className = 'k1c-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Chat with ' + name);
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z"/></svg><span class="k1c-n" hidden></span>';
  }
  var panel = document.createElement('div');
  panel.className = 'k1c' + (full ? ' k1c-full' : ''); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with ' + name);
  panel.innerHTML = '<div class="k1c-head"><div><b></b><small>Usually replies quickly</small></div><button class="k1c-x" type="button" aria-label="Close">&times;</button></div>'
    + '<div class="k1c-msgs"></div>'
    + '<div class="k1c-details" hidden><p>Leave an email or number in case you step away, and we’ll reply there too.</p><input type="text" placeholder="Your name" autocomplete="name"><input type="email" placeholder="Email" autocomplete="email" inputmode="email"><input type="tel" placeholder="Mobile" autocomplete="tel" inputmode="tel"><div class="k1c-row"><button type="button" class="k1c-save">Save</button><button type="button" class="k1c-skip">Not now</button></div></div>'
    + (edits ? '<div class="k1c-edit"><button type="button" class="k1c-pull" aria-pressed="false"><i aria-hidden="true">+</i><span>Add website edit request</span></button></div><p class="k1c-hint" hidden>Tell us the change: words, photos, prices or hours. We make it and let you know.</p>' : '')
    + '<form class="k1c-form"><textarea rows="1" placeholder="Write a message" aria-label="Your message" maxlength="2000"></textarea><button class="k1c-send" type="submit">Send</button></form>';
  panel.querySelector('.k1c-head b').textContent = name;
  if (!btn.parentNode) document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('.k1c-msgs');
  var form = panel.querySelector('.k1c-form');
  var input = panel.querySelector('textarea');
  var badge = btn.querySelector('.k1c-n');
  var detailsBox = panel.querySelector('.k1c-details');

  function sys(text) { var d = document.createElement('div'); d.className = 'k1c-sys'; d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; }
  function add(m) {
    var d = document.createElement('div'); d.className = 'k1c-m ' + (m.author === 'visitor' ? 'k1c-v' : 'k1c-o'); d.textContent = m.body; d.dataset.id = m.id;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    if (m.at && (!lastAt || m.at > lastAt)) lastAt = m.at;
  }
  /* The beacon's id for this tab, when the visitor is being counted, so
     the owner's numbers can tie this chat to the visit. */
  function visitSession() {
    try { return (window.k1 && window.k1.session && window.k1.session()) || sessionStorage.getItem('k1s') || null; } catch (e) { return null; }
  }
  function post(payload) {
    return fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not send that.'); return d; }); });
  }

  function showDetails() {
    if (askedDetails || (details.email || details.phone)) return;
    askedDetails = true;
    detailsBox.hidden = false;
  }
  panel.querySelector('.k1c-save').addEventListener('click', function () {
    var ins = detailsBox.querySelectorAll('input');
    var d = { name: ins[0].value, email: ins[1].value, phone: ins[2].value };
    detailsBox.hidden = true;
    if (!conv) { details = d; return; }
    post({ action: 'details', conversation_id: conv.id, token: conv.token, name: d.name, email: d.email, phone: d.phone })
      .then(function (r) { details = { name: r.name, email: r.email, phone: r.phone }; if (r.email || r.phone) sys('Thanks. We’ll reply here' + (r.email ? ', or by email' : '') + (r.phone ? ', or by phone' : '') + ' if you’ve gone.'); })
      .catch(function () {});
  });
  panel.querySelector('.k1c-skip').addEventListener('click', function () { detailsBox.hidden = true; });

  function poll() {
    if (!conv) return Promise.resolve();
    return post({ action: 'poll', conversation_id: conv.id, token: conv.token, after: lastAt })
      .then(function (r) {
        (r.messages || []).forEach(function (m) {
          if (msgs.querySelector('[data-id="' + m.id + '"]')) return;
          add(m);
          if (m.author === 'owner' && !open) { unread++; badge.textContent = String(unread); badge.hidden = false; }
        });
        details = { name: r.name, email: r.email, phone: r.phone };
        if (r.blocked && !closedByOwner) { closedByOwner = true; sys('This chat has been closed.'); form.hidden = true; }
      })
      .catch(function (err) { if (/not here/.test(err.message)) { conv = null; try { localStorage.removeItem(KEY); } catch (e) {} } });
  }
  function schedule() {
    clearTimeout(timer);
    if (!conv) return;
    timer = setTimeout(function () { poll().then(schedule); }, open ? 4000 : 20000);
  }

  function setOpen(next) {
    open = next;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    // Full screen on a phone: the page behind must not scroll instead.
    if (full && window.innerWidth <= 700) document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) { unread = 0; badge.hidden = true; input.focus(); msgs.scrollTop = msgs.scrollHeight; if (conv) poll().then(schedule); }
    else schedule();
  }
  btn.addEventListener('click', function () { setOpen(!open); });
  panel.querySelector('.k1c-x').addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });

  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(96, input.scrollHeight) + 'px'; });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (text.length < 2) return;
    if (editMode) { sendEdit(text); return; }
    input.value = ''; input.style.height = 'auto';
    var sendBtn = form.querySelector('.k1c-send'); sendBtn.disabled = true;
    var p = conv
      ? post({ action: 'send', conversation_id: conv.id, token: conv.token, body: text })
      : post({ action: 'start', site: site, body: text, page: location.pathname, name: details.name, email: details.email, phone: details.phone, session: visitSession() }).then(function (r) {
          conv = { id: r.conversation_id, token: r.token };
          try { localStorage.setItem(KEY, JSON.stringify(conv)); } catch (er) {}
          return r;
        });
    p.then(function (r) { add(r.message); showDetails(); schedule(); })
     .catch(function (err) { input.value = text; sys(err.message); })
     .then(function () { sendBtn.disabled = false; });
  });

  /* ---- website edit requests (data-edits) ----
     The pull button flips the box between a chat and an edit request. A
     member's request goes to /api/requests with their own login, the same
     way the Requests page sends one, so it lands in the same queue. Anyone
     signed out gets a card saying what it is, rather than a dead button. */
  var editMode = false;
  var pull = panel.querySelector('.k1c-pull');
  var hint = panel.querySelector('.k1c-hint');
  function card(title, text, links, ok) {
    var c = document.createElement('div');
    c.className = 'k1c-card' + (ok ? ' k1c-ok' : '');
    var b = document.createElement('b'); b.textContent = title; c.appendChild(b);
    var p = document.createElement('p'); p.textContent = text; c.appendChild(p);
    (links || []).forEach(function (l) {
      var a = document.createElement('a'); a.href = l[1]; a.textContent = l[0];
      if (l[2]) a.className = 'k1c-ghost';
      c.appendChild(a);
    });
    msgs.appendChild(c); msgs.scrollTop = msgs.scrollHeight;
  }
  /* The member's login, read from what Supabase keeps in this browser.
     A page that loaded the Supabase client asks it instead, which also
     refreshes a token that has run out. */
  function storedToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^sb-.+-auth-token$/.test(k)) continue;
        var v = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(v)) v = v[0];
        v = (v && (v.currentSession || v)) || null;
        if (v && v.access_token && !(v.expires_at && v.expires_at * 1000 < Date.now())) return v.access_token;
      }
    } catch (er) { /* private mode */ }
    return null;
  }
  function memberToken() {
    var one = window.ONE;
    if (one && one.ready && one.db && one.db.auth) {
      return one.db.auth.getSession().then(function (r) {
        return (r && r.data && r.data.session && r.data.session.access_token) || storedToken();
      }).catch(storedToken);
    }
    return Promise.resolve(storedToken());
  }
  var loginHref = base + '/login.html?next=' + encodeURIComponent(location.pathname + '?k1chat=open');
  function explain() {
    card('Website edits are for members',
      'Once your site is live, send any change here: new photos, prices, opening hours or wording. We make it for you, as often as you like, on every plan.',
      [['Get your site, \u00a39.99 a month', base + '/join'], ['Member? Log in', loginHref, true]]);
  }
  function setEdit(on) {
    editMode = on;
    panel.classList.toggle('is-edit', on);
    pull.setAttribute('aria-pressed', String(on));
    pull.querySelector('i').textContent = on ? '\u00d7' : '+';
    pull.querySelector('span').textContent = on ? 'Website edit request' : 'Add website edit request';
    hint.hidden = !on;
    input.placeholder = on ? 'What should we change?' : 'Write a message';
    form.querySelector('.k1c-send').textContent = on ? 'Send edit' : 'Send';
    input.focus();
  }
  if (pull) pull.addEventListener('click', function () {
    if (editMode) { setEdit(false); return; }
    memberToken().then(function (t) { if (t) setEdit(true); else explain(); });
  });
  function sendEdit(text) {
    var sendBtn = form.querySelector('.k1c-send'); sendBtn.disabled = true;
    memberToken().then(function (t) {
      if (!t) { setEdit(false); input.value = text; explain(); return; }
      input.value = ''; input.style.height = 'auto';
      return fetch(base + '/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ kind: 'edit', body: text, source: 'chat' })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          if (res.status === 200) {
            var mine = document.createElement('div'); mine.className = 'k1c-m k1c-v'; mine.textContent = text; msgs.appendChild(mine);
            card('Edit request sent', 'We\u2019ll make the change and let you know when it\u2019s done.', [['See your requests', base + '/requests.html', true]], true);
            setEdit(false);
            return;
          }
          input.value = text;
          if (res.status === 401) { card('Log in again to send this', 'Your login has timed out. Your message is still in the box.', [['Log in', loginHref]]); return; }
          if (res.d && res.d.code === 'no_plan') {
            card('Edits start with your plan', 'Website edit requests are for members with a live plan. Once you\u2019ve joined, send changes here any time.', [['Get your site, \u00a39.99 a month', base + '/join'], ['Your account', base + '/account.html', true]]);
            setEdit(false);
            return;
          }
          sys((res.d && res.d.error) || 'Could not send that. Try again.');
        });
    }).catch(function () { input.value = text; sys('Could not send that. Try again.'); })
      .then(function () { sendBtn.disabled = false; });
  }

  /* First paint: the greeting, then whatever thread is already here. */
  sys(greeting);
  if (conv) poll().then(schedule);

  /* The owner can open a chat with someone browsing. While the owner is
     in their app watching (the server says so), ask every ten seconds
     whether they have; otherwise only now and then. A chat opened for us
     is claimed and pops up with their message. */
  var pingTimer = null;
  function takeInvite(inv) {
    return post({ action: 'claim', conversation_id: inv.conversation_id, code: inv.code }).then(function (c) {
      conv = { id: c.conversation_id, token: c.token };
      try { localStorage.setItem(KEY, JSON.stringify(conv)); } catch (er) {}
      msgs.innerHTML = ''; lastAt = null; sys(greeting);
      return poll().then(function () { schedule(); setOpen(true); });
    });
  }
  function ping() {
    clearTimeout(pingTimer);
    if (conv) return;
    var s = visitSession();
    if (!s || document.visibilityState === 'hidden') { pingTimer = setTimeout(ping, 30000); return; }
    post({ action: 'ping', site: site, session: s }).then(function (r) {
      if (r.invite) return takeInvite(r.invite);
      pingTimer = setTimeout(ping, r.watch ? 10000 : 90000);
    }).catch(function () { pingTimer = setTimeout(ping, 90000); });
  }
  setTimeout(ping, 1500);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !conv) ping(); });

  /* A link from one of the owner's emails (?k1chat=open) lands the visitor
     straight back in the chat, then tidies the address bar. A chat the
     owner started carries a claim code (&k1claim=<id>.<code>) that is
     swapped, once, for this browser's token to the thread. */
  if (/(^|[?&])k1chat=open(&|$)/.test(location.search)) {
    var cm = /(?:^|[?&])k1claim=([^&]+)/.exec(location.search);
    if (cm) {
      var parts = decodeURIComponent(cm[1]).split('.');
      if (parts.length === 2 && !(conv && conv.id === parts[0])) {
        post({ action: 'claim', conversation_id: parts[0], code: parts[1] }).then(function (r) {
          conv = { id: r.conversation_id, token: r.token };
          try { localStorage.setItem(KEY, JSON.stringify(conv)); } catch (er) {}
          if (r.name) details.name = r.name;
          msgs.innerHTML = ''; lastAt = null; sys(greeting);
          return poll().then(schedule);
        }).catch(function () { sys('That link has already been used. Send a new message below and we will pick it up.'); });
      }
    }
    setOpen(true);
    try {
      var clean = location.search.replace(/(^\?|&)k1claim=[^&]*(&|$)/, function (m, a, b) { return a === '?' && b === '&' ? '?' : a === '?' ? '' : b ? '&' : ''; })
        .replace(/(^\?|&)k1chat=open(&|$)/, function (m, a, b) { return a === '?' && b === '&' ? '?' : a === '?' ? '' : b ? '&' : ''; });
      history.replaceState(null, '', location.pathname + (clean === '?' ? '' : clean) + location.hash);
    } catch (e) { /* stays, harmless */ }
  }
  }

  /* The tag may sit in the head; the button needs a body to live in. */
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
