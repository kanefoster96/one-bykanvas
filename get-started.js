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

  var PENDING_KEY = 'one.pending-onboarding';
  var LAST = 4;                       // step 5 is the confirmation screen

  var track   = document.getElementById('track');
  var steps   = Array.prototype.slice.call(track.querySelectorAll('.wiz-step'));
  var bar     = document.getElementById('bar');
  var stepNow = document.getElementById('stepNow');
  var wizTop  = document.getElementById('wizTop');

  var current = 1;
  var signedUp = false;
  var answers = {};

  var PLANS = {
    business: { label: 'Business', price: '£50' },
    pro:      { label: 'Pro',      price: '£90' },
    max:      { label: 'Max',      price: '£150' }
  };

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
    if (current === 3) return step3();
    if (current === 4) return step4(button);
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
    if (pass.length < 8) return say(note, 'Passwords need to be at least 8 characters.', 'bad');

    answers.contact_name = name;
    answers.business_name = biz;
    answers.email = mail;

    if (signedUp) { say(note, ''); return show(2); }
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
  }

  /* 3 — plan */
  function step3() {
    var chosen = document.querySelector('input[name="plan"]:checked');
    answers.selected_plan = chosen ? chosen.value : 'business';
    var plan = PLANS[answers.selected_plan];
    $('sumPlan').textContent = plan.label;
    $('sumPrice').textContent = plan.price;

    // Checkout needs a verified session; with email confirmation on there
    // often is not one yet, so say so rather than opening a dead end.
    var signedIn = Boolean(answers.hasSession);
    $('payNow').hidden = !signedIn;
    $('payLater').hidden = signedIn;
    $('payAction').hidden = !signedIn;
    $('skipPay').textContent = signedIn ? 'Skip for now — do it later' : 'Finish';

    show(4);
  }

  /* 4 — finish: save now if we can, otherwise stash for first login */
  function buildRow() {
    return {
      business_name:  answers.business_name || null,
      contact_name:   answers.contact_name || null,
      business_type:  answers.business_type || null,
      site_uses:      answers.site_uses && answers.site_uses.length ? answers.site_uses : null,
      selected_plan:  answers.selected_plan || null,
      site_goals:     answers.site_uses ? answers.site_uses.join('\n') : null
    };
  }

  /* Returns true when it reached the database, false when it had to stash. */
  async function step4Save() {
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

  async function step4(button) {
    button.disabled = true;
    var label = button.textContent;
    button.textContent = 'Saving…';

    var saved = await step4Save();

    $('confirmLine').textContent = saved
      ? 'Your details are saved to your account.'
      : 'Confirm your address so you can get into your account — your answers are saved and will be waiting.';

    button.disabled = false;
    button.textContent = label;
    show(5);
  }

  /* Stripe Checkout, for customers who already have a session. */
  $('payAction').addEventListener('click', async function () {
    var note = $('note4');
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Opening checkout…';
    say(note, '');

    // Save first: leaving for Stripe means this page goes away.
    try { await step4Save(); } catch (e) {}

    try {
      var sess = await ONE.db.auth.getSession();
      var token = sess.data && sess.data.session && sess.data.session.access_token;
      if (!token) throw new Error('Your session has expired. Log in and try again.');

      var res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ plan: answers.selected_plan || 'business' })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
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
      answers.email = session.user.email;
      var meta = session.user.user_metadata || {};
      if (meta.contact_name)  $('contact_name').value  = meta.contact_name;
      if (meta.business_name) $('business_name').value = meta.business_name;
      $('email').value = session.user.email;
      // Their account already exists, so skip straight past step 1.
      answers.contact_name  = $('contact_name').value.trim();
      answers.business_name = $('business_name').value.trim();
      if (answers.contact_name && answers.business_name) show(2);
    });
  }

  /* keep the plan rows visually in sync with the radio */
  document.getElementById('pick').addEventListener('change', function () {
    document.querySelectorAll('.pick-row').forEach(function (row) {
      row.classList.toggle('is-on', row.querySelector('input').checked);
    });
  });

  show(1);
})();
