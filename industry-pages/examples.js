/* The example websites: /examples, and one made-up business per trade at
 * /examples/<slug>. Built by `node industry-pages/build.js` along with the
 * other generated pages; the content is in examples-data.js.
 *
 * Every example follows the same flow (see examples-data.js) in its own
 * fonts and colours (examples/ex.css). Nothing on an example is a real
 * link: every link and button opens the preview pop-up, which says this
 * is how their site could look and sends them to /join?trade=<key>. The
 * press shows in their journey in the One app, and so does the pop-up's
 * button. The pill at the bottom switches trade, and closes back to /free.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const EXAMPLES = require('./examples-data.js');

const EX_CSS_V = 6;
const EX_JS_V = 3;
const SITE_ID = '9094de37-b610-41b6-98f1-2aaf8f5bd52b';
const ROOT = path.join(__dirname, '..');

const free = (e) => '/free?trade=' + e.key;
const join = (e) => '/join?trade=' + e.key;
const P = '#preview';   // every link on an example opens the pop-up

/* A photo for the hero, once one is in assets/examples/hero/. With a
   <slug>-mobile version beside it, the hero is "split": on a phone the
   words sit on the photo's own plain backdrop with the mobile photo under
   them; on a wide screen the wide photo fills the hero behind the words.
   Without one, the photo sits behind the words, darkened so they read. */
function findImage(name) {
  for (const ext of ['jpg', 'jpeg', 'webp', 'png']) {
    const f = `assets/examples/hero/${name}.${ext}`;
    if (fs.existsSync(path.join(ROOT, f))) return '/' + f;
  }
  return '';
}
const heroImage = (e) => findImage(e.slug);
const heroMobile = (e) => (heroImage(e) ? findImage(e.slug + '-mobile') : '');

/* ------------------------------------------------------------- symbols */
/* The logo: the trade's symbol in a ring, the way our own sites do it. */
const MARK = {
  scissors: '<circle cx="6.5" cy="6.5" r="2.6"/><circle cx="6.5" cy="17.5" r="2.6"/><path d="M8.6 8.1L20 18.5M8.6 15.9L20 5.5"/>',
  lash: '<path d="M3 11c2.5 3.3 5.6 5 9 5s6.5-1.7 9-5"/><path d="M5 13.4L3.6 15.6M8.4 15.3l-.9 2.5M12 16v2.7M15.6 15.3l.9 2.5M19 13.4l1.4 2.2"/>',
  brush: '<path d="M14.5 3.5l6 6-7.5 7.5-6-6z"/><path d="M7 11l6 6-2 2c-1.6 1.6-4.4 1.6-6 0s-1.6-4.4 0-6z"/>',
  polish: '<rect x="6.5" y="10" width="11" height="11" rx="2.5"/><path d="M9.5 10V6.5h5V10M10.5 6.5V3h3v3.5"/>',
  cake: '<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 16c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0"/><path d="M12 12V8"/><path d="M12 3.5c1 1.2 1 2.4 0 3-1-.6-1-1.8 0-3z"/>',
  star: '<path d="M12 3.4l2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 16.2l-5.2 3 1.2-5.8-4.4-4 5.9-.6z"/>',
  bolt: '<path d="M13 2.5L4.5 14H11l-1 7.5L18.5 10H12z"/>',
  flame: '<path d="M12 21c4 0 7-2.8 7-6.8 0-3.6-2.7-6.1-4.2-9.2-.6 2.3-1.8 3.6-3.1 4.2C11 7 10 5 10 3c-3.4 2.4-7 6.3-7 11.2C3 18.2 7 21 12 21z"/>',
  car: '<path d="M4 16v-3.5L6.2 8a2 2 0 0 1 1.8-1h8a2 2 0 0 1 1.8 1L20 12.5V16"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="16" r="1.6"/><circle cx="16.5" cy="16" r="1.6"/>',
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M3.8 10.5h6M14.2 10.5h6M12 14.2v6.3"/>'
};
const mark = (k) => `<span class="x-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${MARK[k] || MARK.star}</svg></span>`;

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/></svg>';
const stars = '<span class="x-stars" aria-label="5 stars">' + STAR.repeat(5) + '</span>';
const CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const strip = (s) => s.replace(/<[^>]+>/g, '');

/* Icing that drips over the edge of a tier: a band across the top with
   drops of uneven lengths hanging from it. */
