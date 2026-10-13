/* Kanvas One dashboard handoff.
 *
 * One line on every dashboard we build, before the dashboard's own scripts:
 *
 *   <script src="https://kanvas.one/kanvas-handoff.js"
 *           data-url="https://<ref>.supabase.co" data-key="<publishable key>"></script>
 *
 * When the One app opens the dashboard it arrives with #kanvas_handoff=<token>
 * in the URL: a single-use magic-link token the Kanvas One server minted for
 * the signed-in user. This swaps it for a session on the dashboard's own
 * origin with verifyOtp, strips the fragment so it is never seen again, and
 * reloads so the dashboard boots signed in. Without the fragment it does
 * nothing at all.
 *
 * Needs the Supabase browser library on the page (window.supabase); if it is
 * not there yet, it is fetched from jsDelivr first.
 */
/* The phone, from a dashboard inside the Kanvas One app.
 *
 * Framed in the app, a dashboard can use what the phone can do, through
 * the app around it. Each call resolves with the answer, or rejects with
 * 'unavailable' outside the app or on an install too old to have it, so a
 * dashboard offers the button only when KanvasApp.has() says so:
 *
 *   KanvasApp.has('scan')                       -> true / false
 *   KanvasApp.scan()                            -> Promise<'text in the QR code'>
 *   KanvasApp.addToCalendar({ title, start, end, location, notes })
 *                                               -> Promise<true if saved>
 *   KanvasApp.share({ message, url })           the phone's share sheet
 *   KanvasApp.haptic('light'|'medium'|'success'|'warning'|'error')
 *
 * start and end are ISO strings or anything new Date() reads.
 */
(function () {
  'use strict';
  var framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  var features = [], waiting = {}, n = 0;
  function ask(op, extra) {
    if (!framed) return Promise.reject(new Error('unavailable'));
    var id = 'k' + Date.now().toString(36) + (n++);
    return new Promise(function (resolve, reject) {
      waiting[id] = { resolve: resolve, reject: reject };
      try { window.parent.postMessage(Object.assign({ kanvas: 'native', op: op, id: id }, extra || {}), '*'); }
      catch (e) { delete waiting[id]; reject(new Error('unavailable')); }
    });
  }
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || e.source !== window.parent) return;
    if (m.kanvas === 'native-features') { features = Array.isArray(m.features) ? m.features : []; return; }
    if (m.kanvas !== 'native-result' || !waiting[m.id]) return;
    var w = waiting[m.id]; delete waiting[m.id];
    if (m.error) w.reject(new Error(m.error));
    else if ('data' in m) w.resolve(m.data);
    else w.resolve(!!m.saved);
  });
  if (framed) { try { window.parent.postMessage({ kanvas: 'native', op: 'features' }, '*'); } catch (e) { /* not in the app */ } }
  window.KanvasApp = {
    has: function (f) { return features.indexOf(f) >= 0; },
    scan: function () { return ask('scan'); },
    addToCalendar: function (ev) {
      ev = ev || {};
      var start = new Date(ev.start), end = ev.end ? new Date(ev.end) : null;
      return ask('calendar', { title: ev.title || '', start: isNaN(start) ? '' : start.toISOString(), end: end && !isNaN(end) ? end.toISOString() : '', location: ev.location || '', notes: ev.notes || '' });
    },
    share: function (o) { o = o || {}; if (framed) try { window.parent.postMessage({ kanvas: 'native', op: 'share', message: o.message || '', url: o.url || '' }, '*'); } catch (e) {} },
    haptic: function (style) { if (framed) try { window.parent.postMessage({ kanvas: 'native', op: 'haptic', style: style || 'light' }, '*'); } catch (e) {} }
  };
})();

