/* one — the pill on a free example.
 *
 * Dropped into an example site with one tag:
 *
 *   <script src="https://kanvas.one/preview-badge.js"
 *           data-domain="theirname.co.uk" defer></script>
 *
 * It says the address is still free and that joining puts the site live at
 * half price for three months. That is the whole job: somebody looking at
 * their own business on their own phone is the best moment there will be to
 * ask, and there is nothing else on the page that asks.
 *
 * Two rules it has to keep, because it runs on a page that is not ours:
 *
 *   - it must not break anything. Everything is inline-styled and namespaced,
 *     nothing global is set, no stylesheet is added, and every step is wrapped
 *     so a failure leaves the page exactly as it was.
 *   - it must not claim what it has not checked. The address is only called
 *     free after asking, and if the answer does not arrive the pill still
 *     appears with the offer and says nothing about the domain.
 */
(function () {
  'use strict';

  var HOME = 'https://kanvas.one';
  var CODE = 'WELCOME26';
  var DISMISSED = 'one.badge-hidden';

  var tag = document.currentScript;
  if (!tag) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/preview-badge\.js/.test(all[i].src)) { tag = all[i]; break; }
    }
  }
  if (!tag) return;

  var domain = (tag.getAttribute('data-domain') || '').trim().toLowerCase();
  var code = (tag.getAttribute('data-code') || CODE).trim().toUpperCase();
  var home = (tag.getAttribute('data-home') || HOME).replace(/\/+$/, '');

  /* Hidden for this visit only. Closing it should not mean never seeing the
     offer again on a site they will come back to. */
  try {
    if (sessionStorage.getItem(DISMISSED)) return;
  } catch (e) { /* private mode: it just shows */ }

  function css(el, styles) {
    for (var k in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, k)) el.style[k] = styles[k];
    }
    return el;
  }

  function build(freeDomain) {
    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'About this example');
    /* The site's own green, used as the fill rather than the ink, and let
       through at 78% so their page shows behind it. Solid white text on top,
       because this floats over a design we have never seen: a pale pill would
       vanish on a pale site, and the one thing it cannot do is be unreadable
       on the page it is selling. */
    css(wrap, {
      position: 'fixed', left: '50%', bottom: '16px', zIndex: '2147483000',
      transform: 'translate(-50%, 14px)', opacity: '0',
      transition: 'opacity .4s ease, transform .4s ease',
      display: 'flex', alignItems: 'center', gap: '11px',
      maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
      padding: '8px 9px 8px 15px', borderRadius: '980px',
      background: 'rgba(26,127,55,.78)',
      backdropFilter: 'saturate(180%) blur(18px)',
      WebkitBackdropFilter: 'saturate(180%) blur(18px)',
      border: '1px solid rgba(255,255,255,.22)',
      boxShadow: '0 10px 30px rgba(20,70,35,.28)',
      font: '500 13px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif',
      color: 'rgba(255,255,255,.94)'
    });

    /* Still a gift, because it is still 50% off. */
    var gift = document.createElement('span');
    gift.setAttribute('aria-hidden', 'true');
    gift.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" '
      + 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
      + 'stroke-linejoin="round"><rect x="3" y="8" width="18" height="4.2" rx="1"/>'
      + '<path d="M4.8 12.2v7.9c0 .5.4.9.9.9h12.6c.5 0 .9-.4.9-.9v-7.9"/>'
      + '<path d="M12 8v13"/><path d="M12 8c0-2.5-1-4.2-2.8-4.2a2.1 2.1 0 0 0 0 4.2z"/>'
      + '<path d="M12 8c0-2.5 1-4.2 2.8-4.2a2.1 2.1 0 0 1 0 4.2z"/></svg>';
    css(gift, { flex: '0 0 auto', display: 'inline-flex', color: '#fff' });

    var text = document.createElement('span');
    /* One line on a wide screen. The stacked layout below takes over well
       before the sentence would run off the edge. */
    css(text, { minWidth: '0', whiteSpace: 'nowrap' });

    if (freeDomain) {
      var name = document.createElement('b');
      name.textContent = freeDomain;
      css(name, { color: '#fff', fontWeight: '600' });
      text.appendChild(name);
      text.appendChild(document.createTextNode(
        ' is still available! Join today for 50% off your first three months.'));
    } else {
      text.appendChild(document.createTextNode(
        'Join today for 50% off your first three months.'));
    }

    var go = document.createElement('a');
    go.href = home + '/plans.html?offer=' + encodeURIComponent(code);
    go.target = '_blank';
    go.rel = 'noopener';
    go.textContent = 'Join';
    css(go, {
      flex: '0 0 auto', display: 'inline-block', padding: '8px 16px',
      borderRadius: '980px', background: '#fff', color: '#166b2e',
      textDecoration: 'none', fontWeight: '600', fontSize: '13px'
    });

    var shut = document.createElement('button');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Hide this');
    shut.textContent = '×';
    css(shut, {
      flex: '0 0 auto', width: '26px', height: '26px', padding: '0',
      borderRadius: '980px', border: '0', background: 'transparent',
      color: 'rgba(255,255,255,.72)', fontSize: '17px', lineHeight: '1',
      cursor: 'pointer'
    });
    shut.addEventListener('click', function () {
      try { sessionStorage.setItem(DISMISSED, '1'); } catch (e) {}
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    });

    wrap.appendChild(gift);
    wrap.appendChild(text);
    wrap.appendChild(go);
    wrap.appendChild(shut);

    /* Narrow screens get the same pill with the text above the buttons, so a
       long address never pushes Join off the edge. */
    /* 780 rather than a phone width: the sentence is long enough that a
       tablet held in one hand would run out of room on one line. */
    if (window.matchMedia && window.matchMedia('(max-width: 780px)').matches) {
      css(wrap, {
        left: '12px', right: '12px', transform: 'translateY(14px)',
        borderRadius: '20px', padding: '14px 16px',
        flexDirection: 'column', alignItems: 'stretch', gap: '10px'
      });
      css(go, { textAlign: 'center' });
      css(gift, { position: 'absolute', top: '15px', left: '16px' });
      css(text, { paddingLeft: '25px', whiteSpace: 'normal' });
      css(shut, {
        position: 'absolute', top: '8px', right: '10px', width: '24px', height: '24px'
      });
    }

    document.body.appendChild(wrap);
    requestAnimationFrame(function () {
      wrap.style.opacity = '1';
      wrap.style.transform = wrap.style.right ? 'translateY(0)' : 'translate(-50%, 0)';
    });
  }

  /* Asked, not assumed - the same rule the email follows. A check that fails,
     times out or says taken simply means the pill does not mention a domain. */
  function checkThenBuild() {
    if (!domain) return build(null);

    var done = false;
    var give = setTimeout(function () {
      if (!done) { done = true; build(null); }
    }, 4000);

    fetch(home + '/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', domain: domain })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (done) return;
        done = true; clearTimeout(give);
        build(d && d.state === 'free' ? domain : null);
      })
      .catch(function () {
        if (done) return;
        done = true; clearTimeout(give);
        build(null);
      });
  }

  function start() {
    try { checkThenBuild(); } catch (e) { /* never take the page down with us */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
