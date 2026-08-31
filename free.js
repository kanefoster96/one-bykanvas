/* one — the free example offer.
 *
 * Three things typed and one thing chosen. The choosing is the point: picking
 * an address that is genuinely free is what turns "a website, one day" into
 * "my website", and somebody who has named theirs is a different prospect from
 * somebody who has read about ours.
 *
 * Nothing here reserves anything. Suggestions come from api/domains.js, which
 * asks the registries over RDAP - so a name is never handed to a registrar who
 * might go and register it - and the page says plainly that it is first come,
 * first served until a plan starts. Getting that wrong would mean somebody's
 * first real experience of us is losing the name we let them believe was
 * theirs.
 */
(function () {
  'use strict';

  var form = document.getElementById('offer');
  if (!form) return;

  var business = document.getElementById('business');
  var email    = document.getElementById('email');
  var handle   = document.getElementById('handle');
  var hp       = document.getElementById('offer_website');
  var btn      = document.getElementById('offerSend');
  var note     = document.getElementById('offerNote');

  var field = document.getElementById('domainField');
  var list  = document.getElementById('domainList');
  var dnote = document.getElementById('domainNote');

  var shownAt = Date.now();
  var picked = '';
  var lastAsked = '';

  function say(msg, kind) {
    note.textContent = msg || '';
    note.className = 'note' + (kind ? ' ' + kind : '');
  }

  /* ---------------------------------------------------------- the picker */

  function row(domain) {
    var label = document.createElement('label');
    label.className = 'pick-row';

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'domain';
    input.value = domain;
    input.addEventListener('change', function () {
      picked = domain;
      [].forEach.call(list.querySelectorAll('.pick-row'), function (r) {
        r.classList.remove('is-on');
      });
      label.classList.add('is-on');
      dnote.textContent = domain + ' is free right now. We’ll use it for your '
        + 'example. It’s yours once you join — until then anyone can take it.';
    });

    var text = document.createElement('span');
    text.className = 'pick-name';
    text.textContent = domain;

    label.appendChild(input);
    label.appendChild(text);
    return label;
  }

  function clearPicker() {
    list.textContent = '';
    picked = '';
    dnote.textContent = '';
  }

  async function suggest() {
    var name = business.value.trim();
    /* Nothing to go on, or nothing new since the last look. */
    if (name.length < 2 || name === lastAsked) return;
    lastAsked = name;

    field.hidden = false;
    clearPicker();
    dnote.textContent = 'Looking…';

    var data;
    try {
      var res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', business: name })
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not check just now.');
    } catch (e) {
      /* The address is a bonus, never a blocker: the form still sends without
         one, so a registry being down must not stop somebody asking. */
      dnote.textContent = 'We couldn’t check addresses just now. Send the form '
        + 'anyway and we’ll find you one.';
      return;
    }

    var found = (data && data.suggestions) || [];
    if (!found.length) {
      dnote.textContent = data && data.reachable === false
        ? 'We couldn’t check addresses just now. Send the form anyway and we’ll '
          + 'find you one.'
        : 'Nothing free for that name yet. Send the form anyway and we’ll find '
          + 'you some.';
      return;
    }

    dnote.textContent = 'Pick one, or leave it to us.';
    found.forEach(function (d) { list.appendChild(row(d)); });
  }

  /* Once they have moved on from the name, not on every keystroke: each look
     is up to eight registry lookups. */
  business.addEventListener('blur', suggest);
  business.addEventListener('change', suggest);

  /* --------------------------------------------------------------- submit */

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var biz  = business.value.trim();
    var mail = email.value.trim();
    var soc  = handle.value.trim();

    if (!biz)  return say('Tell us your business name.', 'bad');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return say('Enter a valid email address.', 'bad');
    if (!soc)  return say('Add your Instagram or Facebook.', 'bad');

    btn.disabled = true;
    say('Sending…');

    try {
      var res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'free-preview',
          /* The endpoint wants a name; on this form the business is all we
             ask for, so it stands in rather than making them type twice. */
          name: biz,
          business: biz,
          email: mail,
          handle: soc,
          domain: picked,
          website: hp ? hp.value : '',
          elapsed: Date.now() - shownAt
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');

      form.reset();
      clearPicker();
      field.hidden = true;
      say('Got it. We’ll email your example to ' + mail + '.', 'ok');
      btn.textContent = 'Sent';

      if (window.oneTrack) window.oneTrack('Lead', { content_category: 'free-preview' });
      return;                       /* nothing left to re-enable */
    } catch (err) {
      say(err.message || 'Could not send that. Try again.', 'bad');
      btn.disabled = false;
    }
  });
})();