(function () {
  'use strict';
  /* Inside the One app the dashboard is framed. A class on <html> lets
     the dashboard hide its own header and footer, so it reads as part of
     the app rather than a website inside one:
       .kanvas-embedded .site-header, .kanvas-embedded .site-footer { display: none } */
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { /* cross-origin top: framed */ embedded = true; }
  if (embedded) {
    document.documentElement.classList.add('kanvas-embedded');
    pullToRefresh();
    /* The app keeps its own loading screen up until the page says it is
       ready, so the person sees one loading screen, not the app's and
       then the dashboard's. Said once the page has loaded; a dashboard
       that fetches its data after that can call window.kanvasReady()
       itself when the data is on screen. */
    var told = false;
    window.kanvasReady = function () { if (told) return; told = true; try { window.parent.postMessage({ kanvas: 'ready' }, '*'); } catch (e) { /* nothing to tell */ } };
    /* A page that fetches before it has anything to show says so with
       data-wait on this script tag, and calls window.kanvasReady() itself. */
    var waits = document.currentScript && document.currentScript.hasAttribute('data-wait');
    if (!waits) { if (document.readyState === 'complete') window.kanvasReady(); else window.addEventListener('load', window.kanvasReady); }
  }

  /* Framed in the app, a pull down from the top of the page reloads it,
     the way every other screen of the app refreshes. The app cannot see
     touches inside the frame, so the page does it itself. */
  function pullToRefresh() {
    var y0 = null, dy = 0, busy = false, ring = null;
    var HOLD = 64;
    function dist() { return Math.min(96, dy * 0.5); }
    function ui() {
      if (ring) return ring;
      var st = document.createElement('style');
      st.textContent = '@keyframes kanvas-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
      ring = document.createElement('div');
      ring.setAttribute('style', 'position:fixed;left:50%;top:14px;z-index:2147483000;width:36px;height:36px;margin-left:-18px;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none');
      var spin = document.createElement('div');
      spin.setAttribute('style', 'width:20px;height:20px;border-radius:50%;border:2px solid #d2d2d7;border-top-color:#1d1d1f;box-sizing:border-box');
      ring.appendChild(spin);
      (document.body || document.documentElement).appendChild(ring);
      return ring;
    }
    /* The page itself slides down, the ring in the gap it opens. */
    function move(d, animate) {
      var b = document.body, r = ui();
      b.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.3,1)' : 'none';
      b.style.transform = d ? 'translateY(' + d + 'px)' : '';
      r.style.opacity = d ? String(Math.min(1, d / 40)) : '0';
      if (!busy) r.firstChild.style.transform = 'rotate(' + Math.round(d * 4) + 'deg)';
    }
    document.addEventListener('touchstart', function (e) {
      if (busy || e.touches.length !== 1 || (window.scrollY || document.documentElement.scrollTop || 0) > 0) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      move(dist(), false);
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (y0 === null) return;
      y0 = null;
      if (dist() >= HOLD) {
        busy = true;
        ui().firstChild.style.transform = '';
        ui().firstChild.style.animation = 'kanvas-spin .8s linear infinite';
        move(HOLD, true);
        setTimeout(function () { location.reload(); }, 350);
      } else move(0, true);
    }, { passive: true });
  }

  var m = /[#&]kanvas_handoff=([^&]+)/.exec(location.hash || '');
  if (!m) return;
  var token = decodeURIComponent(m[1]);
  var me = document.currentScript;
  var url = me && me.getAttribute('data-url');
  var key = me && me.getAttribute('data-key');

  function strip() {
    var clean = location.hash.replace(/[#&]kanvas_handoff=[^&]+/, '').replace(/^&/, '#');
    try { history.replaceState(null, '', location.pathname + location.search + (clean === '#' ? '' : clean)); } catch (e) { /* stays, harmless */ }
  }

  function claim() {
    if (!window.supabase || !url || !key) { strip(); return; }
    var client = window.supabase.createClient(url, key);
    client.auth.verifyOtp({ token_hash: token, type: 'magiclink' }).then(function (res) {
      strip();
      if (res.error) { console.warn('kanvas handoff:', res.error.message); return; }
      /* The session is now in this origin's storage; a clean boot reads it. */
      location.reload();
    }).catch(function () { strip(); });
  }

  /* Our own pages carry no data attributes: the connection is in
     supabase-config.js, which loads at the end of the body. Wait for it. */
  function go() {
    if ((!url || !key) && window.ONE_SUPABASE) { url = window.ONE_SUPABASE.url; key = window.ONE_SUPABASE.publishableKey; }
    if (window.supabase) { claim(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = claim;
    s.onerror = strip;
    document.head.appendChild(s);
  }
  if (url && key) { go(); return; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
