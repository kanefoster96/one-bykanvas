/* one — setting a new password from a reset link.
 *
 * The link in the email goes to Supabase, which verifies the token and sends
 * the customer here with a short-lived recovery session in the URL. That
 * session is enough to change the password and nothing else, which is why
 * this page exists rather than the account page: landing someone on their
 * account with no visible way to do the one thing they came to do is what
 * made the old flow a dead end.
 */
(function () {
  'use strict';

  var checking = document.getElementById('checking');
  var ready    = document.getElementById('ready');
  var failed   = document.getElementById('failed');
  var why      = document.getElementById('why');
  var forWho   = document.getElementById('forWho');
  var form     = document.getElementById('form');
  var note     = document.getElementById('note');
  var submit   = document.getElementById('submit');
  var password = document.getElementById('password');
  var confirm  = document.getElementById('confirm');

  /* Read before supabase-js clears the hash. A rejected link reports itself
     here rather than by landing somewhere different. */
  var LINK_ERROR = (function () {
    var hash  = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    var query = new URLSearchParams(location.search);
    function pick(n) { return hash.get(n) || query.get(n) || ''; }
    if (!pick('error') && !pick('error_code') && !pick('error_description')) return null;
    return { code: pick('error_code'), desc: pick('error_description').replace(/\+/g, ' ') };
  })();

  function show(which) {
    checking.hidden = which !== 'checking';
    ready.hidden    = which !== 'ready';
    failed.hidden   = which !== 'failed';
  }

  function say(message, kind) {
    note.textContent = message;
    note.className = 'note' + (kind ? ' ' + kind : '');
  }

  function cannot(reason) {
    /* Supabase's own wording arrives in the URL, where anyone could put
       anything, so it goes to the console and never into the page. */
    if (LINK_ERROR) console.warn('reset link rejected:', LINK_ERROR.code, LINK_ERROR.desc);
    if (reason) why.textContent = reason;
    show('failed');
  }

  if (!ONE.ready) {
    cannot('Accounts are not connected yet. Please get in touch and we will sort it.');
    return;
  }

  start();

  async function start() {
    if (LINK_ERROR) {
      var expired = /expired|invalid|otp/i.test(LINK_ERROR.code + ' ' + LINK_ERROR.desc);
      return cannot(expired
        ? 'Reset links can only be opened once, and they expire after 24 hours. If your '
          + 'email provider scanned the message before you got to it, the link was already '
          + 'spent by the time you clicked.'
        : 'The link was rejected before it could let you in.');
    }

    var res = await ONE.db.auth.getSession();
    var session = res.data && res.data.session;

    /* No session means no recovery token was in the URL - somebody opened this
       page directly, or the link had already been used. */
    if (!session) {
      return cannot('This page needs a reset link to work. Ask for one and open it from '
                  + 'your email.');
    }

    if (session.user && session.user.email) {
      forWho.textContent = 'Setting a new password for ' + session.user.email + '.';
    }
    show('ready');
    password.focus();
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var next = password.value;
    if (next.length < 8) return say('Passwords need to be at least 8 characters.', 'bad');
    if (next !== confirm.value) return say('Those two passwords do not match.', 'bad');

    submit.disabled = true;
    submit.textContent = 'Saving…';

    var res = await ONE.db.auth.updateUser({ password: next });

    if (res.error) {
      submit.disabled = false;
      submit.textContent = 'Save new password';
      return say(ONE.friendlyError(res.error), 'bad');
    }

    /* The recovery session becomes an ordinary one once the password is set,
       so there is no second log-in to make them do. */
    say('Saved. Taking you to your account…', 'ok');
    setTimeout(function () { location.replace('/account.html'); }, 900);
  });
})();
