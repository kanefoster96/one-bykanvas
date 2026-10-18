/* Plain-English explanations for the techy words on the site.
 *
 * Words in the list below are found in the page's text and get a dotted
 * underline: the first time each appears in a section (so a page isn't
 * covered in lines), never inside links, buttons, headings, menus, the
 * footer, question headings, the phone mock-ups or the chat. Tapping one
 * opens a small card with what it means, written for someone who has never
 * needed to know. One card is open at a time; tapping outside, tapping the
 * word again or pressing Escape closes it.
 *
 * A word can also be marked by hand, and a word that is only marked by hand
 * (auto: false) never gets an underline on its own:
 *   <button type="button" class="gl" data-gl="seo">SEO</button>
 * Leave a part of a page alone with data-no-gl.
 *
 * Carries its own styles, so it works on every page whatever stylesheet it
 * uses. Loaded on the public pages, not the app, admin or checkout.
 */
(function () {
  // match: the words in the text this explains (case-sensitive unless the
  // pattern says otherwise).
  var WORDS = {
    seo: { match: /\bSEO\b/, title: 'SEO',
      text: 'Short for search engine optimisation: setting up your website so Google shows it when local parents search for things like “dance classes near me”. We do it for you and keep it up to date.' },
    aeo: { match: /\bAEO\b/, title: 'AEO',
      text: 'Short for answer engine optimisation: the same idea for AI tools like ChatGPT and Google’s AI answers. When a parent asks one “what are the best kids’ clubs near me?”, we make sure the answer can include you.' },
    aisearch: { match: /\bAI search\b/i, title: 'AI search',
      text: 'More and more parents ask ChatGPT, Google’s AI answers and similar tools instead of scrolling through a list of websites. Your site is set up so those tools understand it and can recommend you.' },
    gbp: { match: /\bGoogle (?:Business )?[Pp]rofile\b/, title: 'Google Business Profile',
      text: 'Your free listing on Google Maps and Google search: your address, opening times, photos and reviews. Often the first thing a parent sees, so we set it up and keep it current.' },
    googlereviews: { match: /\bGoogle reviews\b/i, title: 'Google reviews',
      text: 'The star ratings and comments people leave on your Google listing. More good reviews means more parents trust you and Google shows you higher, so the system asks happy families for one at the right moment.' },
    meta: { match: /\bMeta\b/, title: 'Meta',
      text: 'The company that owns Facebook and Instagram. Ads on both are bought from Meta, so any ad budget you choose is paid to them directly, not to us.' },
    adaccount: { match: /\bad accounts?\b/i, title: 'Ad account',
      text: 'Your own account with Meta for paying for Facebook and Instagram ads. It stays in your name, with your card on it; we just have access to run the ads.' },
    adspend: { match: /\bad spend\b/i, title: 'Ad spend',
      text: 'The money paid to Facebook and Instagram to show your ads. It’s separate from what you pay us, and you choose how much.' },
    pixel: { match: /\b(?:Meta )?pixel\b/i, title: 'Pixel',
      text: 'A small piece of code on your website that tells Facebook and Instagram when someone books a trial, so your ads learn who to show to next. It only counts visits; it never sees card details.' },
    costper: { match: /\bcost per (?:trial|lead|enquiry|booking|member|customer|result)\b/i, title: 'Cost per trial',
      text: 'What you spent on ads divided by the number of bookings they brought. If £100 of ads brings 10 trials, that’s £10 per trial. It’s the number that tells you whether the ads are worth it.' },
    creative: { auto: false, title: 'Creative',
      text: 'The pictures, videos and words in an ad. People stop noticing an ad after seeing it a few times, so we change them regularly to keep it working.' },
    stripe: { match: /\bStripe\b/, title: 'Stripe',
      text: 'The secure card payment company behind your memberships, used by millions of businesses. Members pay by card, Apple Pay or Google Pay, and the money goes straight to your bank, never through us.' },
    webaddress: { match: /\bweb address(?:es)?\b|\bdomain(?: name)?s?\b/i, title: 'Web address',
      text: 'Your website’s name on the internet, like yourclub.co.uk. Also called a domain. It’s registered in your business’s name and renewed for you.' },
    hosting: { match: /\bhosting\b/i, title: 'Hosting',
      text: 'The computers that keep your website online day and night so anyone can visit it. Included, looked after and kept secure for you, so there’s nothing to set up or pay separately.' },
    livechat: { match: /\blive chat\b/i, title: 'Live chat',
      text: 'A chat box on your website where visitors can message you there and then. Replies go to your phone, and if they leave, the conversation carries on by email.' },
    missedcall: { match: /\bmissed-call text back\b/i, title: 'Missed-call text back',
      text: 'If you can’t answer the phone (mid-class, say), the caller gets a text straight away with a link to book, so you don’t lose the family to the next club on Google.' },
    dashboard: { match: /\bdashboard\b/i, title: 'Dashboard',
      text: 'One screen, in your app and on your website, showing what matters today: trials booked, new members, payments and messages.' },
    businessemail: { match: /\bbusiness email\b/i, title: 'Business email',
      text: 'An email address at your own web address, like hello@yourclub.co.uk, instead of a Gmail or Hotmail one. It looks more professional and parents trust it more.' },
    devaccount: { match: /\bdeveloper accounts?\b/i, title: 'Developer accounts',
      text: 'The accounts Apple and Google need before an app can go in the App Store and Google Play under your club’s name. They’re in your name and paid to Apple and Google directly; we walk you through setting them up.' },
    launchboost: { match: /\bLaunch Boost\b/, title: 'Launch Boost',
      text: 'Our bonus when you pay for the year: your first month after going live is spent getting you found on Google, so the site starts bringing people in straight away.' },
    upsell: { match: /\bupsells?\b/i, title: 'Upsell',
      text: 'Offering a customer something extra at the right moment, like a second class or a uniform when they join. Done automatically, so it never feels pushy.' },
    qr: { match: /\bQR(?: code)?s?\b/, title: 'QR code',
      text: 'A square barcode that a phone camera can read. Each member has one in the app, and you scan it at the door to mark them in, so there’s no paper register.' },
    push: { match: /\bpush notifications?\b/i, title: 'Push notification',
      text: 'A message that pops up on a member’s phone from your app, like a text but free, for class changes, reminders and news.' },
    analytics: { match: /\banalytics\b/i, title: 'Analytics',
      text: 'Numbers about your website and ads: how many people visited, where they came from and how many booked. Shown plainly, so you can see what’s working.' },
    pwa: { auto: false, title: 'Web app',
      text: 'An app that runs from your website, so it works on any phone straight away, with nothing to download, while the App Store and Google Play versions are being approved.' }
  };

  // Never underline inside these (links and buttons already do something;
  // headings and menus stay clean; the phone mock-ups and chat are pictures
  // of other things).
  var SKIP = 'a,button,summary,label,input,textarea,select,option,h1,h2,h3,h4,nav,header,footer,script,style,noscript,svg,code,pre,'
    + '[aria-hidden="true"],[data-no-gl],[contenteditable],.gl,.gl-card,.pr-tag,.price,[class*="consent"],[id*="consent"],[class*="k1c"],[class*="k1s"],.mh-phone,.ap-hp';

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

  /* ---- Finding the words ---- */

  function sectionOf(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    return (el && el.closest('section,article,main,details,dialog')) || document.body;
  }

  function markText() {
    var auto = Object.keys(WORDS).filter(function (k) { return WORDS[k].match && WORDS[k].auto !== false; });
    var seen = new Map(); // section -> {key: true}
    function done(section) { if (!seen.has(section)) seen.set(section, {}); return seen.get(section); }
    // Words already marked by hand count as shown in their section.
    document.querySelectorAll('.gl[data-gl]').forEach(function (b) { done(sectionOf(b))[b.getAttribute('data-gl')] = true; });

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        return p && !p.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
      var marks = done(sectionOf(node));
      var text = node.nodeValue, hits = [];
      auto.forEach(function (k) {
        if (marks[k]) return;
        var m = WORDS[k].match.exec(text);
        if (m && !hits.some(function (h) { return m.index < h.end && m.index + m[0].length > h.start; })) {
          hits.push({ key: k, start: m.index, end: m.index + m[0].length, word: m[0] });
          marks[k] = true;
        }
      });
      if (!hits.length) return;
      hits.sort(function (a, b) { return a.start - b.start; });
      var frag = document.createDocumentFragment(), at = 0;
      hits.forEach(function (h) {
        if (h.start > at) frag.appendChild(document.createTextNode(text.slice(at, h.start)));
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'gl'; b.setAttribute('data-gl', h.key); b.textContent = h.word;
        frag.appendChild(b);
        at = h.end;
      });
      if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* ---- The card ---- */

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
    var word = WORDS[btn.getAttribute('data-gl')];
    if (!word) { btn.replaceWith(document.createTextNode(btn.textContent)); return; }
    if (btn.tagName !== 'BUTTON') { btn.setAttribute('role', 'button'); btn.tabIndex = 0; }
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', btn.textContent.trim() + ': what this means');
  }

  function start() {
    try { markText(); } catch (e) { /* an odd page shouldn't break the rest */ }
    document.querySelectorAll('.gl').forEach(setUp);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.gl');
    if (btn) {
      // A marked word inside a question must not open or close the question.
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
