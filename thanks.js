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
      lede.textContent = 'We’ve got your details. Your page will land at ' + stash.email
        + ' within 24 hours.';
    }
  }

  if (stash) {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    if (window.oneTrack) window.oneTrack('Lead', { content_category: 'free-preview' });
    startClock();
  }

  /* The 24 hours, counting down from now. Nothing is stored: the flag above
     is already gone, so a refresh or a return visit shows the page without
     the clock. The end time is fixed once and the display is worked out from
     it each tick, so a throttled background tab catches up rather than
     drifting when they come back. */
  function startClock() {
    var box = document.getElementById('clock');
    var h = document.getElementById('clockH');
    var m = document.getElementById('clockM');
    var s = document.getElementById('clockS');
    var sub = document.getElementById('clockSub');
    if (!box || !h || !m || !s) return;

    var end = Date.now() + 24 * 60 * 60 * 1000;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };

    function tick() {
      var left = Math.max(0, Math.round((end - Date.now()) / 1000));
      h.textContent = two(Math.floor(left / 3600));
      m.textContent = two(Math.floor(left / 60) % 60);
      s.textContent = two(left % 60);
      if (left === 0) {
        clearInterval(timer);
        box.classList.add('is-due');
        if (sub) sub.textContent = 'Any moment now. Check your inbox.';
      }
    }

    tick();
    box.hidden = false;
    box.classList.add('in');
    var timer = setInterval(tick, 1000);
  }
})();
