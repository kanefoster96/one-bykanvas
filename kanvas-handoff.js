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
    if (document.readyState === 'complete') window.kanvasReady(); else window.addEventListener('load', window.kanvasReady);
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

  if (window.supabase) { claim(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = claim;
  s.onerror = strip;
  document.head.appendChild(s);
})();
