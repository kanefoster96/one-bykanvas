/* A "are you sure?" sheet, for anything that changes or removes a request.
 *
 *   ONE.confirm({ title, body, ok, cancel, danger }).then(function (yes) { ... })
 *
 * Slides up from the bottom like the phone's own action sheets: the action
 * on top (red when it removes something), the way out underneath. Escape,
 * a tap outside or the second button all mean no. Used by requests.js (in
 * the app and on requests.html) and the app's Build tab.
 */
(function () {
  window.ONE = window.ONE || {};

  ONE.confirm = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var opener = document.activeElement;
      var back = document.createElement('div');
      back.className = 'cf-back';
      var box = document.createElement('div');
      box.className = 'cf-box';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      var h = document.createElement('h2');
      h.className = 'cf-title';
      h.id = 'cf-title-' + Date.now();
      h.textContent = o.title || 'Are you sure?';
      box.setAttribute('aria-labelledby', h.id);
      box.appendChild(h);
      if (o.body) {
        var p = document.createElement('p');
        p.className = 'cf-body';
        p.textContent = o.body;
        box.appendChild(p);
      }
      var yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'cf-btn cf-yes' + (o.danger ? ' is-danger' : '');
      yes.textContent = o.ok || 'Yes';
      var no = document.createElement('button');
      no.type = 'button';
      no.className = 'cf-btn cf-no';
      no.textContent = o.cancel || 'Cancel';
      box.appendChild(yes);
      box.appendChild(no);
      back.appendChild(box);
      document.body.appendChild(back);
      requestAnimationFrame(function () { back.classList.add('is-in'); });

      var done = false;
      function close(answer) {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        back.classList.remove('is-in');
        setTimeout(function () { back.remove(); }, 180);
        if (opener && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
        resolve(answer);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        if (e.key === 'Tab') { // keep focus on the two buttons
          e.preventDefault();
          (document.activeElement === yes ? no : yes).focus();
        }
      }
      yes.addEventListener('click', function () { close(true); });
      no.addEventListener('click', function () { close(false); });
      back.addEventListener('click', function (e) { if (e.target === back) close(false); });
      document.addEventListener('keydown', onKey, true);
      // The safe choice has focus, so a stray Enter never removes anything.
      (o.danger ? no : yes).focus();
    });
  };
})();
