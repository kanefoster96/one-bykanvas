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
 * what it is and how to get it. The chat is with the team; Dot, the
 * mascot, just leaves a tip for the page you are on at the top of it: a page can hand him its own with
 * window.oneGuide() (join.js, account.js), returning { text, actions },
 * where an action either links (href) or points at a field (target, and
 * an optional click to open what it sits behind first).
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
  /* data-style="sheet": the Kanvas Academy chat. A person, not a brand: their
     photo and name on the header and on their replies, rounded bubbles, a
     round send button, a "who's asking?" card, and (optionally) an intro
     from them with tap-to-ask questions and a one-off teaser card. */
  var sheet = me.getAttribute('data-style') === 'sheet';
  var agent = me.getAttribute('data-agent') || '';
  var avatar = me.getAttribute('data-avatar') || '';
  var subtitle = me.getAttribute('data-subtitle') || 'Usually replies quickly';
  var intro = me.getAttribute('data-intro') || '';
  var quick = (me.getAttribute('data-quick') || '').split('|').filter(Boolean);
  var teaser = me.getAttribute('data-teaser') || '';
  if (sheet) full = true;
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
    + '.k1c.is-edit .k1c-pull{background:#c93e09;border-color:#c93e09;color:#fff}.k1c.is-edit .k1c-pull i{background:#fff;color:#c93e09}.k1c.is-edit .k1c-form{background:#fff4ee;border-top-color:#ffd3bf}.k1c.is-edit .k1c-form textarea{border-color:#ff9d74}.k1c.is-edit .k1c-send{background:#c93e09}.k1c-edit + .k1c-form{border-top:1px solid #d2d2d7}'
    + '.k1c-attach{flex:0 0 auto;align-self:flex-end;display:grid;place-items:center;width:42px;height:42px;border:1px solid #d2d2d7;border-radius:12px;background:#fff;color:#1d1d1f;cursor:pointer}.k1c-attach svg{width:20px;height:20px}.k1c-attach:hover{background:#f5f5f7}'
    + '.k1c-shots{display:flex;gap:8px;padding:10px 12px 0;overflow-x:auto;background:#fff4ee}.k1c-shots[hidden]{display:none}.k1c-shot{position:relative;flex:0 0 auto;width:64px;height:64px;border-radius:10px;overflow:hidden;border:1px solid #ffd3bf;background:#fff}.k1c-shot img{width:100%;height:100%;object-fit:cover;display:block}.k1c-shot button{position:absolute;top:2px;right:2px;width:20px;height:20px;border:0;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:13px;line-height:20px;padding:0;cursor:pointer}'
    + '.k1c-m img{display:block;max-width:100%;border-radius:10px;margin-top:6px}'
    + '.k1c-hint{margin:0;padding:8px 14px 0;font-size:12.5px;color:#c93e09;background:#fff4ee}.k1c-hint[hidden]{display:none}'
    + '.k1c-card{align-self:stretch;border:1px solid #e5e5ea;border-radius:16px;padding:14px;background:#fafafa}.k1c-card b{display:block;font-size:14.5px;margin-bottom:4px}.k1c-card p{margin:0 0 10px;font-size:13.5px;color:#4a4a4f}.k1c-card a{display:inline-block;margin:0 8px 6px 0;padding:8px 13px;border-radius:10px;font-size:13.5px;font-weight:600;text-decoration:none;background:#1d1d1f;color:#fff}.k1c-card a.k1c-ghost{background:none;color:#1d1d1f;border:1px solid #d2d2d7}.k1c-card.k1c-ok{background:#fff4ee;border-color:#ffd3bf}'
    /* Dot, beside his tips. */
    + '.k1c-dot{position:relative;display:inline-block;flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#c93e09 0%,#ff4f12 60%,#ff7a3d 100%);vertical-align:middle}.k1c-dot .k1c-eyes{position:absolute;left:0;right:0;top:34%;display:flex;justify-content:center;gap:6px;animation:k1c-look 7s ease-in-out infinite}.k1c-dot .k1c-eyes i{display:block;width:5px;height:9px;border-radius:50%;background:#fff;animation:k1c-blink 4.2s ease-in-out infinite}'
    + '@keyframes k1c-look{0%,14%{transform:none}20%,36%{transform:translate(-3px,-1px)}42%,58%{transform:translate(3px,-1px)}64%,80%{transform:translate(0,2px)}86%,100%{transform:none}}@keyframes k1c-blink{0%,91%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}'
    + '.k1c-headl{display:flex;align-items:center;gap:10px}'
    + '.k1c-guide{display:flex;gap:9px;align-items:flex-start;align-self:stretch}.k1c-guide .k1c-dot{width:28px;height:28px;margin-top:2px}.k1c-guide .k1c-dot .k1c-eyes{gap:5px}.k1c-guide .k1c-dot .k1c-eyes i{width:4px;height:8px}.k1c-gbody{flex:1;min-width:0;background:#fff4ee;color:#7a2a06;border-radius:4px 16px 16px 16px;padding:10px 13px;font-size:14px}.k1c-gbody p{margin:0}.k1c-gbody small{display:block;font-size:11.5px;font-weight:600;letter-spacing:.02em;color:#c93e09;margin-bottom:2px}.k1c-gacts{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.k1c-gacts a,.k1c-gacts button{border:1px solid #ffd3bf;background:#fff;color:#7a2a06;border-radius:980px;padding:6px 11px;font:inherit;font-size:12.5px;font-weight:600;text-decoration:none;cursor:pointer}.k1c-gacts a:hover,.k1c-gacts button:hover{background:#ffe9de}'
    + '.k1-spot{outline:3px solid #ff4f12 !important;outline-offset:3px;border-radius:10px;animation:k1-spot 1.2s ease-in-out 2}@keyframes k1-spot{50%{outline-color:rgba(255,79,18,.25)}}'
    + '@media (prefers-reduced-motion:reduce){.k1c-dot .k1c-eyes,.k1c-dot .k1c-eyes i,.k1-spot{animation:none}}'
    + '@media (max-width:480px){.k1c{right:10px;left:10px;width:auto;bottom:80px}}'
    /* data-full: the whole screen on a phone, a full-height panel on the right elsewhere. */
    + '.k1c-full{top:12px;right:12px;bottom:12px;width:min(420px,calc(100vw - 24px));max-height:none}'
    + '@media (max-width:700px){.k1c-full{top:0;right:0;bottom:0;left:0;width:auto;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}'
    /* data-style="sheet": the Kanvas Academy look. */
    + '.k1s .k1c-head{background:#fff;color:#1d1d1f;border-bottom:1px solid #e5e5ea;padding:12px 14px}.k1s .k1c-head small{opacity:1;color:#6e6e73}.k1s .k1c-head b{font-size:16.5px;font-weight:650;letter-spacing:-.01em}'
    + '.k1s-av{flex:0 0 auto;width:38px;height:38px;border-radius:50%;object-fit:cover;background:#f0f0f3;display:block}.k1s-av.k1s-sm{width:28px;height:28px}'
    + '.k1s .k1c-x{width:36px;height:36px;padding:0;border:1px solid #d2d2d7;border-radius:50%;color:#6e6e73;display:grid;place-items:center}.k1s .k1c-x:hover{color:#1d1d1f;border-color:#86868b}.k1s .k1c-x svg{width:16px;height:16px}'
    + '.k1s .k1c-msgs{padding:16px 14px 8px;gap:4px;background:#fff}'
    + '.k1s-row{display:flex;align-items:flex-end;gap:8px}.k1s-row.k1s-me{justify-content:flex-end}.k1s-slot{flex:0 0 28px;width:28px;height:28px}.k1s-col{display:flex;flex-direction:column;gap:3px;max-width:80%}.k1s-name{padding:0 4px;font-size:12px;font-weight:600;color:#6e6e73}'
    + '.k1s .k1c-m{max-width:none;border-radius:22px;padding:10px 15px;font-size:15px}.k1s .k1c-m.k1c-o{background:#f5f5f7;border:1px solid #e5e5ea;border-bottom-left-radius:22px}.k1s .k1c-m.k1c-v{border-bottom-right-radius:22px}.k1s-row+.k1s-row.k1s-new{margin-top:8px}'
    + '.k1s-ask{display:flex;justify-content:flex-end;margin:10px 0 4px}.k1s-ask button{border:0;background:' + color + ';color:#fff;border-radius:980px;padding:10px 16px;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.14);text-align:left}.k1s-ask button:hover{filter:brightness(1.06)}'
    + '.k1s-quick{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px 36px}.k1s-quick button{border:1px solid #d2d2d7;background:#fff;color:#1d1d1f;border-radius:980px;padding:7px 12px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}.k1s-quick button:hover{border-color:' + color + ';color:' + color + '}'
    + '.k1s .k1c-form{align-items:flex-end;border-top:1px solid #e5e5ea;padding:10px 12px 6px}.k1s .k1c-form textarea{border-radius:20px;padding:10px 15px;border-color:#e5e5ea;background:#fff}.k1s .k1c-send{flex:0 0 42px;width:42px;height:42px;padding:0;border-radius:50%;display:grid;place-items:center}.k1s .k1c-send svg{width:18px;height:18px}.k1s .k1c-send:disabled{opacity:.5}'
    + '.k1s-foot{margin:0;padding:0 14px 10px;text-align:center;font-size:11.5px;color:#86868b}'
    + '.k1s .k1c-details{margin:6px 12px;border:1px solid #e5e5ea;border-radius:18px;background:#fafafa;padding:12px 14px}.k1s .k1c-details .k1s-in{display:flex;flex-wrap:wrap;gap:6px}.k1s .k1c-details input{flex:1 1 140px;width:auto;margin:0}.k1s .k1c-details input[type=tel]{display:none}.k1s .k1c-details .k1c-row{margin-top:8px;align-items:center}.k1s .k1c-details .k1c-save{border-radius:980px;padding:8px 16px}'
    + '.k1s-teaser{position:fixed;right:16px;bottom:18px;z-index:2147482999;display:flex;align-items:flex-start;gap:10px;max-width:min(330px,calc(100vw - 32px));padding:12px 36px 12px 12px;border-radius:18px;background:#fff;color:#1d1d1f;box-shadow:0 12px 36px rgba(0,0,0,.18);font:14.5px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;cursor:pointer;animation:k1s-in .35s ease-out}.k1s-teaser b{display:block;font-size:13px}.k1s-teaser p{margin:2px 0 0}.k1s-teaser .k1s-tx{position:absolute;top:6px;right:6px;width:26px;height:26px;border:0;border-radius:50%;background:none;color:#86868b;font-size:18px;line-height:1;cursor:pointer}'
    + '@keyframes k1s-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.k1s-teaser{animation:none}}'
    + '@media (max-width:700px){.k1s-teaser{bottom:86px}}';
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
  panel.className = 'k1c' + (full ? ' k1c-full' : '') + (sheet ? ' k1s' : ''); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with ' + name);
  var DOT = '<span class="k1c-dot" aria-hidden="true"><span class="k1c-eyes"><i></i><i></i></span></span>';
  panel.innerHTML = '<div class="k1c-head"><div class="k1c-headl"><div><b></b><small>Usually replies quickly</small></div></div><button class="k1c-x" type="button" aria-label="Close">&times;</button></div>'
    + '<div class="k1c-msgs"></div>'
    + '<div class="k1c-details" hidden><p>Leave an email or number in case you step away, and we’ll reply there too.</p><input type="text" placeholder="Your name" autocomplete="name"><input type="email" placeholder="Email" autocomplete="email" inputmode="email"><input type="tel" placeholder="Mobile" autocomplete="tel" inputmode="tel"><div class="k1c-row"><button type="button" class="k1c-save">Save</button><button type="button" class="k1c-skip">Not now</button></div></div>'
    + (edits ? '<div class="k1c-edit"><button type="button" class="k1c-pull" aria-pressed="false"><i aria-hidden="true">+</i><span>Add website edit request</span></button></div><p class="k1c-hint" hidden>Tell us the change: words, photos, prices or hours. Add a screenshot of the part to change with the picture button. We make it and let you know.</p>' : '')
    + (edits ? '<div class="k1c-shots" hidden></div>' : '')
    + '<form class="k1c-form">' + (edits ? '<button type="button" class="k1c-attach" aria-label="Add a screenshot or photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-7 7"/></svg></button><input type="file" class="k1c-file" accept="image/*" multiple hidden>' : '') + '<textarea rows="1" placeholder="Write a message" aria-label="Your message" maxlength="2000"></textarea><button class="k1c-send" type="submit">Send</button></form>';
  panel.querySelector('.k1c-head div b').textContent = (sheet && agent) || name;
  var SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  if (sheet) {
    panel.querySelector('.k1c-head small').textContent = subtitle;
    if (avatar) {
      var hav = document.createElement('img'); hav.className = 'k1s-av'; hav.src = avatar; hav.alt = '';
      panel.querySelector('.k1c-headl').insertBefore(hav, panel.querySelector('.k1c-headl').firstChild);
    }
    var hx = panel.querySelector('.k1c-x');
    hx.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>';
    var sb0 = panel.querySelector('.k1c-send'); sb0.innerHTML = SEND; sb0.setAttribute('aria-label', 'Send message');
    panel.querySelector('textarea').placeholder = 'Type a message\u2026';
    var dp = panel.querySelector('.k1c-details p');
    dp.textContent = 'Who\u2019s asking? Leave an email too and ' + (agent ? 'I\u2019ll' : 'we\u2019ll') + ' reply there if you\u2019ve gone.';
    var dIns = panel.querySelectorAll('.k1c-details input'), wrapIn = document.createElement('div'); wrapIn.className = 'k1s-in';
    dIns[0].parentNode.insertBefore(wrapIn, dIns[0]);
    Array.prototype.forEach.call(dIns, function (el) { wrapIn.appendChild(el); });
    dIns[1].placeholder = 'Email (optional)';
    panel.querySelector('.k1c-skip').textContent = 'Skip';
    var foot = document.createElement('p'); foot.className = 'k1s-foot';
    foot.textContent = 'Replies come here, and by email if you leave one.';
    panel.appendChild(foot);
  }
  if (!btn.parentNode) document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('.k1c-msgs');
  var form = panel.querySelector('.k1c-form');
  var input = panel.querySelector('textarea');
  var badge = btn.querySelector('.k1c-n');
  var detailsBox = panel.querySelector('.k1c-details');

  function sys(text) { var d = document.createElement('div'); d.className = 'k1c-sys'; d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; }
  var lastAuthor = null;
  function add(m) {
    var d = document.createElement('div'); d.className = 'k1c-m ' + (m.author === 'visitor' ? 'k1c-v' : 'k1c-o'); d.textContent = m.body;
    if (m.id) d.dataset.id = m.id;
    if (!sheet) msgs.appendChild(d);
    else {
      /* Their photo and name on the first reply of a run, like the academy. */
      var mine = m.author === 'visitor', first = lastAuthor !== m.author;
      var row = document.createElement('div'); row.className = 'k1s-row' + (mine ? ' k1s-me' : '') + (first ? ' k1s-new' : '');
      var col = document.createElement('div'); col.className = 'k1s-col';
      if (!mine) {
        var slot = document.createElement('div'); slot.className = 'k1s-slot';
        if (first && avatar) { var av = document.createElement('img'); av.className = 'k1s-av k1s-sm'; av.src = avatar; av.alt = ''; slot.appendChild(av); }
        row.appendChild(slot);
        if (first && agent) { var nm = document.createElement('span'); nm.className = 'k1s-name'; nm.textContent = agent; col.appendChild(nm); }
      }
      col.appendChild(d); row.appendChild(col); msgs.appendChild(row);
      lastAuthor = m.author;
    }
    msgs.scrollTop = msgs.scrollHeight;
    if (m.at && (!lastAt || m.at > lastAt)) lastAt = m.at;
  }
  /* The opening line: theirs, as a message, with questions to tap; or the
     plain greeting on every other site. */
  var quickEl = null;
  function greet() {
    lastAuthor = null;
    if (!sheet || !intro) { sys(greeting); return; }
    add({ author: 'owner', body: intro });
    if (quick.length && !conv) {
      quickEl = document.createElement('div'); quickEl.className = 'k1s-quick';
      quick.forEach(function (q) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = q;
        b.addEventListener('click', function () { input.value = q; if (quickEl) { quickEl.remove(); quickEl = null; } form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); });
        quickEl.appendChild(b);
      });
      msgs.appendChild(quickEl);
    }
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
    if (open && tz) { tz.remove(); tz = null; }
    if (open) {
      renderGuide(); unread = 0; badge.hidden = true;
      /* On a phone, opening must not throw the keyboard up: it hides the
         header and the first message before anyone has read them. */
      if (!touch) input.focus();
      msgs.scrollTop = msgs.scrollHeight; fit();
      if (conv) poll().then(schedule);
    }
    else { unfit(); schedule(); }
  }
  /* Full screen on a phone, sized to what is actually visible. When the
     keyboard comes up, iOS Safari scrolls the page and leaves a fixed panel
     where the page used to be: its top goes off the screen and the site
     shows underneath. Pinning the panel to the visual viewport keeps the
     header at the top and the box just above the keyboard. */
  var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var vv = window.visualViewport;
  function phoneFull() { return full && window.innerWidth <= 700; }
  function fit() {
    if (!open || !vv || !phoneFull()) return;
    panel.style.top = vv.offsetTop + 'px';
    panel.style.height = vv.height + 'px';
    panel.style.bottom = 'auto';
    msgs.scrollTop = msgs.scrollHeight;
  }
  function unfit() { panel.style.top = ''; panel.style.height = ''; panel.style.bottom = ''; }
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  input.addEventListener('focus', function () { setTimeout(fit, 60); setTimeout(fit, 350); });
  btn.addEventListener('click', function () { setOpen(!open); });
  /* One message ready to send, as a single tap: what a page button asked
     for (data-chat-open="Hi Kane, …"). It takes the place of the general
     quick replies, and sends like them. */
  var askEl = null;
  function ask(text) {
    if (askEl) askEl.remove();
    if (quickEl) { quickEl.remove(); quickEl = null; }
    askEl = document.createElement('div'); askEl.className = 'k1s-ask';
    var b = document.createElement('button'); b.type = 'button'; b.textContent = text + ' \u2192';
    b.addEventListener('click', function () {
      input.value = text; askEl.remove(); askEl = null;
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    askEl.appendChild(b); msgs.appendChild(askEl);
    msgs.scrollTop = msgs.scrollHeight;
  }
  /* A link from an email (kanvas.one/#chat) opens it on arrival. */
  if (location.hash === '#chat') setTimeout(function () { setOpen(true); }, 400);
  /* Any link on the page can open it: <a href="#" data-chat-open>. With a
     value, that message waits as a one-tap send. With data-chat-draft, the
     words go in the box instead, for them to finish ("Hi Kane, can One …").
     data-chat-step="17|What they did" counts it as a step (beacon.js). */
  function step(st) {
    if (!st) return;
    var i = st.indexOf('|');
    (window.k1q = window.k1q || []).push([+st.slice(0, i), st.slice(i + 1)]);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-chat-open]');
    if (!t) return;
    e.preventDefault(); if (tz) tz.remove(); setOpen(true);
    step(t.getAttribute('data-chat-step'));
    var draft = t.getAttribute('data-chat-draft');
    if (draft) {
      if (askEl) { askEl.remove(); askEl = null; }
      if (quickEl) { quickEl.remove(); quickEl = null; }
      input.value = draft;
      setTimeout(function () { input.focus(); input.setSelectionRange(draft.length, draft.length); input.dispatchEvent(new Event('input')); }, 350);
      return;
    }
    var text = t.getAttribute('data-chat-open');
    if (text) ask(text);
  });
  /* The teaser: once a visit, a few seconds in, never over an open chat or
     for someone already talking to us. */
  var tz = null;
  if (sheet && teaser && !conv) {
    var seen = false; try { seen = sessionStorage.getItem(KEY + ':t') === '1'; } catch (e) {}
    if (!seen) setTimeout(function () {
      if (open || conv) return;
      try { sessionStorage.setItem(KEY + ':t', '1'); } catch (e) {}
      tz = document.createElement('div'); tz.className = 'k1s-teaser'; tz.setAttribute('role', 'button'); tz.tabIndex = 0;
      tz.innerHTML = (avatar ? '<img class="k1s-av" alt="">' : '') + '<div><b></b><p></p></div><button class="k1s-tx" type="button" aria-label="Dismiss">&times;</button>';
      if (avatar) tz.querySelector('img').src = avatar;
      tz.querySelector('b').textContent = agent || name;
      tz.querySelector('p').textContent = teaser;
      tz.querySelector('.k1s-tx').addEventListener('click', function (e) { e.stopPropagation(); tz.remove(); });
      tz.addEventListener('click', function () { tz.remove(); setOpen(true); step(me.getAttribute('data-teaser-step')); });
      tz.addEventListener('keydown', function (e) { if (e.key === 'Enter') { tz.remove(); setOpen(true); step(me.getAttribute('data-teaser-step')); } });
      document.body.appendChild(tz);
    }, 9000);
  }
  panel.querySelector('.k1c-x').addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });

  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(96, input.scrollHeight) + 'px'; });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (editMode && shots.length) { sendEdit(text); return; }
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
    if (quickEl) { quickEl.remove(); quickEl = null; }
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
    input.placeholder = on ? 'What to change?' : (sheet ? 'Type a message\u2026' : 'Write a message');
    if (sheet) form.querySelector('.k1c-send').setAttribute('aria-label', on ? 'Send edit' : 'Send message');
    else form.querySelector('.k1c-send').textContent = on ? 'Send edit' : 'Send';
    input.focus();
  }
  if (pull) pull.addEventListener('click', function () {
    if (editMode) { setEdit(false); return; }
    memberToken().then(function (t) { if (t) setEdit(true); else explain(); });
  });
  /* ---- screenshots and photos (data-edits) ----
     A member can add pictures to an edit request: a screenshot of the bit
     to change, or the new photo. They are shrunk here first (a phone
     screenshot is several MB; 1600px is plenty to see what to change), then
     uploaded to the same private bucket the Requests page uses, under the
     member's own folder, and attached to the request. */
  var shots = [];
  var shotsBox = panel.querySelector('.k1c-shots');
  var fileIn = panel.querySelector('.k1c-file');
  var attachBtn = panel.querySelector('.k1c-attach');
  function shrink(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); resolve(b || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  function paintShots() {
    shotsBox.innerHTML = '';
    shotsBox.hidden = !shots.length;
    shots.forEach(function (sh, i) {
      var d = document.createElement('div'); d.className = 'k1c-shot';
      var im = document.createElement('img'); im.src = sh.url; im.alt = 'Screenshot ' + (i + 1);
      var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Remove'); x.textContent = '×';
      x.addEventListener('click', function () { URL.revokeObjectURL(sh.url); shots.splice(i, 1); paintShots(); });
      d.appendChild(im); d.appendChild(x); shotsBox.appendChild(d);
    });
  }
  function addFiles(list) {
    var files = Array.prototype.filter.call(list || [], function (f) { return /^image\//.test(f.type); });
    if (!files.length) return;
    memberToken().then(function (t) {
      if (!t) { explain(); return; }
      if (!editMode) setEdit(true);
      return Promise.all(files.slice(0, 5 - shots.length).map(shrink)).then(function (blobs) {
        blobs.forEach(function (b) { if (b) shots.push({ blob: b, url: URL.createObjectURL(b) }); });
        if (files.length + shots.length > 5) sys('Up to 5 pictures on one request.');
        paintShots();
        input.focus();
      });
    });
  }
  if (attachBtn) {
    attachBtn.addEventListener('click', function () {
      memberToken().then(function (t) { if (!t) explain(); else fileIn.click(); });
    });
    fileIn.addEventListener('change', function () { addFiles(fileIn.files); fileIn.value = ''; });
    // A screenshot pasted straight into the box (desktop) works too.
    input.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.files) || [];
      if (items.length) { e.preventDefault(); addFiles(items); }
    });
  }
  /* Where the Supabase project is, for the upload. Kanvas One's pages load
     supabase-config.js; if one didn't, fetch it. */
  function supaCfg() {
    if (window.ONE_SUPABASE && window.ONE_SUPABASE.url) return Promise.resolve(window.ONE_SUPABASE);
    return new Promise(function (resolve) {
      var sc = document.createElement('script'); sc.src = base + '/supabase-config.js';
      sc.onload = function () { resolve(window.ONE_SUPABASE || null); }; sc.onerror = function () { resolve(null); };
      document.head.appendChild(sc);
    });
  }
  function tokenUser(t) {
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (er) { return null; }
  }
  function uploadShots(t) {
    if (!shots.length) return Promise.resolve([]);
    var uid = tokenUser(t);
    return supaCfg().then(function (cfg) {
      if (!cfg || !cfg.url || !uid) throw new Error('Could not upload your pictures just now.');
      var batch = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
      return Promise.all(shots.map(function (sh, i) {
        var path = uid + '/' + batch + '-' + i + '.jpg';
        return fetch(cfg.url + '/storage/v1/object/request-attachments/' + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + t, apikey: cfg.publishableKey, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
          body: sh.blob
        }).then(function (r) { if (!r.ok) throw new Error('Could not upload a picture. Try a smaller one.'); return path; });
      }));
    });
  }

  function sendEdit(text) {
    var sendBtn = form.querySelector('.k1c-send'); sendBtn.disabled = true;
    memberToken().then(function (t) {
      if (!t) { setEdit(false); input.value = text; explain(); return; }
      input.value = ''; input.style.height = 'auto';
      /* The server wants a sentence; a picture with a word or two says
         the rest. */
      var body = text;
      if (shots.length && body.length < 10) body = (body ? body + ' ' : '') + '(see the picture' + (shots.length > 1 ? 's' : '') + ')';
      var sent = shots.slice();
      return uploadShots(t).then(function (paths) {
        return fetch(base + '/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify({ kind: 'edit', body: body, source: 'chat', attachmentPaths: paths })
        });
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          if (res.status === 200) {
            var mine = document.createElement('div'); mine.className = 'k1c-m k1c-v'; mine.textContent = body;
            sent.forEach(function (sh) { var im = document.createElement('img'); im.src = sh.url; im.alt = ''; mine.appendChild(im); });
            msgs.appendChild(mine);
            shots = []; paintShots();
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
    }).catch(function (er) { input.value = text; sys((er && er.message) || 'Could not send that. Try again.'); })
      .then(function () { sendBtn.disabled = false; });
  }

  /* ---- Dot's tip for this page (data-edits) ----
     Shown at the top of the chat each time it opens, rewritten in place, so
     it follows the visitor through a form step by step. */
  var TIPS = {
    '/': { text: 'Hi, I\u2019m Dot! Ask our team anything here. Or start now: two minutes of details, then our team builds your site. Starter is live within 24 hours; Business is ready in 7 to 14 days; One\u2019s website in 7 to 14 days, with its app and ads live in 4 to 8 weeks.', actions: [['Get started', '/join'], ['See the plans', '/plans.html']] },
    '/plans': { text: 'Starter is the website, \u00a39.99 a month. Business adds bookings, payments and chat. One runs your ads and Google too. Not sure? Ask me here.', actions: [['Start on Starter', '/join']] },
    '/free': { text: 'Type your business name in the box and press the arrow. Then it\u2019s your email, your web address and a link to where you are online now.', actions: [['Take me to the box', null, '#business']] },
    '/how-it-works': { text: 'Three steps: tell us your name, our team builds your site from your Instagram or Facebook, and it goes live: Starter within 24 hours, Business in 7 to 14 days, and One\u2019s website in 7 to 14 days, with its app and ads live in 4 to 8 weeks.', actions: [['Get started', '/join']] },
    '/requests': { text: 'Every change you ask for lives here. Tap one to see where it\u2019s up to, or reply to it. New one? Tap \u201cAdd website edit request\u201d below.' }
  };
  var guideEl = null;
  function guideFor() {
    try { if (typeof window.oneGuide === 'function') { var g = window.oneGuide(); if (g) return g; } } catch (er) { /* the page's own tip failed: use ours */ }
    var path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
    if (/^\/(websites-for|web-design)-/.test(path)) return TIPS['/'];
    return TIPS[path] || null;
  }
  function spot(sel, click) {
    if (click) { var opener = document.querySelector(click); if (opener) opener.click(); }
    setTimeout(function () {
      var el = document.querySelector(sel);
      if (!el) return;
      /* On a phone the panel covers the page: get out of the way. */
      if (window.innerWidth <= 700) setOpen(false);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('k1-spot'); void el.offsetWidth; el.classList.add('k1-spot');
      setTimeout(function () { el.classList.remove('k1-spot'); }, 2600);
      try { el.focus({ preventScroll: true }); } catch (er) {}
    }, click ? 250 : 0);
  }
  function renderGuide() {
    if (!edits || sheet) return;
    var g = guideFor();
    if (!g) { if (guideEl) { guideEl.remove(); guideEl = null; } return; }
    if (!guideEl || !guideEl.isConnected) {
      guideEl = document.createElement('div');
      guideEl.className = 'k1c-guide';
      msgs.insertBefore(guideEl, msgs.firstChild);
    }
    guideEl.innerHTML = DOT + '<div class="k1c-gbody"><small>Dot</small><p></p><div class="k1c-gacts"></div></div>';
    guideEl.querySelector('p').textContent = g.text;
    var acts = guideEl.querySelector('.k1c-gacts');
    (g.actions || []).forEach(function (a) {
      var el;
      if (a[1]) { el = document.createElement('a'); el.href = /^https?:/.test(a[1]) ? a[1] : base + a[1]; }
      else { el = document.createElement('button'); el.type = 'button'; el.addEventListener('click', function () { spot(a[2], a[3]); }); }
      el.textContent = a[0];
      acts.appendChild(el);
    });
    if (!acts.children.length) acts.remove();
  }
  window.addEventListener('one:guide', function () { if (open) renderGuide(); });

  /* First paint: the greeting, then whatever thread is already here. */
  greet();
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
      msgs.innerHTML = ''; lastAt = null; greet();
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
          msgs.innerHTML = ''; lastAt = null; greet();
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
