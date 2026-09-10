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
