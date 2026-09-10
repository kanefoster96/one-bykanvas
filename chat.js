/* Kanvas One live chat. One line on every site that has it:
 *
 *   <script src="https://kanvas.one/chat.js" data-site="<site id>" data-name="Rowan & Fig" defer></script>
 *
 * A small button in the corner, a panel, a conversation with the owner
 * who gets it on their phone. The visitor keeps a random token for their
 * thread in localStorage and nothing else; no account, no cookie.
 * Optional: data-color for the button, data-greeting for the first line.
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
  var css = '.k1c-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;background:' + color + ';color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit}'
    + '.k1c-btn svg{width:26px;height:26px}.k1c-btn .k1c-n{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#e5484d;color:#fff;font:600 12px/20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:center}'
    + '.k1c{position:fixed;right:18px;bottom:86px;z-index:2147483000;width:min(360px,calc(100vw - 36px));max-height:min(560px,calc(100vh - 110px));display:flex;flex-direction:column;background:#fff;color:#1d1d1f;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.24);overflow:hidden;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}'
    + '.k1c[hidden]{display:none}.k1c-head{padding:14px 16px;background:' + color + ';color:#fff;display:flex;justify-content:space-between;align-items:center}.k1c-head b{font-size:15px}.k1c-head small{display:block;opacity:.85;font-size:12.5px}.k1c-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}'
    + '.k1c-msgs{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:8px;min-height:160px}'
    + '.k1c-m{max-width:84%;padding:9px 13px;border-radius:16px;white-space:pre-wrap;overflow-wrap:anywhere}.k1c-m.k1c-v{align-self:flex-end;background:' + color + ';color:#fff;border-bottom-right-radius:6px}.k1c-m.k1c-o{align-self:flex-start;background:#f0f0f3;border-bottom-left-radius:6px}.k1c-sys{align-self:center;font-size:12.5px;color:#86868b;text-align:center;padding:2px 10px}'
    + '.k1c-form{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid #eee}.k1c-form textarea{flex:1;resize:none;border:1px solid #d2d2d7;border-radius:12px;padding:9px 12px;font:inherit;max-height:96px;min-height:40px}.k1c-form textarea:focus{outline:none;border-color:' + color + '}.k1c-send{border:0;border-radius:12px;padding:0 14px;background:' + color + ';color:#fff;font:inherit;font-weight:600;cursor:pointer}'
    + '.k1c-details{padding:10px 12px;border-top:1px solid #eee;background:#fafafa;font-size:13px;color:#6e6e73}.k1c-details p{margin:0 0 8px}.k1c-details input{width:100%;box-sizing:border-box;border:1px solid #d2d2d7;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;margin-bottom:6px}.k1c-details .k1c-row{display:flex;gap:6px}.k1c-details button{border:0;background:' + color + ';color:#fff;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.k1c-details .k1c-skip{background:none;color:#86868b;font-weight:500}'
    + '@media (max-width:480px){.k1c{right:10px;left:10px;width:auto;bottom:80px}}';
  function mount() {
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'k1c-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Chat with ' + name);
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z"/></svg><span class="k1c-n" hidden></span>';
  var panel = document.createElement('div');
  panel.className = 'k1c'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with ' + name);
  panel.innerHTML = '<div class="k1c-head"><div><b></b><small>Usually replies quickly</small></div><button class="k1c-x" type="button" aria-label="Close">&times;</button></div>'
    + '<div class="k1c-msgs"></div>'
    + '<div class="k1c-details" hidden><p>Leave an email or number in case you step away, and we’ll reply there too.</p><input type="text" placeholder="Your name" autocomplete="name"><input type="email" placeholder="Email" autocomplete="email" inputmode="email"><input type="tel" placeholder="Mobile" autocomplete="tel" inputmode="tel"><div class="k1c-row"><button type="button" class="k1c-save">Save</button><button type="button" class="k1c-skip">Not now</button></div></div>'
    + '<form class="k1c-form"><textarea rows="1" placeholder="Write a message" aria-label="Your message" maxlength="2000"></textarea><button class="k1c-send" type="submit">Send</button></form>';
  panel.querySelector('.k1c-head b').textContent = name;
  document.body.appendChild(btn); document.body.appendChild(panel);

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
    if (open) { unread = 0; badge.hidden = true; input.focus(); msgs.scrollTop = msgs.scrollHeight; if (conv) poll().then(schedule); }
    else schedule();
  }
  btn.addEventListener('click', function () { setOpen(!open); });
  panel.querySelector('.k1c-x').addEventListener('click', function () { setOpen(false); });

  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(96, input.scrollHeight) + 'px'; });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (text.length < 2) return;
    input.value = ''; input.style.height = 'auto';
    var sendBtn = form.querySelector('.k1c-send'); sendBtn.disabled = true;
    var p = conv
      ? post({ action: 'send', conversation_id: conv.id, token: conv.token, body: text })
      : post({ action: 'start', site: site, body: text, page: location.pathname, name: details.name, email: details.email, phone: details.phone }).then(function (r) {
          conv = { id: r.conversation_id, token: r.token };
          try { localStorage.setItem(KEY, JSON.stringify(conv)); } catch (er) {}
          return r;
        });
    p.then(function (r) { add(r.message); showDetails(); schedule(); })
     .catch(function (err) { input.value = text; sys(err.message); })
     .then(function () { sendBtn.disabled = false; });
  });

  /* First paint: the greeting, then whatever thread is already here. */
  sys(greeting);
  if (conv) poll().then(schedule);
  }

  /* The tag may sit in the head; the button needs a body to live in. */
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
