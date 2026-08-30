/* one — accounts */
(function () {
  'use strict';

/* Login / create account. */

var form     = document.getElementById('form');
var note     = document.getElementById('note');
var submit   = document.getElementById('submit');
var title    = document.getElementById('title');
var subtitle = document.getElementById('subtitle');
var tabLogin = document.getElementById('tab-login');
var tabSignup= document.getElementById('tab-signup');
var password = document.getElementById('password');
var passwordField = document.getElementById('passwordField');
var tabs     = document.getElementById('tabs');
var forgot   = document.getElementById('forgot');
var backToLogin = document.getElementById('backToLogin');
var mode     = 'login';

ONE.requireConfig(note);

/* If a session already exists, there is nothing to log into. */
if (ONE.ready) {
  ONE.db.auth.getSession().then(function (res) {
    if (res.data.session) location.replace('/account.html');
  });
}

function setMode(next) {
  mode = next;
  var signup = mode === 'signup';
  var reset  = mode === 'reset';

  /* Resetting is not a third tab - it is a detour off the login one, so the
     tabs stay showing where you came from and the way back is a link. */
  tabLogin.classList.toggle('is-on', !signup);
  tabSignup.classList.toggle('is-on', signup);
  tabLogin.setAttribute('aria-selected', String(!signup));
  tabSignup.setAttribute('aria-selected', String(signup));
  tabs.hidden = reset;

  title.textContent = reset ? 'Reset your password'
                    : signup ? 'Create your account'
                    : 'Log in';
  subtitle.textContent = reset
    ? 'Tell us the email address on your account and we will send you a link.'
    : signup
      ? 'A few details now saves us asking later.'
      : 'Welcome back.';
  submit.textContent = reset ? 'Send reset link'
                     : signup ? 'Create account'
                     : 'Log in';

  /* The password box is not just hidden for a reset - a required field that
     cannot be seen blocks the form from submitting at all. */
  passwordField.hidden = reset;
  password.disabled = reset;
  password.required = !reset;
  password.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');

  document.querySelectorAll('.signup-only').forEach(function (el) {
    el.hidden = !signup;
  });
  forgot.hidden = reset;
  backToLogin.hidden = !reset;

  note.textContent = '';
  note.className = 'note';
}

tabLogin.addEventListener('click', function () { setMode('login'); });
tabSignup.addEventListener('click', function () { setMode('signup'); });

function say(message, kind) {
  note.textContent = message;
  note.className = 'note' + (kind ? ' ' + kind : '');
}

function busy(on, label) {
  submit.disabled = on;
  submit.textContent = on ? label
    : mode === 'reset'  ? 'Send reset link'
    : mode === 'signup' ? 'Create account'
    : 'Log in';
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!ONE.requireConfig(note)) return;

  /* Same form, same button - only the job changes. */
  if (mode === 'reset') return sendReset();

  var email = document.getElementById('email').value.trim();
  var pass  = password.value;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say('Enter a valid email address.', 'bad');
  if (!pass)                                        return say('Enter your password.', 'bad');
  if (mode === 'signup' && pass.length < 8)         return say('Passwords need to be at least 8 characters.', 'bad');

  busy(true, mode === 'signup' ? 'Creating…' : 'Logging in…');

  try {
    if (mode === 'signup') {
      var signUp = await ONE.db.auth.signUp({
        email: email,
        password: pass,
        options: {
          emailRedirectTo: location.origin + '/account.html',
          data: {
            business_name: document.getElementById('business').value.trim(),
            contact_name:  document.getElementById('contact').value.trim()
          }
        }
      });
      if (signUp.error) throw signUp.error;

      // With email confirmation on, there is no session until they click the link.
      if (signUp.data.session) {
        location.href = '/account.html';
      } else {
        say('Check your email — we have sent a link to confirm your address. '
          + 'Click it and you will be taken straight to your account.', 'ok');
        form.reset();
      }
    } else {
      var signIn = await ONE.db.auth.signInWithPassword({ email: email, password: pass });
      if (signIn.error) throw signIn.error;
      location.href = '/account.html';
    }
  } catch (err) {
    say(ONE.friendlyError(err), 'bad');
  } finally {
    busy(false);
  }
});

/* Switches the card into its reset state rather than acting on whatever
   happens to be typed above - being told to go and fill in a box you have
   already walked past is the sort of small rudeness that makes a form feel
   broken. Carries the address across if there is one. */
forgot.addEventListener('click', function () {
  setMode('reset');
  document.getElementById('email').focus();
});

backToLogin.addEventListener('click', function () {
  setMode('login');
});

async function sendReset() {
  var email = document.getElementById('email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return say('That does not look like an email address.', 'bad');
  }

  busy(true, 'Sending…');
  var res = await ONE.db.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/reset.html'
  });
  busy(false);

  if (res.error) return say(ONE.friendlyError(res.error), 'bad');

  /* Deliberately not "we found your account" or "we didn't": answering that
     turns this box into a way for anyone to test which addresses have
     accounts here. */
  say('If that address has an account, a reset link is on its way. It expires in '
    + '24 hours and only works once.', 'ok');
}

/* ?new=1 opens on the create-account tab; ?reset=1 opens straight on the
   reset state, which is where reset.html sends anyone whose link expired. */
var opening = new URLSearchParams(location.search);
setMode(opening.get('reset') ? 'reset' : opening.get('new') ? 'signup' : 'login');
})();
