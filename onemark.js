/* The One wordmark in running text.
   Wherever a sentence names the product, "One" gets the same orange gradient
   full stop as the logo, so it reads as a name, not a stray word. Common
   phrases that just mean "one" ("One price", "One system", "one or two")
   and the company name "Kanvas One" are left alone. Runs on load and on
   anything added later, like the plan result text. */
(function () {
  if (window.__oneMark) return; window.__oneMark = true;

  var css = '.one-n{white-space:nowrap}' +
    '.one-n i{font-style:normal;padding-right:.12em;margin-right:-.12em;' +
    'background:linear-gradient(90deg,#c93e09 0%,#ff4f12 100%);-webkit-background-clip:text;background-clip:text;' +
    'color:transparent;-webkit-text-fill-color:transparent}' +
    /* on solid orange cards the orange dot would vanish, so it goes light there */
    '.pr-item .one-n i,.fx-card .one-n i,.ev-card .one-n i,.on-orange .one-n i{background:none;color:#ffd9c7;-webkit-text-fill-color:#ffd9c7}' +
    '@media (forced-colors:active){.one-n i{background:none;color:CanvasText;-webkit-text-fill-color:CanvasText}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|TITLE|CODE|PRE|SVG|BUTTON)$/;
  // "One" followed by these words means the number, not the product.
  var PLAIN = /^\s*(system|price|place|tap|fixed|or|of|simple|page|login|app for|thing|timetable)\b/i;
  var WORD = /\bOne\b(?![-\u2010\u2011'\u2019])/g;

  function skippable(el) {
    for (; el && el !== document.body; el = el.parentElement) {
      if (SKIP.test(el.nodeName)) return true;
      if (el.classList && (el.classList.contains('one-n') || el.classList.contains('logo') || el.classList.contains('btn'))) return true;
      if (el.hasAttribute && el.hasAttribute('data-no-onemark')) return true;
      if (el.isContentEditable) return true;
    }
    return false;
  }

  function mark(node) {
    var text = node.nodeValue;
    if (!text || text.indexOf('One') < 0 || skippable(node.parentElement)) return;
    var parts = [], last = 0, m, hit = false;
    WORD.lastIndex = 0;
    while ((m = WORD.exec(text))) {
      var before = text.slice(0, m.index), after = text.slice(m.index + 3);
      if (/Kanvas\s$/.test(before) || PLAIN.test(after)) continue;
      hit = true;
      parts.push(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement('span'); span.className = 'one-n';
      var dot = document.createElement('i');
      // At the end of a sentence the orange dot is the full stop itself.
      if (after.charAt(0) === '.') { dot.textContent = '.'; last = m.index + 4; }
      else { dot.textContent = '.'; dot.setAttribute('aria-hidden', 'true'); last = m.index + 3; }
      span.appendChild(document.createTextNode('One')); span.appendChild(dot);
      parts.push(span);
    }
    if (!hit) return;
    parts.push(document.createTextNode(text.slice(last)));
    var frag = document.createDocumentFragment();
    parts.forEach(function (p) { if (p.nodeType !== 3 || p.nodeValue) frag.appendChild(p); });
    node.parentNode.replaceChild(frag, node);
  }

  function walk(root) {
    if (root.nodeType === 3) { mark(root); return; }
    if (root.nodeType !== 1 || skippable(root)) return;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(mark);
  }

  function start() {
    walk(document.body);
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        if (mu.type === 'characterData') mark(mu.target);
        else mu.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