function drip(x, y, w, n, cls) {
  const step = w / n;
  let d = `M${x} ${y} H${x + w} V${y + 9}`;
  for (let i = n; i > 0; i--) {
    const x1 = x + i * step, mid = x1 - step / 2, len = 8 + ((i * 7) % 5) * 4;
    d += ` Q${(x1 - step * 0.1).toFixed(1)} ${y + 9} ${(mid + step * 0.3).toFixed(1)} ${y + 9 + len * 0.55}`
       + ` Q${mid.toFixed(1)} ${y + 13 + len} ${(mid - step * 0.3).toFixed(1)} ${y + 9 + len * 0.55}`
       + ` Q${(x1 - step * 0.9).toFixed(1)} ${y + 9} ${(x1 - step).toFixed(1)} ${y + 9}`;
  }
  return `<path class="${cls}" d="${d} Z"/>`;
}
/* Lashes along a closed eyelid (a quadratic from a to c through b),
   longest in the middle and sweeping outwards. */
function lashes(a, b, c, n) {
  let out = '';
  for (let i = 1; i < n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0];
    const y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
    const len = 26 + Math.sin(Math.PI * t) * 34;
    const lean = (t - 0.5) * 1.3;
    const ex = x + lean * len, ey = y + len;
    out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + lean * len * 0.2).toFixed(1)} ${(y + len * 0.7).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`;
  }
  return out;
}
const sparkle = (x, y, r, cls) => `<path class="${cls}" d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z"/>`;

/* ---------------------------------------------------------------- art */
/* Drawings for the trades where one says more than a photo would. The
   rest get a photo in the hero (heroImage). */
const ART = {
  cake: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <circle class="f-s" cx="200" cy="205" r="172"/>
    <g opacity=".9"><rect class="f-b" x="62" y="96" width="16" height="6" rx="3" transform="rotate(-30 70 99)"/><rect class="f-c" x="318" y="120" width="16" height="6" rx="3" transform="rotate(25 326 123)"/><rect class="f-a" x="300" y="64" width="14" height="5" rx="2.5" transform="rotate(-50 307 66)"/><rect class="f-c" x="86" y="178" width="14" height="5" rx="2.5" transform="rotate(40 93 180)"/><rect class="f-b" x="330" y="214" width="14" height="5" rx="2.5" transform="rotate(-20 337 216)"/><circle class="f-d" cx="104" cy="64" r="5"/><circle class="f-b" cx="346" cy="170" r="4"/></g>
    <ellipse cx="200" cy="364" rx="58" ry="9" fill="#000" opacity=".06"/>
    <path class="f-w" stroke="rgba(0,0,0,.08)" stroke-width="2" d="M186 334 H214 L222 360 H178 Z"/>
    <ellipse class="f-w" stroke="rgba(0,0,0,.08)" stroke-width="2" cx="200" cy="334" rx="138" ry="13"/>
    <rect class="f-w" stroke="rgba(0,0,0,.09)" stroke-width="2" x="86" y="250" width="228" height="82" rx="14"/>
    ${drip(86, 250, 228, 9, 'f-d')}
    <g class="f-c"><circle cx="112" cy="312" r="5"/><circle cx="142" cy="312" r="5"/><circle cx="172" cy="312" r="5"/><circle cx="202" cy="312" r="5"/><circle cx="232" cy="312" r="5"/><circle cx="262" cy="312" r="5"/><circle cx="292" cy="312" r="5"/></g>
    <rect class="f-d" x="118" y="186" width="164" height="66" rx="12"/>
    ${drip(118, 186, 164, 7, 'f-w')}
    <rect class="f-w" stroke="rgba(0,0,0,.09)" stroke-width="2" x="148" y="128" width="104" height="60" rx="10"/>
    ${drip(148, 128, 104, 5, 'f-b')}
    <circle class="f-a" cx="178" cy="122" r="12"/><circle class="f-a" cx="200" cy="114" r="13"/><circle class="f-a" cx="222" cy="122" r="12"/>
    <path class="f-c" d="M200 101 c4 -12 14 -16 22 -14 c-3 9 -12 15 -22 14z"/>
    <circle fill="#fff" opacity=".55" cx="196" cy="109" r="3.5"/><circle fill="#fff" opacity=".5" cx="174" cy="118" r="3"/>
  </svg>`,

  hair: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <circle class="f-s" cx="200" cy="200" r="172"/>
    <g fill="none" stroke-linecap="round">
      <path class="s-b" stroke-width="46" d="M96 330 C 120 250, 210 268, 208 196 S 270 104, 312 84"/>
      <path class="s-a" stroke-width="22" d="M112 338 C 140 262, 228 280, 226 204 S 284 120, 322 102"/>
      <path stroke="#fff" stroke-opacity=".55" stroke-width="5" d="M104 318 C 130 250, 206 262, 204 200 S 262 112, 300 92"/>
    </g>
    <g transform="rotate(-28 300 288)" fill="none" class="s-i" stroke-width="7" stroke-linecap="round">
      <circle cx="262" cy="270" r="17"/><circle cx="262" cy="318" r="17"/><path d="M276 278 L352 312 M276 310 L352 276"/>
    </g>
    <g transform="rotate(18 110 130)"><rect class="f-a" x="56" y="108" width="112" height="22" rx="8"/><g class="f-a">${Array.from({ length: 11 }, (_, i) => `<rect x="${62 + i * 9.6}" y="126" width="4.6" height="26" rx="2.3"/>`).join('')}</g></g>
    ${sparkle(330, 196, 12, 'f-a')}${sparkle(78, 234, 8, 'f-b')}
  </svg>`,

  lash: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <circle class="f-s" cx="200" cy="200" r="172"/>
    <path fill="none" class="s-b" stroke-width="16" stroke-linecap="round" d="M108 128 Q 206 86 300 136"/>
    <path fill="none" class="s-i" stroke-width="7" stroke-linecap="round" d="M84 200 Q 200 286 316 200"/>
    <g fill="none" class="s-i" stroke-width="5" stroke-linecap="round">${lashes([84, 200], [200, 286], [316, 200], 15)}</g>
    ${sparkle(318, 112, 13, 'f-a')}${sparkle(86, 286, 9, 'f-a')}${sparkle(300, 300, 7, 'f-b')}
  </svg>`,

  mua: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <circle cx="200" cy="200" r="172" fill="#fff" fill-opacity=".05"/><circle cx="200" cy="200" r="172" fill="none" stroke="var(--accent)" stroke-opacity=".45" stroke-width="2"/>
    <rect x="70" y="176" width="260" height="150" rx="24" fill="#fff" fill-opacity=".07" stroke="var(--accent)" stroke-width="2.5"/>
    ${[['#e7c3ae', 112, 222], ['#c98a74', 168, 222], ['#9c5a46', 224, 222], ['#cfa96b', 280, 222], ['#f1d9c7', 112, 280], ['#b46a64', 168, 280], ['#6e3b33', 224, 280], ['#e3b07a', 280, 280]].map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="21" fill="${c}"/><circle cx="${x - 7}" cy="${y - 7}" r="5" fill="#fff" opacity=".35"/>`).join('')}
    <g transform="rotate(-38 230 120)"><rect x="150" y="104" width="150" height="16" rx="8" fill="#2a2320" stroke="var(--accent)" stroke-width="2"/><rect class="f-a" x="290" y="100" width="28" height="24" rx="4"/><path class="f-b" d="M318 100 C 350 96, 372 106, 380 112 C 372 118, 350 128, 318 124 Z"/></g>
    ${sparkle(330, 96, 12, 'f-b')}${sparkle(80, 120, 8, 'f-a')}
  </svg>`,

  nails: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <circle class="f-s" cx="200" cy="200" r="172"/>
    ${[[96, 'f-a', 0], [176, 'f-b', 1], [256, 'f-c', 2]].map(([x, c, i]) => `<g transform="rotate(${(i - 1) * 7} ${x + 24} 300)"><rect class="s-i" x="${x + 10}" y="${150 - i * 6}" width="28" height="${70 + i * 6}" rx="6" fill="#2d1f2b"/><rect class="${c}" x="${x - 6}" y="${214}" width="60" height="96" rx="18"/><rect x="${x + 4}" y="226" width="10" height="64" rx="5" fill="#fff" opacity=".45"/></g>`).join('')}
    <g>${[['f-d', 74, 92, -24], ['f-a', 124, 70, -10], ['f-b', 274, 70, 10], ['f-c', 324, 92, 24]].map(([c, x, y, r]) => `<path class="${c}" transform="rotate(${r} ${x} ${y + 26})" d="M${x - 15} ${y + 52} V${y + 20} C ${x - 15} ${y - 4}, ${x + 15} ${y - 4}, ${x + 15} ${y + 20} V${y + 52} Z"/>`).join('')}</g>
    ${sparkle(200, 92, 14, 'f-a')}${sparkle(344, 210, 9, 'f-d')}${sparkle(58, 214, 8, 'f-b')}
  </svg>`,

  kids: () => `<svg viewBox="0 0 400 420" aria-hidden="true">
    <circle class="f-b" cx="290" cy="110" r="66"/>
    <path class="f-c" d="M0 330 C 80 260, 170 280, 230 320 S 360 300, 400 270 V420 H0Z"/>
    <path class="f-d" opacity=".85" d="M0 370 C 90 330, 190 340, 260 370 S 360 360, 400 345 V420 H0Z"/>
    <circle class="f-a" cx="110" cy="250" r="44"/><path fill="none" stroke="#fff" stroke-width="6" d="M70 240 Q110 270 150 240 M110 206 V294" opacity=".8"/>
    <circle class="f-d" cx="215" cy="300" r="26"/><circle class="f-w" cx="215" cy="300" r="10"/>
    <path class="f-a" d="M60 90 l9 18 20 3 -14 14 3 20 -18 -9 -18 9 3 -20 -14 -14 20 -3z"/>
    <path class="f-c" d="M190 60 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2z"/>
    <rect class="f-d" x="350" y="200" width="16" height="16" rx="3" transform="rotate(20 358 208)"/><rect class="f-a" x="170" y="160" width="12" height="12" rx="3" transform="rotate(-25 176 166)"/>
    <rect class="f-b" x="30" y="180" width="12" height="12" rx="3" transform="rotate(35 36 186)"/>
  </svg>`,

  elec: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <g fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round">
      <path d="M20 90 H120 L150 120 V170"/><path d="M380 70 H300 L270 100"/><path d="M20 310 H110 L140 280"/><path d="M380 300 H290 L260 270 V240"/><path d="M200 20 V70"/><path d="M200 330 V380"/>
    </g>
    <g fill="#fff" fill-opacity=".3"><circle cx="20" cy="90" r="6"/><circle cx="380" cy="70" r="6"/><circle cx="20" cy="310" r="6"/><circle cx="380" cy="300" r="6"/><circle cx="200" cy="20" r="6"/><circle cx="200" cy="380" r="6"/></g>
    <circle cx="200" cy="200" r="118" fill="#fff" fill-opacity=".06"/><circle cx="200" cy="200" r="118" fill="none" stroke="var(--accent)" stroke-opacity=".5" stroke-width="2"/>
    <path class="f-a" d="M222 92 L140 214 H196 L176 308 L262 178 H204 Z"/>
  </svg>`,

  boiler: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="#ffc15e"/></linearGradient></defs>
    <circle cx="200" cy="200" r="150" fill="#fff" fill-opacity=".05"/><circle cx="200" cy="200" r="150" fill="none" stroke="var(--accent)" stroke-opacity=".4" stroke-width="2"/>
    <circle cx="200" cy="200" r="185" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2" stroke-dasharray="4 10"/>
    <path fill="url(#fl)" d="M205 82 C 255 140, 288 182, 274 244 C 263 291, 228 318, 196 318 C 152 318, 120 288, 120 244 C 120 202, 146 175, 164 150 C 166 182, 180 199, 198 196 C 187 157, 187 120, 205 82 Z"/>
    <path fill="#fff" opacity=".85" d="M200 222 C 223 247, 232 263, 225 282 C 220 296, 209 303, 198 303 C 182 303, 170 292, 170 276 C 170 258, 184 244, 200 222 Z"/>
  </svg>`,

  valet: () => `<svg viewBox="0 0 400 320" aria-hidden="true">
    <ellipse cx="200" cy="262" rx="180" ry="18" fill="#000" opacity=".35"/>
    <path fill="#1b2633" stroke="var(--accent)" stroke-width="2.5" d="M40 230 C 40 200, 60 186, 96 180 L 136 130 C 146 118, 160 112, 178 112 H 262 C 282 112, 296 120, 310 136 L 340 176 C 362 180, 372 196, 372 214 V 236 C 372 244, 366 248, 358 248 H 52 C 44 248, 40 242, 40 230 Z"/>
    <path fill="#2a3a4b" d="M150 136 C 156 128, 164 124, 176 124 H 216 V 176 H 112 Z M228 124 H 262 C 276 124, 288 130, 298 142 L 324 176 H 228 Z"/>
    <path fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" d="M70 196 H 330"/>
    <circle cx="112" cy="248" r="32" fill="#0b0f14" stroke="#3a4a5c" stroke-width="6"/><circle cx="112" cy="248" r="12" fill="#56677a"/>
    <circle cx="300" cy="248" r="32" fill="#0b0f14" stroke="#3a4a5c" stroke-width="6"/><circle cx="300" cy="248" r="12" fill="#56677a"/>
    <g fill="#3dd6c4"><path d="M330 40 l6 18 18 6 -18 6 -6 18 -6 -18 -18 -6 18 -6z"/><path d="M80 70 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4z" opacity=".8"/><path d="M250 80 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" opacity=".6"/></g>
    <g fill="#3dd6c4" opacity=".5"><path d="M180 40 c6 9 9 14 9 19 a9 9 0 0 1 -18 0 c0 -5 3 -10 9 -19z"/><path d="M130 30 c4 6 6 9 6 12 a6 6 0 0 1 -12 0 c0 -3 2 -6 6 -12z"/></g>
  </svg>`,

  driving: () => `<svg viewBox="0 0 400 420" aria-hidden="true">
    <path fill="#2f3b35" d="M150 420 C 170 330, 260 300, 270 220 C 278 160, 230 120, 250 0 H 330 C 310 120, 362 170, 350 240 C 336 330, 250 350, 240 420 Z"/>
    <path fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="22 18" d="M195 420 C 215 330, 300 310, 310 230 C 318 165, 270 125, 290 0"/>
    <g transform="rotate(-12 130 170)"><rect x="40" y="80" width="180" height="180" rx="16" fill="#fff" stroke="rgba(0,0,0,.08)" stroke-width="2"/>
    <path class="f-e" d="M98 112 H132 V194 H180 V226 H98 Z"/></g>
    <circle cx="300" cy="330" r="10" class="f-b"/><circle cx="60" cy="350" r="7" class="f-a"/>
  </svg>`
};

