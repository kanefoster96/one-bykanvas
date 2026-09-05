/* one — get started wizard.
 *
 * Step 1 creates the Supabase account. With email confirmation switched on
 * there is no session until the customer clicks the link in their inbox, so
 * RLS would reject any write from steps 2-4. Everything is therefore kept in
 * the browser and stashed under PENDING_KEY; account.js flushes it into the
 * profile the first time they land there with a real session.
 */
(function () {
  'use strict';

  /* A referral link (?ref=CODE) can land on any visit before the one where
     they pay, so it is stashed the same way the offer code is. */
  var REF_KEY = 'one-ref';
  try {
    var refParam = new URLSearchParams(location.search).get('ref');
    if (refParam) localStorage.setItem(REF_KEY, refParam.toUpperCase().slice(0, 20));
  } catch (e) {}
  function referralCode() {
    var typed = document.getElementById('refCode');
    if (typed && typed.value.trim()) return typed.value.trim().toUpperCase();
    try { return localStorage.getItem(REF_KEY) || ''; } catch (e) { return ''; }
  }

  (function () {
    var el = document.getElementById('refCode');
    if (!el) return;
    try {
      var stashed = localStorage.getItem(REF_KEY);
      if (stashed && !el.value) el.value = stashed;
    } catch (e) {}
  })();

  function offerCode() {
    return (window.ONE_SESSION && window.ONE_SESSION.offerCode &&
            window.ONE_SESSION.offerCode()) || '';
  }

  var PENDING_KEY = 'one.pending-onboarding';
  var LAST = 5;                       // step 6 is the confirmation screen

  var track   = document.getElementById('track');
  var steps   = Array.prototype.slice.call(track.querySelectorAll('.wiz-step'));
  var bar     = document.getElementById('bar');
  var stepNow = document.getElementById('stepNow');
  var wizTop  = document.getElementById('wizTop');

  var current = 1;
  var signedUp = false;
  var answers = {};

  var PLANS = {
    business: { label: 'Business', price: '£50', yearly: '£500' },
    pro:      { label: 'Pro',      price: '£120' },
    max:      { label: 'Max',      price: '£250', yearly: '£2,500' }
  };

  /* Monthly or annual, shared with the plans page through the same stash;
     script.js owns the toggle buttons, this file owns the wizard's prices. */
  function billingMode() {
    try { return localStorage.getItem('one-billing') === 'annual' ? 'annual' : 'monthly'; }
    catch (e) { return 'monthly'; }
  }
  function paintBilling() {
    var mode = billingMode();
    document.querySelectorAll('.bill-opt').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.bill === mode);
    });
    document.querySelectorAll('.pick-head em[data-y]').forEach(function (em) {
      var parts = (mode === 'annual' ? em.dataset.y : em.dataset.m).split('|');
      em.innerHTML = parts[0] + '<span>' + parts[1] + '</span>';
    });
  }
  /* This page does not load script.js, so the toggle is handled here in
     full: stash the choice, light the button, repaint the prices. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.bill-opt');
    if (!btn) return;
    try { localStorage.setItem('one-billing', btn.dataset.bill); } catch (e2) {}
    paintBilling();
  });
  paintBilling();

  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function say(el, msg, kind) { el.textContent = msg; el.className = 'note' + (kind ? ' ' + kind : ''); }

  /* ---------------------------------------------------------- navigation */
  function show(step) {
    current = step;

    steps.forEach(function (s) {
      var n = Number(s.dataset.step);
      s.hidden = n !== step;
    });

    // Slide the track, unless the visitor prefers reduced motion.
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      track.classList.remove('slide');
      void track.offsetWidth;          // restart the animation
      track.classList.add('slide');
    }

    wizTop.hidden = step > LAST;
    if (step <= LAST) {
      stepNow.textContent = String(step);
      bar.style.width = Math.round((step / LAST) * 100) + '%';
    }

    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });

    var focusable = steps[step - 1].querySelector('input, button, a');
    if (focusable && step > 1) focusable.focus({ preventScroll: true });
  }

  track.addEventListener('click', function (e) {
    var back = e.target.closest('[data-back]');
    if (back) { show(Math.max(1, current - 1)); return; }
    var next = e.target.closest('[data-next]');
    if (next) advance(next);
  });

  /* ------------------------------------------------------------- steps */
  async function advance(button) {
    if (current === 1) return step1(button);
    if (current === 2) return step2();
    if (current === 3) return stepDomain();
    if (current === 4) return stepPlan();
    if (current === 5) return stepPay(button);
  }

  /* 1 — details + account */
  async function step1(button) {
    var note = $('note1');
    var name = val('contact_name');
    var biz  = val('business_name');
    var mail = val('email');
    var pass = $('password').value;

    if (!name) return say(note, 'Please tell us your name.', 'bad');
    if (!biz)  return say(note, 'Please tell us your business name.', 'bad');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return say(note, 'Enter a valid email address.', 'bad');

    /* Honeypot, same as the login form: signUp goes straight to Supabase, so
       this can only be checked here. Stops at step one rather than pretending
       to advance, since there is nothing further along for a bot to reach. */
    var hp = document.getElementById('wiz_extra');
    if (hp && hp.value) { say(note, ''); return; }

    answers.contact_name = name;
    answers.business_name = biz;
    answers.email = mail;

    /* Already signed in (or already signed up this visit): the account and
       its password exist, and the password field is hidden - so it is not
       demanded here, and Next simply moves on. */
    if (signedUp) { say(note, ''); return show(2); }
    if (pass.length < 8) return say(note, 'Passwords need to be at least 8 characters.', 'bad');
    if (!ONE.requireConfig(note)) return;

    button.disabled = true;
    button.textContent = 'Creating your account…';
    try {
      var res = await ONE.db.auth.signUp({
        email: mail,
        password: pass,
        options: {
          emailRedirectTo: location.origin + '/account.html',
          data: { business_name: biz, contact_name: name }
        }
      });
      if (res.error) throw res.error;
      signedUp = true;
      answers.hasSession = Boolean(res.data.session);
      /* Checkout takes this in place of a session for a brand-new account, so
         an unconfirmed address does not stop anyone paying. */
      answers.pendingUserId = (res.data.user && res.data.user.id) || null;

      /* Two reasons signUp can come back with no session: email confirmation
         is switched on, or this address already has an account - Supabase
         answers the same way for both so it cannot be used to find out who is
         registered. Signing in settles which it is. Without this, someone who
         already has an account is told to confirm an email that never arrives,
         and never sees the payment button. */
      if (!answers.hasSession) {
        var back = await ONE.db.auth.signInWithPassword({ email: mail, password: pass });
        if (back.data && back.data.session) {
          answers.hasSession = true;
        } else if (back.error && /invalid login credentials/i.test(back.error.message || '')) {
          say(note, 'There is already an account with that email. Log in instead and you '
                  + 'can pick up from your account page.', 'bad');
          return;
        }
      }

      /* After the already-registered branch above, so someone coming back to
         an existing account is not counted as a new one. A no-op unless they
         accepted cookies, and nothing identifying goes with it. */
      if (window.oneTrack) window.oneTrack('CompleteRegistration');

      say(note, '');
      show(2);
    } catch (err) {
      say(note, ONE.friendlyError(err), 'bad');
    } finally {
      button.disabled = false;
      button.textContent = 'Next';
    }
  }

  /* 2 — what the business does */
  /* ---- the feature library -------------------------------------------
   *
   * Thirty of the most-asked-for things, simple and complex mixed together,
   * so "name three features" becomes browsing instead of a blank page.
   * Tapping a chip fills whichever box was last focused; typing in a box
   * filters the list; a chip already used in another box drops out so the
   * three answers stay different. Free typing always works.
   */
  var FEATURE_IDEAS = window.FEATURE_IDEAS || [];

  (function wireFeatureLibrary() {
    var panel = $('useSuggest');
    var chipBox = $('useChips');
    if (!panel || !chipBox) return;

    var inputs = ['use1', 'use2', 'use3'].map(function (id) { return $(id); });
    var active = inputs[0];

    function values() {
      return inputs.map(function (i) { return i.value.trim().toLowerCase(); });
    }

    function paint() {
      var filter = active.value.trim().toLowerCase();
      var used = values();
      chipBox.textContent = '';
      FEATURE_IDEAS.forEach(function (idea) {
        var low = idea.toLowerCase();
        if (used.indexOf(low) !== -1) return;              // already picked
        if (filter && low.indexOf(filter) === -1) return;  // typing narrows it
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'use-chip';
        chip.textContent = idea;
        /* pointerdown beats the input's blur, so the tap never lands on a
           list that has just repainted under the finger. */
        chip.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        chip.addEventListener('click', function () {
          active.value = idea;
          /* On to the next empty box, so three taps fills the step. */
          var next = inputs.filter(function (i) { return !i.value.trim(); })[0];
          if (next) { active = next; next.focus({ preventScroll: true }); }
          paint();
        });
        chipBox.appendChild(chip);
      });
    }

    inputs.forEach(function (input) {
      input.addEventListener('focus', function () {
        active = input;
        panel.hidden = false;
        paint();
      });
      input.addEventListener('input', function () { active = input; paint(); });
    });
  })();

  function step2() {
    var note = $('note2');
    var type = val('business_type');
    var uses = [val('use1'), val('use2'), val('use3')].filter(Boolean);

    if (!type) return say(note, 'What sort of business is it?', 'bad');
    if (!uses.length) return say(note, 'Give us at least one thing you want the site to do.', 'bad');

    answers.business_type = type;
    answers.site_uses = uses;
    say(note, '');
    show(3);
    askDomains();
  }

  /* 3 — web address.
   *
   * Suggestions and availability both come from /api/domains, which asks the
   * registries over RDAP. Nothing is bought here; this only records what they
   * want so it can be registered when the site is ready.
   */
  var domainsAsked = false;

  function domainRow(domain, checked) {
    var label = document.createElement('label');
    label.className = 'pick-row' + (checked ? ' is-on' : '');

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'domain';
    input.value = domain;
    input.checked = Boolean(checked);

    var main = document.createElement('span');
    main.className = 'pick-main';
    var head = document.createElement('span');
    head.className = 'pick-head';
    var b = document.createElement('b');
    b.textContent = domain;
    var em = document.createElement('em');
    em.className = 'dom-free';
    em.textContent = 'Free';
    head.appendChild(b);
    head.appendChild(em);
    main.appendChild(head);

    label.appendChild(input);
    label.appendChild(main);
    return label;
  }

  function paintDomains(list, typed) {
    var wrap = $('domList');
    wrap.textContent = '';                 // clears the waiting rows too
    wrap.removeAttribute('aria-busy');
    list.forEach(function (d, i) {
      wrap.appendChild(domainRow(d, d === (typed || answers.requested_domain) || (!typed && !answers.requested_domain && i === 0)));
    });
    if (list.length) {
      answers.requested_domain = wrap.querySelector('input:checked').value;
      answers.domain_owned = false;
    }
  }

  /* Nothing to choose from. Drop the waiting rows and say which kind of nothing
     it is, rather than leaving three bars pulsing forever. */
  function domainsUnavailable(message) {
    var wrap = $('domList');
    wrap.textContent = '';
    wrap.removeAttribute('aria-busy');
    var state = $('domState');
    state.textContent = message;
    state.hidden = false;
  }

  async function askDomains() {
    if (domainsAsked) return;
    domainsAsked = true;
    try {
      var res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest',
          business: answers.business_name,
          business_type: answers.business_type
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (data.suggestions && data.suggestions.length) {
        paintDomains(data.suggestions);
        return;
      }
      /* Every name we tried being taken is a different problem from not being
         able to ask, so the two do not share a message. */
      domainsUnavailable(data.reachable === false
        ? 'We could not reach the registry just now. Type the address you want below, or skip and we will sort it with you.'
        : 'The obvious ones are taken. Type an address below to check it, or skip and we will find you a good one.');
    } catch (err) {
      domainsUnavailable('We could not check just now. Type the address you want below, or skip and we will sort it with you.');
      domainsAsked = false;      // let them get suggestions on a second visit
    }
  }

  $('domList').addEventListener('change', function (e) {
    if (!e.target.matches('input[name="domain"]')) return;
    answers.requested_domain = e.target.value;
    answers.domain_owned = false;
    if ($('domHave')) $('domHave').value = '';
    $('domList').querySelectorAll('.pick-row').forEach(function (row) {
      var pick = row.querySelector('input');
      if (pick) row.classList.toggle('is-on', pick.checked);
    });
    say($('noteDomain'), '');
  });

  /* Strips what people paste: scheme, www, trailing path. */
  function tidyDomain(raw) {
    return String(raw || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  }

  /* Suffixes that are themselves two labels, so example.co.uk is a bare name
     rather than a subdomain of co.uk. */
  var TWO_PART_SUFFIX = /\.(co|org|net|ac|me|gov|ltd|plc|sch)\.[a-z]{2}$/;

  /* www. for the preview only. Something that is already a subdomain keeps its
     own host: www.shop.example.com would be a different address, not a
     prettier version of the same one. */
  function withWww(domain) {
    var labels = domain.split('.');
    var bare = TWO_PART_SUFFIX.test(domain) ? labels.length === 3 : labels.length === 2;
    return bare ? 'www.' + domain : domain;
  }

  $('domCheck').addEventListener('click', async function () {
    var note = $('domOwnNote');
    var btn = this;
    var typed = tidyDomain(val('domOwn'));
    if (!typed) { note.textContent = 'Type an address first.'; return; }

    btn.disabled = true;
    note.textContent = 'Checking\u2026';
    try {
      var res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', domain: typed })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) { note.textContent = data.error || 'That did not work.'; return; }

      if (data.state === 'free') {
        note.textContent = typed + ' is free. Selected.';
        var rows = [].map.call($('domList').querySelectorAll('input[name="domain"]'), function (i) { return i.value; });
        if (rows.indexOf(typed) === -1) rows.unshift(typed);
        $('domState').hidden = true;
        paintDomains(rows.slice(0, 4), typed);
      } else if (data.state === 'taken') {
        note.textContent = typed + ' is already registered. Try another.';
      } else {
        /* Never call it free on a failed lookup. */
        note.textContent = 'We could not check that one. Leave it with us and we will confirm.';
        answers.requested_domain = typed;
        answers.domain_owned = false;
      }
    } catch (err) {
      note.textContent = 'We could not check just now. Leave it with us and we will confirm.';
    } finally {
      btn.disabled = false;
    }
  });

  $('domSkip').addEventListener('click', function () {
    answers.requested_domain = null;
    answers.domain_owned = false;
    say($('noteDomain'), '');
    show(4);
  });

  function stepDomain() {
    /* Typed but unchecked still counts as a request: better to record what they
       want than to insist they press Check. An address they already own wins
       over both, since moving one is what they have asked for. */
    var have = tidyDomain(val('domHave'));
    var typed = tidyDomain(val('domOwn'));
    var picked = $('domList').querySelector('input[name="domain"]:checked');

    if (have) {
      answers.requested_domain = have;
      answers.domain_owned = true;
    } else if (picked) {
      answers.requested_domain = picked.value;
      answers.domain_owned = false;
    } else if (typed) {
      answers.requested_domain = typed;
      answers.domain_owned = false;
    }

    say($('noteDomain'), '');
    show(4);
  }

  /* 4 — plan */
  function stepPlan() {
    var chosen = document.querySelector('input[name="plan"]:checked');
    answers.selected_plan = chosen ? chosen.value : 'business';
    var plan = PLANS[answers.selected_plan];
    var annual = billingMode() === 'annual' && plan.yearly;
    $('sumPlan').textContent = plan.label + (annual ? ' — Annual (2 months free)' : '');
    $('sumPrice').textContent = annual ? plan.yearly + '/year' : plan.price + '/month';
    $('sumEmail').textContent = answers.email || '—';
    $('sumDue').textContent = annual ? plan.yearly : plan.price;

    /* If they arrived with a code, say so before the price - a discount they
       cannot see is a discount they think never happened. Stripe applies it
       on the payment page; this line only promises what that page will show. */
    var offer = (window.ONE_SESSION && window.ONE_SESSION.offerCode
                 && window.ONE_SESSION.offerCode()) || '';
    if ($('sumOfferRow')) {
      /* Promo codes are monthly-only (WELCOME26 on one yearly invoice would
         halve the year) - never promise one next to an annual price. */
      $('sumOfferRow').hidden = !offer || !!annual;
      if (offer) $('sumOffer').textContent = offer + ' applied at checkout';
    }

    /* The address they chose, shown in a browser bar so the thing they are
       buying is on screen before they pay for it. The www. is display only:
       requested_domain stays the bare name, which is what gets registered. */
    var domain = answers.requested_domain;
    $('urlbarText').textContent = domain ? withWww(domain) : 'www.yourbusiness.co.uk';
    $('urlbar').classList.toggle('is-set', Boolean(domain));
    /* Built rather than assigned, so the word carrying the reassurance can be
       the one wearing the colour. textContent on the parts keeps it safe from
       anything the customer typed. */
    var note = $('urlbarNote');
    note.textContent = '';
    if (!domain) {
      note.textContent = 'We\u2019ll find you an address together after you sign up.';
    } else if (answers.domain_owned) {
      note.appendChild(document.createTextNode('Yours already \u2014 we\u2019ll move it across to your new site.'));
    } else {
      var free = document.createElement('b');
      free.textContent = 'Free with your plan.';
      note.appendChild(free);
      note.appendChild(document.createTextNode(' We register it when your site is ready.'));
    }
    $('sumDomainRow').hidden = !domain;
    $('sumDomain').textContent = domain || '\u2014';

    /* The payment button is always offered. If the session is not there yet
       the click recovers it, so an unconfirmed address is something to sort out
       after paying rather than a gate in front of it. */
    $('payThen').hidden = Boolean(answers.hasSession);
    $('skipPay').textContent = 'Skip for now — do it later';

    show(5);
  }


  /* 5 — finish: save now if we can, otherwise stash for first login */
  function buildRow() {
    return {
      business_name:  answers.business_name || null,
      contact_name:   answers.contact_name || null,
      business_type:  answers.business_type || null,
      site_uses:      answers.site_uses && answers.site_uses.length ? answers.site_uses : null,
      selected_plan:  answers.selected_plan || null,
      requested_domain: answers.requested_domain || null,
      domain_owned:     Boolean(answers.domain_owned),
      site_goals:     answers.site_uses ? answers.site_uses.join('\n') : null
    };
  }

  /* Returns true when it reached the database, false when it had to stash. */
  async function saveAnswers() {
    var row = buildRow();
    var saved = false;
    try {
      var sess = ONE.ready ? await ONE.db.auth.getSession() : { data: {} };
      if (sess.data && sess.data.session) {
        row.id = sess.data.session.user.id;
        row.onboarded_at = new Date().toISOString();
        var res = await ONE.db.from('profiles').upsert(row, { onConflict: 'id' });
        if (res.error) throw res.error;
        saved = true;
      }
    } catch (err) {
      // Not fatal: fall through and stash so nothing the customer typed is lost.
      saved = false;
    }

    if (!saved) {
      try { localStorage.setItem(PENDING_KEY, JSON.stringify(row)); } catch (e) {}
    }
    return saved;
  }

  async function stepPay(button) {
    button.disabled = true;
    var label = button.textContent;
    button.textContent = 'Saving…';

    var saved = await saveAnswers();

    if (saved) {
      $('doneHead').textContent = 'Your account is ready.';
      $('confirmLine').textContent = 'Everything you told us is saved against it.';
    } else {
      $('doneHead').textContent = 'Check your email.';
      $('confirmLine').textContent = 'Confirm your address so you can get into your account — '
        + 'your answers are saved and will be waiting.';
    }

    button.disabled = false;
    button.textContent = label;
    show(6);            // the confirmation screen, one along since the domain step
  }

  /* No confirmation link means a typo would not surface until we email the
     draft, so give them a way back to fix it. */
  $('fixEmail').addEventListener('click', function () {
    show(1);
    $('email').focus({ preventScroll: true });
    say($('note1'), signedUp
      ? 'Your account is already created with this address — email us and we will change it.'
      : 'Fix your email address, then carry on.', '');
  });

  /* Stripe Checkout, for customers who already have a session. */
  /* The access token, fetching a session first if there isn't one. signUp
     returns no session while email confirmation is on, so this is what lets
     someone pay the moment they confirm without redoing the form. */
  async function accessToken() {
    var sess = await ONE.db.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    if (token) return token;

    var pass = $('password') ? $('password').value : '';
    if (!answers.email || !pass) return null;
    var back = await ONE.db.auth.signInWithPassword({ email: answers.email, password: pass });
    return (back.data && back.data.session && back.data.session.access_token) || null;
  }

  $('payAction').addEventListener('click', async function () {
    var note = $('note4');
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Opening checkout…';
    say(note, '');

    // Save first: leaving for Stripe means this page goes away.
    try { await saveAnswers(); } catch (e) {}

    try {
      var token = await accessToken();
      if (!token && !answers.pendingUserId) {
        say(note, 'Log in and try again.', 'bad');
        btn.disabled = false;
        btn.textContent = 'Set up payment';
        return;
      }

      /* With a session the token proves who is paying. Without one - which is
         every brand-new signup while email confirmation is on - the id signUp
         gave this browser stands in for it, so confirming the address stays a
         job for afterwards instead of a gate in front of the card. */
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;

      var res = await fetch('/api/checkout', {
        method: 'POST',
        headers: headers,
        /* Carried from the link in their email, if they came from one, so the
           discount is already on the page they pay from. */
        body: JSON.stringify(token
          ? { plan: answers.selected_plan || 'business', offer: offerCode(),
              billing: billingMode(), referralCode: referralCode() }
          : { plan: answers.selected_plan || 'business',
              pendingUserId: answers.pendingUserId,
              email: answers.email,
              offer: offerCode(),
              billing: billingMode(),
              referralCode: referralCode() })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');

      if (window.oneTrack) window.oneTrack('InitiateCheckout', {
        content_category: answers.selected_plan || 'business'
      });
      location.href = data.url;
    } catch (err) {
      say(note, ONE.friendlyError(err), 'bad');
      btn.disabled = false;
      btn.textContent = 'Set up payment';
    }
  });

  /* --------------------------------------------------- already signed in */
  if (ONE.ready) {
    ONE.db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) return;
      signedUp = true;
      /* There is a live session, so checkout will work. Without this the
         payment step decided there was no session and hid its own button,
         which is what anyone already logged in saw. */
      answers.hasSession = true;
      answers.email = session.user.email;
      var meta = session.user.user_metadata || {};
      if (meta.contact_name)  $('contact_name').value  = meta.contact_name;
      if (meta.business_name) $('business_name').value = meta.business_name;
      $('email').value = session.user.email;
      answers.contact_name  = $('contact_name').value.trim();
      answers.business_name = $('business_name').value.trim();
      /* Step 1 still shows - jumping ahead read as the form being broken,
         and this way their prefilled details are on screen to check. Only
         the password field goes: the account already has one, and a box
         that does nothing invites typing into it. */
      var pw = $('passwordField');
      if (pw) pw.hidden = true;
      var pwLabel = document.querySelector('.wiz-step[data-step="1"] .wiz-sub');
      if (pwLabel) pwLabel.textContent = 'You’re signed in — check your details and carry on.';
    });
  }

  /* keep the plan rows visually in sync with the radio */
  document.getElementById('pick').addEventListener('change', function () {
    document.querySelectorAll('.pick-row').forEach(function (row) {
      var pick = row.querySelector('input');
      if (pick) row.classList.toggle('is-on', pick.checked);
    });
  });

  /* The two wants above the plans. Ticking one selects the cheapest plan
   * that covers everything ticked, moves the Recommended flag there and
   * opens its included list. They can still pick any plan afterwards -
   * choosing one that misses a ticked want just gets the orange note, so
   * nobody lands on Business expecting an inbox we never set up.
   */
  (function wirePlanSteer() {
    var email = $('wantEmail'), seo = $('wantSeo'), warnEl = $('planSteer');
    if (!email || !seo || !warnEl) return;

    var COVERS = { business: [], max: ['email', 'seo'] };

    function pickedPlan() {
      var chosen = document.querySelector('input[name="plan"]:checked');
      return chosen ? chosen.value : 'business';
    }

    function warn() {
      /* Nothing ticked: nothing to say. Ticked and covered: a quiet
         confirmation. Ticked and missing: the orange note, with the plan
         that has it - and that skipping is fine, upgrades are one click. */
      if (!email.checked && !seo.checked) {
        warnEl.hidden = true; warnEl.textContent = ''; return;
      }
      var has = COVERS[pickedPlan()];
      var missing = [];
      if (email.checked && has.indexOf('email') === -1) missing.push('the business email address');
      if (seo.checked && has.indexOf('seo') === -1) missing.push('monthly SEO updates');
      if (!missing.length) {
        warnEl.className = 'pick-ok';
        warnEl.textContent = PLANS[pickedPlan()].label + ' includes everything you ticked.';
        warnEl.hidden = false;
        return;
      }
      var covers = 'Max';
      warnEl.className = 'pick-warn';
      warnEl.textContent = 'Just so you know — ' + PLANS[pickedPlan()].label
        + ' doesn’t include ' + missing.join(' or ') + ' you ticked. '
        + covers + ' does — or carry on without it and upgrade any time.';
      warnEl.hidden = false;
    }

    function steer() {
      var rec = 'max';

      var radio = document.querySelector('input[name="plan"][value="' + rec + '"]');
      if (radio) radio.checked = true;
      document.querySelectorAll('#pick .pick-row').forEach(function (row) {
        var input = row.querySelector('input');
        if (input) row.classList.toggle('is-on', input.checked);
      });

      var flag = document.querySelector('#pick .pick-flag');
      var note = document.querySelector('.pick-row[data-plan="' + rec + '"] .pick-note');
      if (flag && note && flag.parentNode !== note) note.insertBefore(flag, note.firstChild);

      /* No open/close to do here: the selected row's feature list expands
         itself - .pick-row.is-on + .pick-feats in the stylesheet. */

      warn();
    }

    email.addEventListener('change', steer);
    seo.addEventListener('change', steer);
    document.getElementById('pick').addEventListener('change', warn);
  })();

  show(1);
})();
