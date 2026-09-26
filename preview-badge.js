/* one — the card on a free example.
 *
 * Dropped into an example site with one tag:
 *
 *   <script src="https://kanvas.one/preview-badge.js"
 *           data-business="Fade Room Barbers"
 *           data-domain="faderoombarbers.co.uk" defer></script>
 *
 * They open the page from the ready email and get ten seconds with it,
 * alone. Then a card slides up from the bottom and says, in order: this is
 * your designed shell; features are what build your business online, and
 * here is what it could do once you join; this address is yours to claim;
 * and the three plans, Max first. Close it and it folds to a small pill
 * that brings it back. The pill's own × hides it for the visit.
 *
 * Two rules it has to keep, because it runs on a page that is not ours:
 *
 *   - it must not break anything. Everything is inline-styled and namespaced,
 *     nothing global is set, no stylesheet is added, and every step is wrapped
 *     so a failure leaves the page exactly as it was.
 *   - it must not claim what it has not checked. The address is only called
 *     available after asking the registry. Without one to ask about, the
 *     card asks for a suggestion from the business name; if nothing comes
 *     back it says "your own web address, included" and no more.
 *
 * data-delay (seconds) and data-code override the defaults.
 */
(function () {
  'use strict';

  var HOME = 'https://kanvas.one';
  var CODE = 'WELCOME26';
  var DELAY = 10;
  var DISMISSED = 'one.badge-hidden';
  var FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif';
  var INK = '#1d1d1f', INK2 = '#6e6e73', INK3 = '#86868b', LINE = '#e8e8ed';
  var GOOD = '#1a7f37', GOOD_BG = '#eef8f1', GOOD_LINE = '#c8e6d3';

  var tag = document.currentScript;
  if (!tag) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/preview-badge\.js/.test(all[i].src)) { tag = all[i]; break; }
    }
  }
  if (!tag) return;

  var business = (tag.getAttribute('data-business') || '').trim();
  var domain = (tag.getAttribute('data-domain') || '').trim().toLowerCase();
  var code = (tag.getAttribute('data-code') || CODE).trim().toUpperCase();
  var home = (tag.getAttribute('data-home') || HOME).replace(/\/+$/, '');
  var delay = Number(tag.getAttribute('data-delay'));
  if (!(delay >= 0)) delay = DELAY;

  /* Hidden for this visit only. Closing it should not mean never seeing the
     offer again on a site they will come back to. */
  try {
    if (sessionStorage.getItem(DISMISSED)) return;
  } catch (e) { /* private mode: it just shows */ }

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = function () { return window.matchMedia && window.matchMedia('(max-width: 560px)').matches; };

  function css(el, styles) {
    for (var k in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, k)) el.style[k] = styles[k];
    }
    return el;
  }
  function make(name, styles, text) {
    var el = document.createElement(name);
    if (styles) css(el, styles);
    if (text != null) el.textContent = text;
    return el;
  }
  function joinHref(plan) {
    var q = 'plan=' + plan + '&offer=' + encodeURIComponent(code);
    if (domain) q += '&domain=' + encodeURIComponent(domain);
    return home + '/get-started.html?' + q;
  }

  /* What the page could do. "Could", not "will": some of it is in the build
     from the start, the rest they ask for, any time, included. */
  var COULD = [
    'Bookings, deposits and card payments, straight to your bank',
    'A review asked for after every job, automatically',
    'A page for every service you offer and every town you cover',
    'Live chat and enquiries that reach your phone',
    'Every customer’s bookings and notes against their name'
  ];

  var PLANS = [
    { plan: 'max', name: 'Max', price: '£250', tag: 'Best value', featured: true,
      text: 'The whole thing: built, found on Google, worked on every month. Missed calls texted back, booking reminders texted, business email.' },
    { plan: 'business', name: 'Business', price: '£50', tag: 'Most popular',
      text: 'Online without the monthly work or the texts. The full site, and unlimited changes made for you within 48 hours.' },
    { plan: 'starter', name: 'Starter', price: '£25',
      text: 'Love this page as it is? Somewhere customers can visit you online and call or email you.' }
  ];

  var card = null, pill = null;

  /* ------------------------------------------------------------ the card */

  function buildCard(freeDomain) {
    var small = narrow();
    var wrap = make('div', {
      position: 'fixed', zIndex: '2147483000', boxSizing: 'border-box',
      left: small ? '0' : 'auto', right: small ? '0' : '16px', bottom: small ? '0' : '16px',
      width: small ? '100%' : '400px', maxHeight: small ? '86vh' : 'calc(100vh - 32px)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      background: '#fff', color: INK,
      borderRadius: small ? '22px 22px 0 0' : '22px',
      boxShadow: '0 -8px 40px rgba(0,0,0,.18), 0 20px 60px rgba(0,0,0,.18)',
      padding: small ? '18px 20px calc(20px + env(safe-area-inset-bottom))' : '22px 24px 24px',
      font: '400 15px/1.5 ' + FONT,
      transform: 'translateY(24px)', opacity: '0',
      transition: still ? 'none' : 'opacity .45s ease, transform .45s ease'
    });
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'About this example');

    /* Close, top right, folds the card to the pill. */
    var shut = make('button', {
      position: 'absolute', top: '12px', right: '12px', width: '30px', height: '30px', padding: '0',
      borderRadius: '980px', border: '0', background: '#f5f5f7', color: INK2,
      fontSize: '18px', lineHeight: '1', cursor: 'pointer', font: '400 18px/1 ' + FONT
    }, '×');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Close');
    shut.addEventListener('click', function () { fold(); });
    wrap.appendChild(shut);

    var eyebrow = make('p', { margin: '0 0 6px', fontSize: '11px', fontWeight: '600', letterSpacing: '.08em',
      textTransform: 'uppercase', color: GOOD }, 'Your free example' + (business ? ' · ' + business : ''));
    wrap.appendChild(eyebrow);

    var h = make('p', { margin: '0 0 8px 0', paddingRight: '34px', fontSize: '21px', fontWeight: '600',
      letterSpacing: '-.02em', lineHeight: '1.2', color: INK }, 'This is your designed shell.');
    wrap.appendChild(h);

    var p = make('p', { margin: '0 0 10px', fontSize: '14.5px', lineHeight: '1.5', color: INK2 },
      'What you’re looking at is the look and the feel. Features are what build your business online — and once you join, I build them in. Here’s what it could do:');
    wrap.appendChild(p);

    var ul = make('ul', { margin: '0 0 14px', padding: '0 0 0 18px', fontSize: '14px', lineHeight: '1.45', color: INK2 });
    for (var i = 0; i < COULD.length; i++) {
      ul.appendChild(make('li', { margin: '0 0 4px' }, COULD[i]));
    }
    wrap.appendChild(ul);

    /* The address. Available only if the registry said so a moment ago. */
    var box = make('div', { margin: '0 0 14px', padding: '12px 14px', borderRadius: '14px',
      background: freeDomain ? GOOD_BG : '#fafafa', border: '1px solid ' + (freeDomain ? GOOD_LINE : LINE) });
    var lab = make('p', { margin: '0 0 3px', fontSize: '11px', fontWeight: '600', letterSpacing: '.08em',
      textTransform: 'uppercase', color: INK3 }, 'Your web address');
    box.appendChild(lab);
    if (freeDomain) {
      var name = make('p', { margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: INK,
        fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', wordBreak: 'break-all' });
      name.appendChild(document.createTextNode(freeDomain + ' '));
      name.appendChild(make('span', { display: 'inline-block', marginLeft: '4px', padding: '2px 8px', borderRadius: '980px',
        background: '#fff', border: '1px solid ' + GOOD_LINE, fontSize: '11px', fontWeight: '600', color: GOOD,
        fontFamily: FONT, verticalAlign: 'middle' }, 'Available now'));
      box.appendChild(name);
      box.appendChild(make('p', { margin: '0', fontSize: '13px', lineHeight: '1.45', color: INK2 },
        'Claim it when you join and it’s registered for you, included in your plan. Or choose your own.'));
    } else {
      box.appendChild(make('p', { margin: '0', fontSize: '13.5px', lineHeight: '1.45', color: INK2 },
        'Your own web address, registered for you and included in your plan. Pick it when you join.'));
    }
    wrap.appendChild(box);

    /* The plans, Max first. One line each and a button. */
    wrap.appendChild(make('p', { margin: '0 0 8px', fontSize: '11px', fontWeight: '600', letterSpacing: '.08em',
      textTransform: 'uppercase', color: INK3 }, 'Three ways to have it'));
    for (var j = 0; j < PLANS.length; j++) {
      var pl = PLANS[j];
      var row = make('a', {
        display: 'block', margin: '0 0 8px', padding: '12px 14px', borderRadius: '14px', textDecoration: 'none',
        border: (pl.featured ? '2px solid ' + INK : '1px solid ' + LINE), color: INK
      });
      row.href = joinHref(pl.plan);
      row.target = '_blank';
      row.rel = 'noopener';
      var head = make('span', { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' });
      var left = make('span', { fontSize: '16px', fontWeight: '600', letterSpacing: '-.01em' }, pl.name);
      if (pl.tag) {
        left.appendChild(make('span', { display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '980px',
          background: GOOD_BG, border: '1px solid ' + GOOD_LINE, fontSize: '11px', fontWeight: '600', color: GOOD,
          verticalAlign: 'middle' }, pl.tag));
      }
      var right = make('span', { fontSize: '15px', whiteSpace: 'nowrap' });
      right.appendChild(make('b', { fontSize: '17px' }, pl.price));
      right.appendChild(make('span', { color: INK3 }, '/month'));
      head.appendChild(left);
      head.appendChild(right);
      row.appendChild(head);
      row.appendChild(make('span', { display: 'block', margin: '5px 0 0', fontSize: '13.5px', lineHeight: '1.45', color: INK2 }, pl.text));
      row.appendChild(make('span', {
        display: 'block', margin: '10px 0 0', padding: '10px 14px', borderRadius: '980px', textAlign: 'center',
        fontSize: '14px', fontWeight: '600',
        background: pl.featured ? INK : 'transparent', color: pl.featured ? '#fff' : INK,
        border: pl.featured ? '0' : '1px solid ' + INK
      }, 'Start on ' + pl.name));
      wrap.appendChild(row);
    }

    wrap.appendChild(make('p', { margin: '10px 0 0', fontSize: '12.5px', lineHeight: '1.5', textAlign: 'center', color: INK3 },
      '50% off your first month with ' + code + ', applied when you join · No setup fees · Cancel any month'));

    document.body.appendChild(wrap);
    requestAnimationFrame(function () {
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateY(0)';
    });
    return wrap;
  }

  /* ------------------------------------------------------------ the pill */

  function buildPill(freeDomain) {
    var small = narrow();
    var wrap = make('div', {
      position: 'fixed', left: '50%', bottom: '16px', zIndex: '2147483000',
      transform: 'translate(-50%, 14px)', opacity: '0',
      transition: still ? 'none' : 'opacity .4s ease, transform .4s ease',
      display: 'flex', alignItems: 'center', gap: small ? '9px' : '13px',
      maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
      padding: small ? '8px 8px 8px 12px' : '8px 9px 8px 15px',
      borderRadius: '980px',
      background: 'rgba(10,56,23,.65)',
      backdropFilter: 'saturate(180%) blur(26px)',
      WebkitBackdropFilter: 'saturate(180%) blur(26px)',
      border: '1px solid rgba(255,255,255,.2)',
      boxShadow: '0 10px 30px rgba(8,40,18,.26)',
      font: '500 ' + (small ? '12.5px' : '13px') + '/1.3 ' + FONT,
      color: 'rgba(255,255,255,.95)'
    });
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'About this example');

    /* The words open the card again; the button joins. */
    var text = make('button', { minWidth: '0', display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left',
      padding: '0', border: '0', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' });
    text.type = 'button';
    var top = make('span', { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
    if (freeDomain) {
      top.appendChild(make('b', { color: '#fff', fontWeight: '600' }, freeDomain));
      top.appendChild(document.createTextNode(' is available'));
    } else {
      top.textContent = 'This is your designed shell';
    }
    text.appendChild(top);
    text.appendChild(make('span', { color: 'rgba(255,255,255,.82)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      freeDomain ? 'Claim it, and see what your site could do' : 'See what it could do once you join'));
    text.addEventListener('click', function () { unfold(); });

    var go = make('a', {
      flex: '0 0 auto', display: 'inline-block',
      padding: small ? '6px 12px' : '7px 14px',
      borderRadius: '980px', background: '#fff', color: '#0a3817',
      textDecoration: 'none', fontWeight: '600',
      fontSize: small ? '12.5px' : '13px', lineHeight: '1.2'
    }, 'Join');
    go.href = joinHref('max');
    go.target = '_blank';
    go.rel = 'noopener';

    var shut = make('button', {
      flex: '0 0 auto', width: '24px', height: '24px', padding: '0',
      borderRadius: '980px', border: '0', background: 'transparent',
      color: 'rgba(255,255,255,.7)', fontSize: '17px', lineHeight: '1', cursor: 'pointer'
    }, '×');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Hide this');
    shut.addEventListener('click', function () {
      try { sessionStorage.setItem(DISMISSED, '1'); } catch (e) {}
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    });

    wrap.appendChild(text);
    wrap.appendChild(go);
    wrap.appendChild(shut);
    document.body.appendChild(wrap);
    requestAnimationFrame(function () {
      wrap.style.opacity = '1';
      wrap.style.transform = 'translate(-50%, 0)';
    });
    return wrap;
  }

  var known = null;   /* the address, once checked */

  function fold() {
    if (card && card.parentNode) card.parentNode.removeChild(card);
    card = null;
    if (!pill) pill = buildPill(known);
  }
  function unfold() {
    if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
    pill = null;
    if (!card) card = buildCard(known);
  }

  /* ---------------------------------------------------------- the address */

  /* Asked, not assumed - the same rule the email follows. A check that fails,
     times out or says taken means the card does not call it available. With
     no address given, one is suggested from the business name. */
  function findAddress(cb) {
    var done = false;
    var give = setTimeout(function () { if (!done) { done = true; cb(null); } }, 5000);
    function finish(v) { if (done) return; done = true; clearTimeout(give); cb(v); }

    var body = domain
      ? { action: 'check', domain: domain }
      : business ? { action: 'suggest', business: business } : null;
    if (!body) return finish(null);

    fetch(home + '/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (domain) return finish(d && d.state === 'free' ? domain : null);
        var got = d && d.suggestions && d.suggestions[0];
        if (got) domain = got;
        finish(got || null);
      })
      .catch(function () { finish(null); });
  }

  function start() {
    try {
      /* The check runs during the wait, so the card has its answer when it
         is time to show it. */
      var address = undefined;
      findAddress(function (v) { address = v; });
      setTimeout(function () {
        try {
          var open = function () { known = address || null; unfold(); };
          if (address !== undefined) return open();
          /* Registry slower than the delay: wait a little longer, then show
             it without the address rather than not at all. */
          var wait = setTimeout(open, 2500);
          var poll = setInterval(function () {
            if (address === undefined) return;
            clearInterval(poll); clearTimeout(wait); open();
          }, 100);
        } catch (e) { /* never take the page down with us */ }
      }, delay * 1000);
    } catch (e) { /* never take the page down with us */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