/* ------------------------------------------------------------- Dot */
/* Dot, our mascot, leaves a few small notes down each example: what goes
   where on their own site, on the parts that sell (the hero, the services,
   "sound familiar?", the reviews). Not every section; just enough to read
   the page as a preview of theirs. */
const HERO_NOTE = {
  hair: 'Imagine your best colour work here.',
  lash: 'Imagine a close-up of your best set here.',
  mua: 'Imagine your favourite bridal look here.',
  nails: 'Imagine your latest sets here.',
  cake: 'Imagine one of your stunning cakes here.',
  kids: 'Imagine photos of your classes in action here.',
  elec: 'Imagine your van, your team or your best job here.',
  boiler: 'Imagine you on the job here.',
  valet: 'Imagine your best before and after here.',
  driving: 'Imagine you and your car here.'
};
/* Trades that sell to people, whose "sound familiar?" reads as things
   customers say rather than jobs gone wrong. */
const PEOPLE = ['hair', 'lash', 'mua', 'nails', 'cake', 'kids'];
const dotFace = '<span class="k1-dot" aria-hidden="true"><span><i></i><i></i></span></span>';
const note = (text, cls) => `<p class="k1-guide${cls ? ' ' + cls : ''}">${dotFace}<span>${text}</span></p>`;

