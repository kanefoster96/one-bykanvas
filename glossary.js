/* Plain-English explanations for the techy words on the site.
 *
 * Mark a word in any page:
 *   <button type="button" class="gl" data-gl="seo">SEO</button>
 * It gets a dotted underline, and tapping it opens a small card with what
 * the word means, written for someone who has never needed to know. One
 * card is open at a time; tapping outside, tapping the word again or
 * pressing Escape closes it. Carries its own styles, so it works on every
 * page whatever stylesheet it uses. A word missing from the list below is
 * left as plain text.
 */
(function () {
  var WORDS = {
    seo: {
      title: 'SEO',
      text: 'Short for search engine optimisation: setting up your website so Google shows it when local parents search for things like “dance classes near me”. We do it for you and keep it up to date.'
    },
    aeo: {
      title: 'AEO',
      text: 'Short for answer engine optimisation: the same idea for AI tools like ChatGPT and Google’s AI answers. When a parent asks one “what are the best kids’ clubs near me?”, we make sure the answer can include you.'
    },
    gbp: {
      title: 'Google Business Profile',
      text: 'Your free listing on Google Maps and Google search: your address, opening times, photos and reviews. Often the first thing a parent sees, so we set it up and keep it current.'
    },
    meta: {
      title: 'Meta',
      text: 'The company that owns Facebook and Instagram. Ads on both are bought from Meta, so any ad budget you choose is paid to them directly, not to us.'
    },
    adaccount: {
      title: 'Ad account',
      text: 'Your own account with Meta for paying for Facebook and Instagram ads. It stays in your name, with your card on it; we just have access to run the ads.'
    },
    creative: {
      title: 'Creative',
      text: 'The pictures, videos and words in an ad. People stop noticing an ad after seeing it a few times, so we change them regularly to keep it working.'
    },
    stripe: {
      title: 'Stripe',
      text: 'The secure card payment company behind your memberships. Members pay by card or Apple Pay, and the money goes straight to your bank, never through us.'
    },
    pwa: {
      title: 'Web app',
      text: 'An app that runs from your website, so it works on any phone straight away, with nothing to download, while the App Store and Google Play versions are being approved.'
    }
  };

  var css = ''
    + '.gl{all:unset;display:inline;cursor:pointer;color:inherit;font:inherit;line-height:inherit;'
    + 'text-decoration:underline dotted;text-decoration-thickness:1.5px;text-underline-offset:3px;'
    + 'text-decoration-color:currentColor;-webkit-tap-highlight-color:transparent;border-radius:3px}'
    + '.gl:hover{text-decoration-color:#ff4f12}'
    + '.gl:focus-visible{outline:2px solid #ff4f12;outline-offset:2px}'
    + '.gl[aria-expanded="true"]{text-decoration-style:solid;text-decoration-color:#ff4f12}'
    + '.gl-card{position:absolute;z-index:2147483000;max-width:min(320px,calc(100vw - 32px));box-sizing:border-box;'
    + 'padding:14px 16px 15px;border-radius:16px;background:#fff;color:#1d1d1f;text-align:left;'
    + 'border:1px solid rgba(255,79,18,.45);box-shadow:0 14px 40px rgba(0,0,0,.22);'
    + 'font:400 14.5px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;'
    + 'animation:gl-in .16s ease-out}'
    + '.gl-card b{display:block;margin-bottom:4px;font-size:15px;font-weight:700;color:#c93e09}'
    + '@keyframes gl-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'
    + '@media (prefers-reduced-motion:reduce){.gl-card{animation:none}}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var card = null, openOn = null;

  function close() {
    if (card) card.remove();
    if (openOn) openOn.setAttribute('aria-expanded', 'false');
    card = null; openOn = null;
  }

  function open(btn) {
    var word = WORDS[btn.getAttribute('data-gl')];
    if (!word) return;
    close();
    card = document.createElement('div');
    card.className = 'gl-card';
    card.id = 'gl-card';
    card.setAttribute('role', 'note');
    var t = document.createElement('b'); t.textContent = word.title;
    card.appendChild(t);
    card.appendChild(document.createTextNode(word.text));
    document.body.appendChild(card);
    openOn = btn;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', 'gl-card');
    place(btn);
  }

  // Under the word, kept 16px inside the screen; above it if there's no room below.
  function place(btn) {
    var r = btn.getBoundingClientRect();
    var w = card.offsetWidth, h = card.offsetHeight;
    var left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 16);
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    card.style.left = (left + window.scrollX) + 'px';
    card.style.top = (top + window.scrollY) + 'px';
  }

  function setUp(btn) {
    if (btn.dataset.glReady) return;
    btn.dataset.glReady = '1';
    if (btn.tagName !== 'BUTTON') { btn.setAttribute('role', 'button'); btn.tabIndex = 0; }
    btn.setAttribute('aria-expanded', 'false');
    var word = WORDS[btn.getAttribute('data-gl')];
    if (word) btn.setAttribute('aria-label', btn.textContent.trim() + ': what this means');
  }

  document.querySelectorAll('.gl').forEach(setUp);

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.gl');
    if (btn) {
      // A marked word inside a question's heading must not open or close the question.
      e.preventDefault(); e.stopPropagation();
      setUp(btn);
      if (openOn === btn) close(); else open(btn);
      return;
    }
    if (card && !card.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && card) { var b = openOn; close(); if (b) b.focus(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gl') && e.target.tagName !== 'BUTTON') {
      e.preventDefault(); e.target.click();
    }
  });
  window.addEventListener('resize', close);
})();
