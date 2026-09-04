/* one — the referral page
 *
 * Shows the signed-in customer their code (minted server-side on first ask)
 * with a native share sheet where the device has one and a copy-link
 * fallback everywhere. Signed-out visitors see a login pointer instead -
 * the page leaks nothing without a real session, because the code only
 * comes from /api/requests with a live token.
 */
(function () {
  'use strict';

  var gate = document.getElementById('refGate');
  var main = document.getElementById('refMain');
  if (!gate || !main) return;

  var token = window.ONE_SESSION && window.ONE_SESSION.token && window.ONE_SESSION.token();
  if (!token) { gate.hidden = false; return; }

  var LINK = '';
  var CODE = '';

  function shareText() {
    return 'Kanvas One builds your website for you, from £50 a month - and you '
      + 'see a free example of your site before paying anything. Use my code '
      + CODE + ' when you join: ' + LINK;
  }

  async function load() {
    try {
      var res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'getReferralCode' })
      });
      var data = await res.json();
      if (!res.ok || !data.code) throw new Error(data.error || 'No code');

      CODE = data.code;
      LINK = data.link;
      document.getElementById('refCodeBig').textContent = CODE;
      main.hidden = false;

      var share = document.getElementById('refShare');
      if (navigator.share) {
        share.hidden = false;
        share.addEventListener('click', function () {
          navigator.share({ title: 'Kanvas One', text: shareText(), url: LINK })
            .catch(function () { /* they closed the sheet - fine */ });
        });
      }

      var copy = document.getElementById('refCopyLink');
      copy.addEventListener('click', function () {
        var done = function () {
          copy.textContent = 'Copied!';
          setTimeout(function () { copy.textContent = 'Copy your link'; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(LINK).then(done, function () {
            document.getElementById('refNote').textContent = LINK;
          });
        } else {
          document.getElementById('refNote').textContent = LINK;
          done();
        }
      });
    } catch (e) {
      /* A stale token reads the same as no token. */
      console.log('referral page:', e && e.message);
      gate.hidden = false;
    }
  }

  load();
})();
