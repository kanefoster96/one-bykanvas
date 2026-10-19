/* The Learning Centre's behaviour: timelines lighting up one step at a time
   when they come into view, the other figures (bars, chains, comparisons,
   phones) animating once as they arrive, and the front page's search and
   topic filter. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  [].forEach.call(document.querySelectorAll('[data-lc-flow]'), function (list) {
    var steps = [].slice.call(list.children);
    if (reduce || !('IntersectionObserver' in window)) { steps.forEach(function (s) { s.classList.add('on'); }); return; }
    var timer = null;
    function play() {
      steps.forEach(function (s) { s.classList.remove('on'); });
      var i = 0;
      clearInterval(timer);
      timer = setInterval(function () {
        if (i < steps.length) { steps[i].classList.add('on'); i++; }
        else if (i++ > steps.length + 3) { play(); }
      }, 900);
    }
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!timer) play(); }
      else { clearInterval(timer); timer = null; steps.forEach(function (s) { s.classList.add('on'); }); }
    }, { threshold: 0.3 }).observe(list);
  });

  // Every other figure animates once, when it first comes into view.
  var figs = [].slice.call(document.querySelectorAll('[data-lc-in]'));
  if (reduce || !('IntersectionObserver' in window)) figs.forEach(function (f) { f.classList.add('in'); });
  else {
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { threshold: 0.25 });
    figs.forEach(function (f) { seen.observe(f); });
  }

  var input = document.getElementById('lcSearch');
  var cards = [].slice.call(document.querySelectorAll('#lcCards .lc-card'));
  var none = document.getElementById('lcNone');
  var btns = [].slice.call(document.querySelectorAll('.lc-topics button'));
  if (!cards.length) return;
  var topic = '';
  function apply() {
    var q = (input && input.value || '').trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!topic || c.getAttribute('data-topic') === topic) && (!q || q.split(/\s+/).every(function (w) { return c.getAttribute('data-text').indexOf(w) > -1; }));
      c.hidden = !ok; if (ok) shown++;
    });
    if (none) none.hidden = shown > 0;
  }
  if (input) input.addEventListener('input', apply);
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      topic = b.getAttribute('data-topic');
      btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      apply();
    });
  });
})();