/* ------------------------------------------------------------ sections */

function hero(e) {
  const h = e.hero, img = heroImage(e), mob = heroMobile(e), art = !img && e.art && ART[e.art];
  const t = e.theme;
  const cls = 'x-hero' + (img ? (mob ? ' has-split' : ' has-photo') : '') + (art ? ' has-art' : '');
  const style = img ? ` style="--hero-img:url('${img}')${mob ? `;--photo-bg:${t.photoBg || '#eeeeee'};--photo-ink:${t.photoInk || t.ink}` : ''}"` : '';
  return `<section class="${cls}"${style}>
  <div class="x-wrap x-hero-in">
    <div class="x-hero-copy">
      <p class="x-status"><span aria-hidden="true"></span>${h.status}</p>
      <h1>${h.h1}</h1>
      <p class="x-sub">${h.sub}</p>
      <a class="x-btn x-btn-hero" href="${P}">${h.cta}</a>
      <ul class="x-risk">${h.risk.map((r) => `<li>${CHECK}<span>${r}</span></li>`).join('')}</ul>
    </div>
    ${art ? `<div class="x-art-wrap"><div class="x-art x-art-${e.art}">${art()}</div>${note(HERO_NOTE[e.key] || 'Imagine your own photos here.', 'k1-guide-hero')}</div>` : ''}
  </div>
  ${mob ? `<img class="x-hero-photo" src="${mob}" alt="" width="1536" height="2048" decoding="async" fetchpriority="high">` : ''}
</section>`;
}

