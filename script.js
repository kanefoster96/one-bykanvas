/* one — by Kanvas */
(function () {
  'use strict';

  /* ---------- Hamburger menu ---------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  var scrim = document.getElementById('scrim');

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    scrim.hidden = !open;
    menu.classList.toggle('open', open);
    document.body.classList.toggle('locked', open);
  }

  burger.addEventListener('click', function () {
    setMenu(burger.getAttribute('aria-expanded') !== 'true');
  });
  scrim.addEventListener('click', function () { setMenu(false); });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      burger.focus();
    }
  });

  /* ---------- Scroll reveal ---------- */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Review rail ---------- */
  var rail = document.getElementById('rail');
  document.querySelectorAll('.rail-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = rail.querySelector('.quote');
      var step = card ? card.offsetWidth + 20 : rail.clientWidth * 0.8;
      rail.scrollBy({ left: step * Number(btn.dataset.dir), behavior: 'smooth' });
    });
  });

  /* ---------- FAQ: one open at a time ---------- */
  var faqs = document.querySelectorAll('.faq details');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqs.forEach(function (other) { if (other !== d) other.open = false; });
    });
  });

  /* ---------- Lead form ---------- */
  var form = document.getElementById('lead');
  var note = document.getElementById('formnote');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var required = ['name', 'business', 'email'];
    var bad = false;

    required.forEach(function (id) {
      var el = document.getElementById(id);
      var ok = el.value.trim() !== '';
      if (id === 'email') ok = ok && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
      el.classList.toggle('err', !ok);
      if (!ok && !bad) { el.focus(); bad = true; }
    });

    if (bad) {
      note.textContent = 'Please fill in your name, business and a valid email.';
      note.className = 'formnote bad';
      return;
    }

    // TODO: point this at a real endpoint (Formspree, a Vercel function, or your CRM).
    var payload = {
      name: document.getElementById('name').value.trim(),
      business: document.getElementById('business').value.trim(),
      email: document.getElementById('email').value.trim(),
      plan: document.getElementById('plan').value,
      about: document.getElementById('about').value.trim()
    };
    console.log('Lead captured (not yet sent anywhere):', payload);

    note.textContent = 'Thanks — we’ll be in touch within one working day.';
    note.className = 'formnote ok';
    form.reset();
  });

  /* ---------- Year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
