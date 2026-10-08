/* one — the homepage hero.
 *
 * One row: the business name, Title Cased as it is typed, and the arrow
 * goes straight into the join page with the name filled in. join.js takes
 * it from there (email, web address, the page they are online at, payment).
 */
(function () {
  'use strict';

  var form = document.getElementById('newFree');
  if (!form) return;
  var name = document.getElementById('newName');
  var note = document.getElementById('newNote');

  function say(msg, kind) { note.textContent = msg || ''; note.className = 'note' + (kind ? ' ' + kind : ''); }

  /* ---- the name, Title Cased as typed ---- */
  function titleCase(s) { return s.replace(/(^|[\s\-'&(]+)([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); }); }
  name.addEventListener('input', function () {
    var pos = name.selectionStart, was = name.value, now = titleCase(was);
    if (now !== was) { name.value = now; try { name.setSelectionRange(pos, pos); } catch (e) { /* not settable here */ } }
    name.classList.remove('err');
    say('');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (name.value.trim().length < 2) { name.classList.add('err'); name.focus(); say('Tell us your business name.', 'bad'); return; }
    location.assign('/join?business=' + encodeURIComponent(name.value.trim()));
  });

  /* The close of the page points back at the box. */
  document.querySelectorAll('[data-to-form]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { name.focus({ preventScroll: true }); }, 500);
    });
  });
})();