/* Services as cards in a row that swipes on a phone and scrolls with
   arrows on a computer: one card in view at a time reads better than a
   long list, and the next one peeking in says there is more. */
function services(e) {
  const s = e.services;
  return `<section class="x-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    <div class="x-head"><h2>${s.h}</h2><p>${s.sub}</p>${note('Your services and prices, each with a button to book.')}</div>
  </div>
  <div class="x-rail-wrap">
    <div class="x-rail" tabindex="0" aria-label="${strip(s.h)}">${s.items.map(([n, d, pr, t], i) => `<a class="x-card" href="${P}">
      <span class="x-card-art" aria-hidden="true"><span class="x-card-n">${String(i + 1).padStart(2, '0')}</span><span class="x-card-tag">${CAMERA}Your photo</span>${mark(e.icon)}</span>
      <span class="x-card-body"><h3>${n}</h3><p>${d}</p>
      <span class="x-card-foot"><b>${pr}</b><span>${t}</span><em>Book &rsaquo;</em></span></span>
    </a>`).join('')}</div>
    <div class="x-rail-btns x-wrap"><button class="x-rail-btn" type="button" data-rail="-1" aria-label="Previous">&lsaquo;</button><button class="x-rail-btn" type="button" data-rail="1" aria-label="Next">&rsaquo;</button></div>
  </div>
</section>`;
}

