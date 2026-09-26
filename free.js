/* one — the free example offer.
 *
 * Three things typed, nothing chosen: business name, email, and a link to
 * the business anywhere online. The promise on the page is a page in their
 * inbox within 24 hours, so the form asks for the least that lets that be
 * kept. Posts to the same /api/lead as the homepage mini form and lands on
 * the same thanks page.
 */
(function () {
  'use strict';

  var form = document.getElementById('offer');
  if (!form) return;

  var business = document.getElementById('business');
  var email    = document.getElementById('email');
  var handle   = document.getElementById('handle');
  var hp       = document.getElementById('offer_extra');
  var btn      = document.getElementById('offerSend');
  var note     = document.getElementById('offerNote');

  var shownAt = Date.now();

  function say(msg, kind) {
    note.textContent = msg || '';
    note.className = 'note' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var biz  = business.value.trim();
    var mail = email.value.trim();
    var soc  = handle.value.trim();

    if (!biz)  return say('Tell us your business name.', 'bad');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return say('Enter a valid email address.', 'bad');
    if (!soc)  return say('Add a link to your business anywhere online - Instagram, Facebook, anything.', 'bad');

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
          campaign: (window.oneFrom && window.oneFrom()) || '',
          website: hp ? hp.value : '',
          elapsed: Date.now() - shownAt
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');

      /* Handed over rather than kept, so the address never rides in the URL.
         The confirmation page uses it to say where the email is going, and
         its presence is also what tells that page a real submission happened
         rather than somebody arriving on the link. The id lets that page
         fire the same Lead event the server did. */
      try {
        sessionStorage.setItem('one.free-requested', JSON.stringify({ email: mail, id: data.id || '' }));
      } catch (e) { /* private mode: the page just says less */ }

      form.reset();
      location.assign('/thanks.html');
      return;                       /* leaving; nothing to re-enable */
    } catch (err) {
      say(err.message || 'Could not send that. Try again.', 'bad');
      btn.disabled = false;
    }
  });
})();
