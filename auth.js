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
  tabLogin.classList.toggle('is-on', !signup);
  tabSignup.classList.toggle('is-on', signup);
  tabLogin.setAttribute('aria-selected', String(!signup));
  tabSignup.setAttribute('aria-selected', String(signup));
  title.textContent = signup ? 'Create your account' : 'Log in';
  subtitle.textContent = signup
    ? 'A few details now saves us asking later.'
    : 'Welcome back.';
  submit.textContent = signup ? 'Create account' : 'Log in';
  password.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  document.querySelectorAll('.signup-only').forEach(function (el) { el.hidden = !signup; });
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
  submit.textContent = on ? label : (mode === 'signup' ? 'Create account' : 'Log in');
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!ONE.requireConfig(note)) return;

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

document.getElementById('forgot').addEventListener('click', async function () {
  if (!ONE.requireConfig(note)) return;
  var email = document.getElementById('email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return say('Type your email address above first, then tap this again.', 'bad');
  }
  var res = await ONE.db.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/account.html'
  });
  if (res.error) return say(ONE.friendlyError(res.error), 'bad');
  say('If that email has an account, a reset link is on its way.', 'ok');
});

/* /login.html?new=1 opens straight on the create-account tab. */
setMode(new URLSearchParams(location.search).get('new') ? 'signup' : 'login');
})();