function pains(e) {
  const s = e.pains;
  return `<section class="x-sec x-pains-sec" data-k1-seen="the problems">
  <div class="x-wrap">
    <div class="x-head"><h2>${s.h}</h2>${note('Build trust: describe their problem better than they could themselves.')}</div>
    <ul class="x-pains${PEOPLE.includes(e.key) ? ' is-bubbles' : ''}">${s.items.map((t) => `<li><span class="x-pain-ico">${CROSS}</span><span>${t}</span></li>`).join('')}</ul>
  </div>
</section>`;
}

function solution(e) {
  const s = e.solution;
  return `<section class="x-sec x-solution-sec">
  <div class="x-wrap x-solution">
    <div class="x-head"><h2>${s.h}</h2><p>${s.p}</p><a class="x-btn" href="${P}">${e.hero.cta}</a></div>
    <ul class="x-points">${s.items.map(([h, p]) => `<li><span class="x-point-ico">${CHECK}</span><div><h3>${h}</h3><p>${p}</p></div></li>`).join('')}</ul>
  </div>
</section>`;
}

function faq(e) {
  return `<section class="x-sec" id="faq">
  <div class="x-wrap x-faq-wrap">
    <div class="x-head"><h2>Questions</h2><p>Anything else? <a href="${P}">Send us a message</a>.</p></div>
    <div class="x-faq">${e.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
  </div>
</section>`;
}

/* Reviews are placeholders on purpose: on a real site, these are the
   business's own Google reviews. */
function reviews(e) {
  const card = (i) => `<figure class="x-review">${stars}
      <blockquote>A five-star review from one of your ${e.key === 'kids' ? 'parents' : 'customers'} goes here, pulled in from Google.</blockquote>
      <figcaption><span class="x-avatar" aria-hidden="true">${'ABC'[i]}</span><span><b>Customer name</b><small>Google review</small></span></figcaption>
    </figure>`;
  return `<section class="x-sec x-reviews-sec" id="reviews" data-k1-seen="the reviews">
  <div class="x-wrap">
    <div class="x-head"><h2>What ${e.key === 'kids' ? 'parents' : 'customers'} say</h2>
      ${note('Your real Google reviews show here.')}</div>
    <div class="x-reviews">${[0, 1, 2].map(card).join('')}</div>
  </div>
</section>`;
}

function band(e) {
  return `<section class="x-band">
  <div class="x-wrap">
    <h2>${e.band.h}</h2><p>${e.band.p}</p>
    <a class="x-btn x-btn-band" href="${P}">${e.hero.cta}</a>
    <ul class="x-risk">${e.hero.risk.map((r) => `<li>${CHECK}<span>${r}</span></li>`).join('')}</ul>
  </div>
</section>`;
}

function footer(e) {
  return `<footer class="x-foot">
  <div class="x-wrap">
    <a class="x-logo" href="${P}">${mark(e.icon)}<span>${e.name}</span></a>
    <p class="x-foot-addr">${e.address} &middot; ${e.phone}</p>
    <nav class="x-foot-links" aria-label="Footer"><a href="${P}">${e.services.h}</a><a href="${P}">${e.hero.cta}</a><a href="${P}">Contact</a><a href="${P}">Terms &amp; conditions</a><a href="${P}">Privacy policy</a><a href="${P}">Cancellation policy</a></nav>
    <p class="x-credit">&copy; 2026 ${e.name}. All rights reserved.</p>
  </div>
</footer>`;
}

/* ------------------------------------------------- Kanvas One's layer */

