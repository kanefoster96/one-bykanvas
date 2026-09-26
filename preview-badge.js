/* one — the card on a free example.
 *
 * Dropped into an example site with one tag:
 *
 *   <script src="https://kanvas.one/preview-badge.js"
 *           data-business="Fade Room Barbers"
 *           data-domain="faderoombarbers.co.uk"
 *           data-lead="<lead id>" defer></script>
 *
 * They open the page from the ready email and get ten seconds with it,
 * alone. Then a card slides up from the bottom: this is your designed
 * shell, features are what build your business online, this address is
 * yours to claim, and one button for Business. What else it could do waits
 * behind a line. The first close offers Starter once, for the person who
 * just wants to be online; after that it folds to a small pill that brings
 * the card back. The pill's own × hides it for the visit.
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
  /* The lead's id, so the wizard can fill in what they already told us. */
  var lead = (tag.getAttribute('data-lead') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(lead)) lead = '';
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
    if (lead) q += '&lead=' + encodeURIComponent(lead);
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

  var card = null, pill = null;
  var offeredStarter = false;   /* the downsell, shown once, on the first close */

  /* Join links: Business is the plan; Starter only when they signal less. */
  var BUSINESS_LINE = 'Bookings, payments, forms and live chat. Reviews asked for automatically. Unlimited changes within 48 hours. Live on your address today.';
  var STARTER_LINE = 'This page live on your own address, found on Google, and customers able to call or email you. No bookings, forms or chat. A change a month.';

  function button(text, href, filled) {
    var a = make('a', {
      display: 'block', padding: '12px 16px', borderRadius: '980px', textAlign: 'center', textDecoration: 'none',
      fontSize: '15px', fontWeight: '600',
      background: filled ? INK : 'transparent', color: filled ? '#fff' : INK,
      border: filled ? '0' : '1px solid ' + INK
    }, text);
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }

  function sheet() {
    var small = narrow();
    var wrap = make('div', {
      position: 'fixed', zIndex: '2147483000', boxSizing: 'border-box',
      left: small ? '0' : 'auto', right: small ? '0' : '16px', bottom: small ? '0' : '16px',
      width: small ? '100%' : '380px', maxHeight: small ? '80vh' : 'calc(100vh - 32px)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      background: '#fff', color: INK,
      borderRadius: small ? '22px 22px 0 0' : '22px',
      boxShadow: '0 -8px 40px rgba(0,0,0,.18), 0 20px 60px rgba(0,0,0,.18)',
      padding: small ? '18px 20px calc(18px + env(safe-area-inset-bottom))' : '22px 24px 22px',
      font: '400 15px/1.5 ' + FONT,
      transform: 'translateY(24px)', opacity: '0',
      transition: still ? 'none' : 'opacity .45s ease, transform .45s ease'
    });
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'About this example');
    return wrap;
  }

  function closeButton(onClick) {
    var shut = make('button', {
      position: 'absolute', top: '12px', right: '12px', width: '30px', height: '30px', padding: '0',
      borderRadius: '980px', border: '0', background: '#f5f5f7', color: INK2,
      fontSize: '18px', lineHeight: '1', cursor: 'pointer', font: '400 18px/1 ' + FONT
    }, '\u00d7');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Close');
    shut.addEventListener('click', onClick);
    return shut;
  }

  function reveal(wrap) {
    document.body.appendChild(wrap);
    requestAnimationFrame(function () {
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateY(0)';
    });
    return wrap;
  }

  /* ------------------------------------------------------------ the card */

  function buildCard(freeDomain) {
    var wrap = sheet();
    wrap.appendChild(closeButton(function () { fold(); }));

    wrap.appendChild(make('p', { margin: '0 0 6px', fontSize: '11px', fontWeight: '600', letterSpacing: '.08em',
      textTransform: 'uppercase', color: GOOD }, 'Your free example' + (business ? ' \u00b7 ' + business : '')));
    wrap.appendChild(make('p', { margin: '0 0 6px 0', paddingRight: '34px', fontSize: '21px', fontWeight: '600',
      letterSpacing: '-.02em', lineHeight: '1.2', color: INK }, 'This is your designed shell.'));
    wrap.appendChild(make('p', { margin: '0 0 12px', fontSize: '14.5px', lineHeight: '1.5', color: INK2 },
      'The look and the feel. Features are what build your business online, and once you join, I build them in.'));

    /* The address. Available only if the registry said so a moment ago. */
    var box = make('div', { margin: '0 0 12px', padding: '12px 14px', borderRadius: '14px',
      background: freeDomain ? GOOD_BG : '#fafafa', border: '1px solid ' + (freeDomain ? GOOD_LINE : LINE) });
    box.appendChild(make('p', { margin: '0 0 3px', fontSize: '11px', fontWeight: '600', letterSpacing: '.08em',
      textTransform: 'uppercase', color: INK3 }, 'Your web address'));
    if (freeDomain) {
      var name = make('p', { margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: INK,
        fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', wordBreak: 'break-all' });
      name.appendChild(document.createTextNode(freeDomain + ' '));
      name.appendChild(make('span', { display: 'inline-block', marginLeft: '4px', padding: '2px 8px', borderRadius: '980px',
        background: '#fff', border: '1px solid ' + GOOD_LINE, fontSize: '11px', fontWeight: '600', color: GOOD,
        fontFamily: FONT, verticalAlign: 'middle' }, 'Available now'));
      box.appendChild(name);
      box.appendChild(make('p', { margin: '0', fontSize: '13px', lineHeight: '1.45', color: INK2 },
        'Registered for you the day you join, included. Or choose your own.'));
    } else {
      box.appendChild(make('p', { margin: '0', fontSize: '13.5px', lineHeight: '1.45', color: INK2 },
        'Your own web address, registered for you and included in your plan.'));
    }
    wrap.appendChild(box);

    /* One plan, one button. */
    var plan = make('div', { margin: '0 0 10px', padding: '14px', borderRadius: '14px', border: '2px solid ' + INK });
    var head = make('div', { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' });
    var left = make('span', { fontSize: '16px', fontWeight: '600', letterSpacing: '-.01em' }, 'Business');
    left.appendChild(make('span', { display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '980px',
      background: GOOD_BG, border: '1px solid ' + GOOD_LINE, fontSize: '11px', fontWeight: '600', color: GOOD,
      verticalAlign: 'middle' }, 'Everything included'));
    var right = make('span', { fontSize: '15px', whiteSpace: 'nowrap' });
    right.appendChild(make('b', { fontSize: '17px' }, '\u00a350'));
    right.appendChild(make('span', { color: INK3 }, '/month'));
    head.appendChild(left); head.appendChild(right);
    plan.appendChild(head);
    plan.appendChild(make('p', { margin: '6px 0 10px', fontSize: '13.5px', lineHeight: '1.45', color: INK2 }, BUSINESS_LINE));
    plan.appendChild(button('Make it my site', joinHref('business'), true));
    wrap.appendChild(plan);

    /* What else it could do, behind a line. */
    var more = make('button', { display: 'block', width: '100%', padding: '6px 0', border: '0', background: 'transparent',
      color: INK2, font: '500 13.5px/1.4 ' + FONT, textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer' },
      'See what else it could do');
    more.type = 'button';
    var ul = make('ul', { margin: '6px 0 4px', padding: '0 0 0 18px', fontSize: '13.5px', lineHeight: '1.45', color: INK2 });
    for (var i = 0; i < COULD.length; i++) ul.appendChild(make('li', { margin: '0 0 4px' }, COULD[i]));
    ul.hidden = true;
    more.addEventListener('click', function () { ul.hidden = !ul.hidden; more.textContent = ul.hidden ? 'See what else it could do' : 'Fewer'; });
    wrap.appendChild(more);
    wrap.appendChild(ul);

    wrap.appendChild(make('p', { margin: '8px 0 0', fontSize: '12.5px', lineHeight: '1.5', textAlign: 'center', color: INK3 },
      '50% off your first month with ' + code + ' \u00b7 No setup fee \u00b7 Cancel any month'));

    return reveal(wrap);
  }

  /* The downsell, on the first close: for the person who just wants to be
     online. Said once; the second close goes straight to the pill. */
  function buildStarter(freeDomain) {
    var wrap = sheet();
    wrap.appendChild(closeButton(function () { fold(); }));
    wrap.appendChild(make('p', { margin: '0 0 6px', fontSize: '11px', fontWeight: '600', letterSpacing: '.08em',
      textTransform: 'uppercase', color: GOOD }, 'Just want to be online?'));
    wrap.appendChild(make('p', { margin: '0 0 6px 0', paddingRight: '34px', fontSize: '20px', fontWeight: '600',
      letterSpacing: '-.02em', lineHeight: '1.2', color: INK }, 'Starter, \u00a325 a month.'));
    wrap.appendChild(make('p', { margin: '0 0 12px', fontSize: '14px', lineHeight: '1.5', color: INK2 },
      STARTER_LINE + (freeDomain ? ' On ' + freeDomain + '.' : '')));
    wrap.appendChild(button('Start on Starter', joinHref('starter'), true));
    var no = make('button', { display: 'block', width: '100%', margin: '8px 0 0', padding: '8px 0', border: '0', background: 'transparent',
      color: INK3, font: '500 13.5px/1.4 ' + FONT, cursor: 'pointer' }, 'No thanks');
    no.type = 'button';
    no.addEventListener('click', function () { fold(); });
    wrap.appendChild(no);
    return reveal(wrap);
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
      freeDomain ? 'Claim it: Business \u00a350, or Starter \u00a325' : 'Business \u00a350, or Starter \u00a325'));
    text.addEventListener('click', function () { unfold(); });

    var go = make('a', {
      flex: '0 0 auto', display: 'inline-block',
      padding: small ? '6px 12px' : '7px 14px',
      borderRadius: '980px', background: '#fff', color: '#0a3817',
      textDecoration: 'none', fontWeight: '600',
      fontSize: small ? '12.5px' : '13px', lineHeight: '1.2'
    }, 'Join');
    go.href = joinHref('business');
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
    if (!offeredStarter) {
      offeredStarter = true;
      card = buildStarter(known);
      return;
    }
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
