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
    css(wrap, {
      position: 'fixed', left: '50%', bottom: '16px', zIndex: '2147483000',
      transform: 'translate(-50%, 14px)', opacity: '0',
      transition: 'opacity .4s ease, transform .4s ease',
      display: 'flex', alignItems: 'center', gap: '12px',
      maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
      padding: '9px 10px 9px 17px', borderRadius: '980px',
      background: 'rgba(28,28,30,.82)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      border: '1px solid rgba(255,255,255,.14)',
      boxShadow: '0 12px 34px rgba(0,0,0,.3)',
      font: '500 13px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif',
      color: 'rgba(255,255,255,.86)'
    });

    var text = document.createElement('span');
    css(text, { minWidth: '0' });

    if (freeDomain) {
      var name = document.createElement('b');
      name.textContent = freeDomain;
      css(name, { color: '#fff', fontWeight: '600' });
      text.appendChild(name);
      text.appendChild(document.createTextNode(' is still free. '));
    }
    text.appendChild(document.createTextNode(
      freeDomain ? 'Join to put this live — 50% off 3 months.'
                 : 'Join to put this live — 50% off 3 months.'));

    var go = document.createElement('a');
    go.href = home + '/plans.html?offer=' + encodeURIComponent(code);
    go.target = '_blank';
    go.rel = 'noopener';
    go.textContent = 'Join';
    css(go, {
      flex: '0 0 auto', display: 'inline-block', padding: '8px 16px',
      borderRadius: '980px', background: '#fff', color: '#1d1d1f',
      textDecoration: 'none', fontWeight: '600', fontSize: '13px'
    });

    var shut = document.createElement('button');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Hide this');
    shut.textContent = '×';
    css(shut, {
      flex: '0 0 auto', width: '26px', height: '26px', padding: '0',
      borderRadius: '980px', border: '0', background: 'transparent',
      color: 'rgba(255,255,255,.6)', fontSize: '17px', lineHeight: '1',
      cursor: 'pointer'
    });
    shut.addEventListener('click', function () {
      try { sessionStorage.setItem(DISMISSED, '1'); } catch (e) {}
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    });

    wrap.appendChild(text);
    wrap.appendChild(go);
    wrap.appendChild(shut);

    /* Narrow screens get the same pill with the text above the buttons, so a
       long address never pushes Join off the edge. */
    if (window.matchMedia && window.matchMedia('(max-width: 460px)').matches) {
      css(wrap, {
        left: '12px', right: '12px', transform: 'translateY(14px)',
        borderRadius: '20px', padding: '14px 16px',
        flexDirection: 'column', alignItems: 'stretch', gap: '10px'
      });
      css(go, { textAlign: 'center' });
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