function pill(e) {
  const items = EXAMPLES.map((x) => `<a href="/examples/${x.slug}"${x.slug === e.slug ? ' aria-current="page"' : ''}>${x.label}</a>`).join('');
  return `<div class="k1-pill" id="k1Pill">
  <div class="k1-menu" id="k1Menu" hidden>
    <p class="k1-menu-h">See another example</p>
    <div class="k1-menu-list">${items}</div>
    <a class="k1-menu-all" href="/examples">All examples</a>
  </div>
  <button class="k1-switch" id="k1Switch" type="button" aria-expanded="false" aria-controls="k1Menu">
    <span class="k1-logo" aria-hidden="true">one<i>.</i></span><span class="k1-switch-t"><small>Example site</small><b>${e.label}</b></span>
    <svg class="k1-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>
  </button>
  <a class="k1-go" href="${join(e)}">Get yours, &pound;9.99</a>
  <a class="k1-x" href="${free(e)}" aria-label="Close the example"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></a>
</div>`;
}

/* The pop-up every link on the example opens. */
function modal(e) {
  return `<div class="k1-modal" id="k1Modal" hidden>
  <div class="k1-modal-card" role="dialog" aria-modal="true" aria-labelledby="k1ModalH">
    <button class="k1-modal-x" type="button" data-k1-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <span class="k1-face" aria-hidden="true"><span><i></i><i></i></span></span>
    <h2 id="k1ModalH">This site is a preview of how yours might look.</h2>
    <p>We build yours from the page you already have. Like another site&rsquo;s style? Send it too.</p>
    <p class="k1-modal-offer"><b>Live in 24 hours.</b> &pound;9.99 a month, cancel any month.</p>
    <a class="k1-modal-go" href="${join(e)}">Get started</a>
    <button class="k1-modal-keep" type="button" data-k1-close>Keep looking</button>
  </div>
</div>`;
}

function themeCss(t) {
  const v = {
    '--bg': t.bg, '--ink': t.ink, '--muted': t.muted, '--accent': t.accent, '--accent2': t.accent2,
    '--accent3': t.accent3 || t.accent2, '--accent4': t.accent4 || t.accent, '--soft': t.soft, '--surface': t.surface,
    '--accent-text': t.accentText || t.accent, '--line': t.line, '--fh': t.fh, '--fb': t.fb, '--hw': t.hw, '--hls': t.hls, '--radius': t.radius,
    '--btn-radius': t.btnRadius, '--on-accent': t.onAccent, '--hero-bg': t.heroBg, '--hero-ink': t.heroInk,
    '--case': t.upper ? 'uppercase' : 'none'
  };
  return ':root{' + Object.entries(v).map(([k, val]) => k + ':' + val).join(';') + '}';
}

