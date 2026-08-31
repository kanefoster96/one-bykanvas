/* one — the page after a free example is asked for.
 *
 * Two jobs. Say the request landed, in the words of somebody who has just
 * pressed a button and wants to know it worked. And report the conversion,
 * which happens here rather than on the form: a pixel fired a moment before
 * navigating away is a pixel that often does not arrive.
 *
 * Arriving here directly - a bookmark, a shared link, the back button - must
 * not report anything. The flag the form leaves behind is what separates a
 * real submission from a visit, and it is cleared as soon as it is used so a
 * refresh cannot count twice.
 */
(function () {
  'use strict';

  var KEY = 'one.free-requested';
  var stash = null;

  try {
    var raw = sessionStorage.getItem(KEY);
    if (raw) stash = JSON.parse(raw);
  } catch (e) { /* private mode: the page still reads correctly without it */ }

  /* Say where it is going, when we know. The address is kept in session
     storage rather than the URL: an email address in a link is an email
     address in browser history, and in the referrer of anything they click
     next. */
  if (stash && stash.email) {
    var lede = document.getElementById('thanksLede');
    if (lede) {
      lede.textContent = 'We’ve got your details. We’ll email ' + stash.email
        + ' as soon as your page is ready.';
    }
  }

  if (stash) {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    if (window.oneTrack) window.oneTrack('Lead', { content_category: 'free-preview' });
  }
})();