function page(e) {
  const one = strip(e.one).replace(/&rsquo;/g, '’');
  const dark = heroImage(e) ? !heroMobile(e) : Boolean(e.theme.dark);
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Example ${one} website | Kanvas One</title>
<meta name="description" content="What a ${one} website from Kanvas One could look like. Yours built for you and live within 24 hours, £9.99 a month.">
<!-- A made-up business, so it is never offered to someone searching for it. -->
<meta name="robots" content="noindex, follow">
<meta name="theme-color" content="${dark ? '#111111' : e.theme.bg}">
<link rel="icon" href="/assets/favicon.svg?v=4" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${e.fonts}&display=swap">
<link rel="stylesheet" href="/examples/ex.css?v=${EX_CSS_V}">
<style>${themeCss(e.theme)}</style>
</head>
<body class="T-${e.key}${dark ? ' hero-dark' : ''}">
<header class="x-nav" id="xNav">
  <div class="x-wrap x-nav-in">
    <a class="x-logo" href="${P}" aria-label="${strip(e.name)}">${mark(e.icon)}</a>
    <button class="x-burger" type="button" data-preview aria-label="Menu"><span></span><span></span></button>
  </div>
</header>
<main>
${hero(e)}
${services(e)}
${pains(e)}
${solution(e)}
${faq(e)}
${reviews(e)}
${band(e)}
</main>
${footer(e)}
${modal(e)}
${pill(e)}
<script src="/consent.js?v=9"></script>
<script src="/examples/ex.js?v=${EX_JS_V}"></script>
<script src="/beacon.js?v=4" data-site="${SITE_ID}" defer></script>
</body>
</html>
`;
}


/* ------------------------------------------------------ /examples itself */

/* The Kanvas One page around the gallery: the site's own nav and footer,
   with every path absolute, because /examples and /examples/ both reach it. */
function shell(o) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${o.title}</title>
<meta name="description" content="${o.desc}">
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kanvas One">
<meta property="og:image" content="https://kanvas.one/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${o.canonical}">
<link rel="icon" href="/assets/favicon.svg?v=4" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png?v=4" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/favicon-180.png?v=4">
<link rel="stylesheet" href="/styles.css?v=${o.cssV}">
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

<header class="nav" id="nav">
  <div class="nav-inner">
    <a class="logo" href="/" aria-label="Kanvas One — home">one<span class="wm-dot">.</span></a>
    <button class="nav-chat" id="navChat" type="button" aria-label="Chat with us" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z"/></svg></button>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu">
      <span></span><span></span>
    </button>
  </div>
</header>

<div class="menu" id="menu" hidden></div>
<div class="scrim" id="scrim" hidden></div>

<main id="main">
${o.body}
</main>

<footer class="foot">
  <div class="wrap">
    <p class="foot-logo">one<span class="wm-dot">.</span></p>
    <p class="foot-by">by Kanvas</p>
    <nav class="foot-links" aria-label="Footer">
      <a href="/how-it-works.html">How it works</a><a href="/whats-included.html">What&rsquo;s included</a><a href="/features.html">Features</a><a href="/examples">Examples</a><a href="/reviews.html">Reviews</a><a href="/plans.html">Plans</a><a href="/get-started.html">Get started</a>
    </nav>
    <p class="foot-local">Web design in <a href="/web-design-newcastle">Newcastle</a> and <a href="/web-design-northumberland">Northumberland</a>, and websites for small businesses across the UK.</p>
    <nav class="foot-legal-links" aria-label="Legal">
      <a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a><a href="/cookies.html">Cookies</a><a href="/contact.html">Contact</a><button class="linkish-foot" type="button" data-consent-open hidden>Cookie settings</button>
    </nav>
    <p class="foot-legal">All prices in GBP. The price you see is the total price &mdash; we are not VAT registered, so there is no VAT to add. Your site goes live on your own address within 24 hours of joining; the features you ask for are built within 14 days of joining, or your next month is free (see terms). Your web address is included for as long as your plan is active. It is registered and renewed by us on your behalf; if you leave, we transfer it to you. Cancel anytime &mdash; no further payments are taken.</p>
    <p class="foot-copy">&copy; <span id="year">2026</span> Kanvas. All rights reserved.</p>
  </div>
</footer>

<script src="/consent.js?v=9"></script>
<script src="/supabase-config.js?v=1"></script>
<script src="/session.js?v=3"></script>
<script src="/script.js?v=${o.scriptV}"></script>
<script src="/chat.js?v=9" data-site="${SITE_ID}" data-name="Kanvas One" data-edits data-trigger="#navChat" data-full defer></script>
<script src="/beacon.js?v=4" data-site="${SITE_ID}" defer></script>
<script src="/admin-pill.js?v=8"></script>
</body>
</html>
`;
}

function indexPage(v) {
  const cards = EXAMPLES.map((e) => `<a class="exg-card reveal" href="/examples/${e.slug}">
        <span class="exg-shot"><img src="/assets/examples/${e.slug}.jpg" alt="" width="390" height="720" loading="lazy" decoding="async"><span class="exg-peek"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>Preview</span></span>
        <span class="exg-meta"><b>${e.label}</b><span>${e.name}</span></span>
        <span class="exg-go">View example &rsaquo;</span>
      </a>`).join('\n      ');
  return shell({
    cssV: v.cssV, scriptV: v.scriptV,
    title: 'Example Websites for Local Businesses | Kanvas One',
    desc: 'See what your website could look like. Example sites for hairdressers, electricians, cake makers, nail techs and more, then get yours built for you, live within 24 hours.',
    canonical: 'https://kanvas.one/examples',
    body: `<section class="page-hero exg-hero">
  <div class="wrap center">
    <p class="sb-tag reveal">Examples</p>
    <h1 class="reveal">See what yours could <span class="g-free">look like.</span></h1>
    <p class="sub reveal">Example websites for local businesses. Pick yours, have a look around, then get your own: built for you, live within 24 hours.</p>
  </div>
</section>
<section class="section pt0">
  <div class="wrap">
    <div class="exg">
      ${cards}
    </div>
    <div class="exg-end reveal">
      <h2>Don&rsquo;t see your business?</h2>
      <p>We build for every kind of local business. &pound;9.99 a month, live within 24 hours.</p>
      <a class="btn exg-btn" href="/join">Get started</a>
    </div>
  </div>
</section>`
  });
}

function build(OUT, v) {
  const dir = path.join(OUT, 'examples');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  EXAMPLES.forEach((e) => fs.writeFileSync(path.join(dir, e.slug + '.html'), page(e)));
  fs.writeFileSync(path.join(dir, 'index.html'), indexPage(v));
  console.log('examples: ' + EXAMPLES.length + ' sites + /examples');
}

module.exports = { build, EXAMPLES };
