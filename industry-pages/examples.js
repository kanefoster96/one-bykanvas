/* The example websites: /examples, and one made-up business per trade at
 * /examples/<slug>. Built by `node industry-pages/build.js` along with the
 * other generated pages; the content is in examples-data.js.
 *
 * Every example tells the same story (see examples-data.js), but each
 * trade has its own hero and its own run of sections (layout in
 * examples-data.js), in its own fonts and colours (examples/ex.css). Nothing on an example is a real
 * link: every link and button opens the preview pop-up, which says this
 * is how their site could look and sends them to /join?trade=<key>. The
 * press shows in their journey in the One app, and so does the pop-up's
 * button. The pill at the bottom switches trade, and closes back to /free.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const EXAMPLES = require('./examples-data.js');

const EX_CSS_V = 9;
const EX_JS_V = 8;
const SITE_ID = '9094de37-b610-41b6-98f1-2aaf8f5bd52b';
const ROOT = path.join(__dirname, '..');

const free = (e) => '/free?trade=' + e.key;
const join = (e) => '/join?trade=' + e.key;
const P = '#preview';   // every link on an example opens the pop-up

/* A photo for the hero, once one is in assets/examples/hero/: it fills
   the photo-led heroes (layout.hero 'photo') in place of the blurred
   stand-in. */
function findImage(name) {
  for (const ext of ['jpg', 'jpeg', 'webp', 'png']) {
    const f = `assets/examples/hero/${name}.${ext}`;
    if (fs.existsSync(path.join(ROOT, f))) return '/' + f;
  }
  return '';
}
const heroImage = (e) => findImage(e.slug);

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

/* A fan of nail tips, the way a nail tech shows colours, painted in
   whichever swatch is picked (the hero's --polish, set by ex.js). */
ART.nailsBig = () => {
  const tip = (a, i) => `<g transform="rotate(${a} 200 340)">
      <path class="x-polish" d="M174 300 V150 C 174 92, 190 58, 200 40 C 210 58, 226 92, 226 150 V300 Z"/>
      <path d="M174 300 V150 C 174 92, 190 58, 200 40 C 210 58, 226 92, 226 150 V300 Z" fill="url(#tipShade)"/>
      <path d="M184 150 C 184 112, 191 82, 198 62" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="6" stroke-linecap="round"/>
      ${i === 3 ? '<path d="M174 150 C 174 92, 190 58, 200 40 C 210 58, 226 92, 226 150 C 210 128, 190 128, 174 150 Z" fill="#fff" fill-opacity=".92"/>' : ''}
      <rect x="171" y="292" width="58" height="22" rx="6" fill="#fff" stroke="rgba(45,31,43,.12)" stroke-width="2"/>
    </g>`;
  return `<svg viewBox="0 0 400 380" aria-hidden="true">
    <defs><linearGradient id="tipShade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>
    <circle class="f-s" cx="200" cy="210" r="168"/>
    ${[-60, -40, -20, 0, 20, 40, 60].map((a, i) => tip(a, i)).join('')}
    <circle cx="200" cy="340" r="22" fill="#fff" stroke="rgba(45,31,43,.14)" stroke-width="2"/><circle cx="200" cy="340" r="7" fill="var(--accent4)"/>
    ${sparkle(352, 64, 14, 'f-b')}${sparkle(44, 96, 9, 'f-a')}${sparkle(364, 196, 7, 'f-d')}
  </svg>`;
};

/* A fuse box with one breaker tripped, which flips back up (ex.css):
   the electrician's whole promise in one picture. */
ART.breaker = () => `<svg viewBox="0 0 420 400" aria-hidden="true">
    <g fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3" stroke-linecap="round"><path d="M110 330 V372 H20"/><path d="M210 330 V390"/><path d="M310 330 V372 H400"/><path d="M60 60 H150 L170 80"/><path d="M370 40 H290"/></g>
    <circle cx="210" cy="210" r="168" fill="#fff" fill-opacity=".04"/>
    <rect x="40" y="96" width="340" height="234" rx="22" fill="#f4f6f9"/>
    <rect x="40" y="96" width="340" height="40" rx="22" fill="#e6eaf0"/><rect x="40" y="118" width="340" height="18" fill="#e6eaf0"/>
    <circle cx="66" cy="116" r="6" fill="#cfd6df"/><circle cx="354" cy="116" r="6" fill="#cfd6df"/>
    <rect x="62" y="152" width="296" height="146" rx="10" fill="#dfe4eb"/>
    <rect x="74" y="166" width="54" height="118" rx="8" fill="var(--accent)"/>
    <rect x="88" y="182" width="26" height="44" rx="5" fill="#0f1b2d"/>
    <rect x="80" y="254" width="42" height="8" rx="4" fill="#0f1b2d" fill-opacity=".35"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const x = 140 + i * 26.5; return `<rect x="${x}" y="166" width="21" height="118" rx="5" fill="#fff" stroke="#c9d1dc" stroke-width="1.5"/><rect class="${i === 5 ? 'x-trip' : ''}" x="${x + 5}" y="182" width="11" height="34" rx="3" fill="#0f1b2d"/><rect x="${x + 4}" y="262" width="13" height="6" rx="2" fill="#c9d1dc"/>`; }).join('')}
    <circle class="x-led" cx="352" cy="312" r="7"/>
    <rect x="62" y="306" width="120" height="10" rx="5" fill="#cfd6df"/>
    <g transform="translate(320 40)"><circle r="40" fill="var(--accent)"/><path fill="#0f1b2d" d="M6 -24 L-14 4 H0 L-6 26 L16 -4 H2 Z"/></g>
  </svg>`;

/* Small drawings for the cake cards, one for each kind of cake. */
const tier = (x, y, w, h, top, body) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" class="${body}"/>${drip(x, y, w, Math.max(3, Math.round(w / 24)), top)}`;
const CAKE_MINI = [
  () => `${tier(40, 70, 120, 56, 'f-a', 'f-w')}<circle class="f-c" cx="100" cy="62" r="7"/>`,
  () => `${tier(30, 92, 140, 46, 'f-d', 'f-w')}${tier(58, 50, 84, 42, 'f-w', 'f-d')}<circle class="f-a" cx="100" cy="42" r="7"/>`,
  () => `${tier(30, 104, 140, 36, 'f-w', 'f-w')}${tier(50, 70, 100, 34, 'f-w', 'f-w')}${tier(70, 38, 60, 32, 'f-w', 'f-w')}<path class="f-a" d="M100 36c-6-9-16-9-16-2 0 6 9 6 16 2zm0 0c6-9 16-9 16-2 0 6-9 6-16 2z"/>`,
  () => [44, 100, 156].map((x, i) => `<path class="${['f-b', 'f-c', 'f-d'][i]}" d="M${x - 22} 92 L${x - 16} 134 H${x + 16} L${x + 22} 92 Z"/><path class="f-w" d="M${x - 24} 94 C ${x - 28} 74, ${x - 10} 70, ${x - 6} 66 C ${x - 4} 54, ${x + 12} 54, ${x + 10} 66 C ${x + 22} 66, ${x + 28} 80, ${x + 24} 94 Z"/><circle class="f-a" cx="${x + 2}" cy="56" r="6"/>`).join(''),
  () => `<rect x="34" y="66" width="132" height="74" rx="8" class="f-w"/><path class="f-a" d="M34 84 H166" stroke="none"/><rect x="34" y="66" width="132" height="14" rx="6" class="f-a"/>${[[60, 104], [100, 104], [140, 104], [60, 128], [100, 128], [140, 128]].map(([x, y], i) => `<circle cx="${x}" cy="${y - 4}" r="12" fill="${i % 2 ? '#7a4a33' : '#d9a36b'}"/>`).join('')}`
];

/* Out-of-focus "photos": what the hero looks like until their own photo
   is in. Blurred (ex.css) so they read as a photo, not a drawing. */
const PH = {
  hair: () => `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="phh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1d17"/><stop offset=".55" stop-color="#5a3a2a"/><stop offset="1" stop-color="#8a5a3c"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#phh)"/>
    <ellipse cx="1010" cy="120" rx="260" ry="200" fill="#f3e3cf" opacity=".55"/>
    <ellipse cx="860" cy="430" rx="250" ry="330" fill="#b9805a"/>
    <g fill="none" stroke-linecap="round">
      <path d="M760 -40 C 700 160, 860 280, 800 460 S 700 760, 780 900" stroke="#e7c79f" stroke-width="90"/>
      <path d="M880 -40 C 830 170, 980 300, 920 480 S 840 760, 900 900" stroke="#c99263" stroke-width="110"/>
      <path d="M990 -20 C 960 200, 1080 320, 1030 520 S 980 760, 1040 900" stroke="#f0d6b0" stroke-width="80"/>
      <path d="M690 60 C 650 240, 760 360, 720 540 S 660 760, 700 900" stroke="#a8673f" stroke-width="70"/>
      <path d="M1100 40 C 1080 240, 1170 360, 1130 560" stroke="#d9aa7c" stroke-width="70"/>
    </g>
    <ellipse cx="300" cy="640" rx="380" ry="200" fill="#1c1310" opacity=".8"/>
  </svg>`,
  mua: () => `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
    <rect width="1200" height="800" fill="#16110e"/>
    <ellipse cx="900" cy="470" rx="230" ry="300" fill="#c99a83" opacity=".75"/>
    <ellipse cx="900" cy="300" rx="150" ry="180" fill="#e2bba3" opacity=".8"/>
    <ellipse cx="880" cy="760" rx="380" ry="170" fill="#f1e6da" opacity=".7"/>
    ${[[640, 120, 46, .55], [700, 260, 30, .5], [1120, 140, 58, .6], [1060, 330, 26, .55], [560, 420, 22, .45], [1150, 520, 40, .5], [480, 160, 34, .35], [380, 90, 22, .3], [1010, 70, 20, .5], [620, 600, 28, .35]].map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f3d39a" opacity="${o}"/>`).join('')}
  </svg>`,
  lash: () => `<svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice">
    <defs><radialGradient id="phl" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#f6d9cc"/><stop offset=".7" stop-color="#e9bfae"/><stop offset="1" stop-color="#c98f80"/></radialGradient></defs>
    <rect width="400" height="520" fill="url(#phl)"/>
    <path d="M60 170 Q 200 120 340 175" fill="none" stroke="#8a5a4d" stroke-width="22" stroke-linecap="round" opacity=".55"/>
    <path d="M50 270 Q 200 360 350 270" fill="none" stroke="#3a2422" stroke-width="9" stroke-linecap="round"/>
    <g fill="none" stroke="#2a1a19" stroke-width="5" stroke-linecap="round">${lashes([50, 270], [200, 360], [350, 270], 22)}</g>
    <ellipse cx="300" cy="90" rx="120" ry="70" fill="#fff" opacity=".35"/>
  </svg>`
};

/* ------------------------------------------------------------- Dot */
/* Dot, our mascot, leaves a few small notes down each example: what goes
   where on their own site, on the parts that sell (the hero, the services,
   "sound familiar?", the reviews). Not every section; just enough to read
   the page as a preview of theirs. */
/* Trades that sell to people, whose "sound familiar?" reads as things
   customers say rather than jobs gone wrong. */
const PEOPLE = ['hair', 'lash', 'mua', 'nails', 'cake', 'kids'];
const dotFace = '<span class="k1-dot" aria-hidden="true"><span><i></i><i></i></span></span>';
const note = (text, cls) => (text ? `<p class="k1-guide${cls ? ' ' + cls : ''}">${dotFace}<span>${text}</span></p>` : '');
const NOTE = {
  services: 'Your services and prices, each with a button to book.',
  pains: 'Build trust: describe their problem better than they could themselves.',
  reviews: 'Your real Google reviews show here.'
};
const head = (h, p, n, cls) => `<div class="x-head${cls ? ' ' + cls : ''}"><h2>${h}</h2>${p ? `<p>${p}</p>` : ''}${note(n)}</div>`;
const photoTag = `<span class="x-shot-tag">${CAMERA}Your photo</span>`;

/* Line icons for the promise tiles. */
const ICON = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tag: '<path d="M3.5 12.6V4.5h8.1l8.9 8.9-8 8z"/><circle cx="8" cy="9" r="1.5"/>',
  tidy: '<path d="M14 3l-4 9"/><path d="M6 12h9l2 9H4z"/><path d="M9 16v5M12.5 16v5"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M12 13c1.6 1.7 2 2.7 2 3.6a2 2 0 0 1-4 0c0-.9.4-1.9 2-3.6z"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5l3-3a4 4 0 0 1 3 3l-3 3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.shield}</svg>`;
const riskList = (e) => `<ul class="x-risk">${e.hero.risk.map((r) => `<li>${CHECK}<span>${r}</span></li>`).join('')}</ul>`;
const ctaBtn = (e, cls) => `<a class="x-btn${cls ? ' ' + cls : ''}" href="${P}">${e.hero.cta}</a>`;

/* ---------------------------------------------------------------- heroes */
/* Each trade opens differently, on what its customers want to see first:
   the work (a photo the width of the page), a free slot, a colour, the
   cake, the fix, the price, the pass. */

/* A box in place of the hero button: the wedding date, or a postcode.
   On their site it would take the visitor on with it filled in; here it
   opens the preview, which says so. */
function askBox(e) {
  const a = e.x.ask;
  return `<form class="x-ask" data-preview-form data-say="${a.say}" novalidate>
        <label for="xAsk">${a.label}</label>
        <div class="x-ask-row">${a.type === 'date' ? `<input id="xAsk" name="date" type="date" value="${a.value}">` : `<input id="xAsk" name="postcode" type="text" inputmode="text" autocomplete="postal-code" autocapitalize="characters" maxlength="8" placeholder="${a.placeholder}">`}<button class="x-btn" type="submit">${a.btn || e.hero.cta}</button></div>
      </form>`;
}

function copy(e, widget) {
  const h = e.hero;
  if (!widget && e.x.ask) widget = askBox(e);
  return `<div class="x-hero-copy">
      <p class="x-status"><span aria-hidden="true"></span>${h.status}</p>
      <h1>${h.h1}</h1>
      <p class="x-sub">${h.sub}</p>
      ${widget || ctaBtn(e, 'x-btn-hero')}
      ${riskList(e)}
    </div>`;
}

/* Their best photo, the whole hero behind the words. */
function heroPhoto(e) {
  const img = heroImage(e), widget = '';
  return `<section class="x-hero x-hero--photo x-ph-${e.key}${img ? ' has-img' : ''}"${img ? ` style="--hero-img:url('${img}')"` : ''}>
  <div class="x-ph" aria-hidden="true">${img ? '' : PH[e.key]()}</div>
  <div class="x-wrap x-hero-in">
    ${copy(e, widget)}
    ${note(e.x.heroNote, 'k1-guide-hero k1-guide-photo')}
  </div>
</section>`;
}

/* A close-up in an arch, and the next free appointments over it. */
function heroBooking(e) {
  const b = e.x.book;
  return `<section class="x-hero x-hero--booking">
  <div class="x-wrap x-hero-in">
    ${copy(e)}
    <div class="x-hero-side">
      <div class="x-arch" aria-hidden="true">${PH.lash()}${photoTag}</div>
      ${note(e.x.heroNote, 'k1-guide-hero')}
      <div class="x-book">
        <p class="x-book-h">${b.h}</p>
        <div class="x-chips" role="group" aria-label="Treatment">${b.chips.map((c, i) => `<button type="button" aria-pressed="${i ? 'false' : 'true'}">${c}</button>`).join('')}</div>
        <div class="x-slots">${b.slots.map(([d, t]) => `<a href="${P}"><small>${d}</small><b>${t}</b></a>`).join('')}</div>
        <a class="x-book-all" href="${P}">See all times &rsaquo;</a>
      </div>
    </div>
  </div>
</section>`;
}

/* The hand, painted in the colour they tap. */
function heroSwatch(e) {
  const sw = e.x.swatches;
  return `<section class="x-hero x-hero--swatch" style="--polish:${sw[0][1]}">
  <div class="x-wrap x-hero-in">
    ${copy(e)}
    <div class="x-hero-side">
      <div class="x-art x-art-nails">${ART.nailsBig()}</div>
      <div class="x-swatches" role="group" aria-label="Try a colour">${sw.map(([n, c], i) => `<button type="button" class="x-sw" style="--c:${c}" data-polish="${c}" aria-pressed="${i ? 'false' : 'true'}"><i></i><span>${n}</span></button>`).join('')}</div>
      ${note(e.x.heroNote, 'k1-guide-hero')}
    </div>
  </div>
</section>`;
}

/* A big drawing beside the words: the cake, the club, the fix, the road. */
function heroArt(e, kind, extra) {
  return `<section class="x-hero x-hero--${kind}">
  <div class="x-wrap x-hero-in">
    ${copy(e)}
    <div class="x-hero-side">
      <div class="x-art x-art-${e.art}">${kind === 'showcase' ? ART.cake().replace('viewBox="0 0 400 400"', 'viewBox="44 60 312 312"').replace('<circle class="f-s" cx="200" cy="205" r="172"/>', '') : ART[kind === 'breaker' ? 'breaker' : e.art]()}</div>
      ${extra || ''}
      ${note(e.x.heroNote, 'k1-guide-hero')}
    </div>
  </div>
  ${kind === 'playful' ? '<svg class="x-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 C 240 90, 480 0, 720 30 S 1200 80, 1440 30 V80 H0Z"/></svg>' : ''}
</section>`;
}
const heroShowcase = (e) => heroArt(e, 'showcase', e.x.tags.map((t, i) => `<span class="x-tagpin x-tagpin-${i + 1}">${t}</span>`).join(''));
const heroPlayful = (e) => heroArt(e, 'playful');
const heroBreaker = (e) => heroArt(e, 'breaker', `<p class="x-fixed"><span></span>${e.x.fixed}</p>`);
const heroRoad = (e) => heroArt(e, 'road', `<p class="x-badge"><b>${e.x.badge[0]}</b><span>${e.x.badge[1]}</span></p>`);

/* No heating: how soon, what it costs, and the slot to book. */
function heroOutcome(e) {
  const t = e.x.today;
  return `<section class="x-hero x-hero--outcome">
  <div class="x-wrap x-hero-in">
    ${copy(e)}
    <div class="x-hero-side">
      <div class="x-art x-art-boiler">${ART.boiler()}</div>
      <div class="x-today">
        <p class="x-today-h"><span aria-hidden="true"></span>${t.h}</p>
        <dl>${t.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <a class="x-btn" href="${P}">${t.btn}</a>
        <p class="x-today-f">${icon('phone')}Or call <b>${e.phone}</b></p>
      </div>
      ${note(e.x.heroNote, 'k1-guide-hero')}
    </div>
  </div>
  <div class="x-wrap"><ul class="x-outcomes">${e.x.stats.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ul></div>
</section>`;
}

/* Pick the car and the clean, see the price. */
function heroQuote(e) {
  const q = e.x.quote;
  return `<section class="x-hero x-hero--quote">
  <div class="x-wrap x-hero-in">
    ${copy(e)}
    <div class="x-hero-side">
      <div class="x-art x-art-valet">${ART.valet()}</div>
      ${note(e.x.heroNote, 'k1-guide-hero')}
      <div class="x-quote" data-quote>
        <p class="x-quote-h">Your price in two taps</p>
        <p class="x-quote-l">Your car</p>
        <div class="x-seg" data-q="size">${q.sizes.map(([n, add], i) => `<button type="button" data-v="${add}" aria-pressed="${i === 1 ? 'true' : 'false'}">${n}</button>`).join('')}</div>
        <p class="x-quote-l">The clean</p>
        <div class="x-seg" data-q="pack">${q.packs.map(([n, base], i) => `<button type="button" data-v="${base}" aria-pressed="${i === 1 ? 'true' : 'false'}">${n}</button>`).join('')}</div>
        <div class="x-quote-out"><span>Total<b data-q-out>&pound;${q.packs[1][1] + q.sizes[1][1]}</b></span><a class="x-btn" href="${P}">Book this</a></div>
      </div>
    </div>
  </div>
</section>`;
}

const HEROES = { photo: heroPhoto, booking: heroBooking, swatch: heroSwatch, showcase: heroShowcase, playful: heroPlayful, breaker: heroBreaker, outcome: heroOutcome, quote: heroQuote, road: heroRoad };

/* ------------------------------------------------------------ sections */
/* A page is the hero, then the trade's own list of these (layout.order in
   examples-data.js): the same journey every time (trust, the problem, the
   fix, the services, reviews, the button again) told the way that trade's
   customers decide. */

function trust(e) {
  return `<section class="x-trust">
  <div class="x-wrap"><ul>${e.x.trust.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ul></div>
</section>`;
}

/* Big numbers, for the trades where the proof is a number. */
function stats(e) {
  return `<section class="x-stats">
  <div class="x-wrap"><ul>${e.x.stats.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ul></div>
</section>`;
}

/* Their work, before anything else: for the trades people choose by eye. */
function gallery(e) {
  const g = e.x.gallery;
  return `<section class="x-sec x-gallery-sec" data-k1-seen="the gallery">
  <div class="x-wrap">
    ${head(g.h, g.p, g.note)}
    <div class="x-gallery">${g.items.map((t, i) => `<a class="x-shot" href="${P}">${i ? '' : photoTag}<span class="x-shot-l">${t}</span></a>`).join('')}</div>
  </div>
</section>`;
}

/* The services as cards in a row that swipes on a phone and scrolls with
   arrows on a computer. */
function rail(e) {
  const s = e.services;
  return `<section class="x-sec x-rail-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">${head(s.h, s.sub, NOTE.services)}</div>
  <div class="x-rail-wrap">
    <div class="x-rail" tabindex="0" aria-label="${strip(s.h)}">${s.items.map(([n, d, pr, t], i) => `<a class="x-card" href="${P}">
      <span class="x-card-art" aria-hidden="true">${i ? '' : photoTag}${e.key === 'cake' && CAKE_MINI[i] ? `<svg class="x-card-cake" viewBox="0 20 200 140"><ellipse cx="100" cy="146" rx="84" ry="8" fill="#000" opacity=".07"/>${CAKE_MINI[i]()}</svg>` : mark(e.icon)}</span>
      <span class="x-card-body"><h3>${n}</h3><p>${d}</p>
      <span class="x-card-foot"><b>${pr}</b><span>${t}</span><em>Order &rsaquo;</em></span></span>
    </a>`).join('')}</div>
    <div class="x-rail-btns x-wrap"><button class="x-rail-btn" type="button" data-rail="-1" aria-label="Previous">&lsaquo;</button><button class="x-rail-btn" type="button" data-rail="1" aria-label="Next">&rsaquo;</button></div>
  </div>
</section>`;
}

/* A salon price list: grouped, the price at the end of a dotted line. */
function menu(e) {
  const s = e.services;
  return `<section class="x-sec x-menu-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(e.x.menu.h || s.h, s.sub, NOTE.services)}
    <div class="x-menu">${e.x.menu.groups.map(([g, idx]) => `<div class="x-menu-g"><h3>${g}</h3><ul>${idx.map((i) => {
      const [n, d, pr, t] = s.items[i];
      return `<li><a href="${P}"><span class="x-menu-n"><b>${n}</b><small>${d}</small></span><i aria-hidden="true"></i><span class="x-menu-p"><b>${pr}</b><small>${t}</small></span></a></li>`;
    }).join('')}</ul></div>`).join('')}</div>
    <p class="x-center">${ctaBtn(e)}</p>
  </div>
</section>`;
}

/* Bridal packages: the bride's package first and biggest. */
function packages(e) {
  const s = e.services, [first, ...rest] = s.items;
  return `<section class="x-sec x-packages-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(s.h, s.sub, NOTE.services)}
    <div class="x-packages">
      <a class="x-pack is-main" href="${P}"><small>Most booked</small><h3>${first[0]}</h3><p>${first[1]}</p><b>${first[2]}</b><span>${first[3]}</span><em>${e.hero.cta} &rsaquo;</em></a>
      <div class="x-pack-list">${rest.map(([n, d, pr, t]) => `<a class="x-pack" href="${P}"><div><h3>${n}</h3><p>${d}</p></div><div class="x-pack-p"><b>${pr}</b><span>${t}</span></div></a>`).join('')}</div>
    </div>
  </div>
</section>`;
}

/* Valeting packages side by side, the middle one picked out. */
function tiers(e) {
  const s = e.services, t = e.x.tiers;
  return `<section class="x-sec x-tiers-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(s.h, s.sub, NOTE.services)}
    <div class="x-tiers">${t.items.map(([i, feats], k) => { const [n, , pr, time] = s.items[i]; return `<a class="x-tier${k === t.featured ? ' is-main' : ''}" href="${P}">${k === t.featured ? '<small>Most popular</small>' : ''}<h3>${n}</h3><p class="x-tier-p"><b>${pr}</b><span>${time}</span></p><ul>${feats.map((f) => `<li>${CHECK}${f}</li>`).join('')}</ul><span class="x-tier-go">Book ${strip(n).toLowerCase()}</span></a>`; }).join('')}</div>
    <ul class="x-addons">${t.addons.map((i) => { const [n, d, pr] = s.items[i]; return `<li><b>${n}</b><span>${d}</span><em>${pr}</em></li>`; }).join('')}</ul>
  </div>
</section>`;
}

/* A plain price list for the trades: the job, how soon, the price. */
function table(e) {
  const s = e.services;
  return `<section class="x-sec x-table-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(s.h, s.sub, NOTE.services)}
    <ul class="x-table">${s.items.map(([n, d, pr, t]) => `<li><a href="${P}"><span class="x-table-n"><b>${n}</b><small>${d}</small></span><span class="x-table-t">${icon('clock')}${t}</span><span class="x-table-p">${pr}</span><span class="x-table-go" aria-hidden="true">&rsaquo;</span></a></li>`).join('')}</ul>
  </div>
</section>`;
}

/* Lessons: a card each, the block of ten picked out. */
function lessons(e) {
  const s = e.services;
  return `<section class="x-sec x-lessons-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(s.h, s.sub, NOTE.services)}
    <div class="x-lessons">${s.items.map(([n, d, pr, t], i) => `<a class="x-lesson${i === e.x.featured ? ' is-main' : ''}" href="${P}">${i === e.x.featured ? '<small>Best value</small>' : ''}<h3>${n}</h3><p>${d}</p><span class="x-lesson-p"><b>${pr}</b><span>${t}</span></span></a>`).join('')}</div>
  </div>
</section>`;
}

/* Lash sets from natural to full, each drawn with as many lashes as it
   gives; the other treatments underneath. */
function sets(e) {
  const s = e.services, x = e.x.sets;
  const eye = (n) => `<svg viewBox="0 0 200 110" aria-hidden="true"><path d="M20 30 Q 100 92 180 30" fill="none" class="s-i" stroke-width="4" stroke-linecap="round"/><g fill="none" class="s-i" stroke-width="${n > 20 ? 1.8 : 2.4}" stroke-linecap="round">${lashes([20, 30], [100, 92], [180, 30], n)}</g></svg>`;
  return `<section class="x-sec x-sets-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(x.h, x.p, NOTE.services)}
    <div class="x-sets">${x.show.map(([i, n, label]) => { const [name, d, pr, t] = s.items[i]; return `<a class="x-set" href="${P}"><span class="x-set-eye">${eye(n)}</span><small>${label}</small><h3>${name}</h3><p>${d}</p><span class="x-set-p"><b>${pr}</b><span>${t}</span><em>Book &rsaquo;</em></span></a>`; }).join('')}</div>
    <ul class="x-also">${x.also.map((i) => { const [n, , pr, t] = s.items[i]; return `<li><a href="${P}"><b>${n}</b><span>${pr} &middot; ${t}</span></a></li>`; }).join('')}</ul>
  </div>
</section>`;
}

/* How it works, as steps: a plain row, a timeline with times, or a road. */
function steps(e) {
  const s = e.x.steps, kind = s.kind ? ' is-' + s.kind : '';
  return `<section class="x-sec x-steps-sec${kind}">
  <div class="x-wrap">
    ${head(s.h, s.p, s.note)}
    <ol class="x-steps${kind}">${s.items.map((it, i) => {
      const [when, h, p] = it.length === 3 ? it : ['', it[0], it[1]];
      return `<li><span class="x-step-n" aria-hidden="true">${i + 1}</span><div>${when ? `<small>${when}</small>` : ''}<h3>${h}</h3><p>${p}</p></div></li>`;
    }).join('')}</ol>
    ${s.cta ? `<p class="x-center">${ctaBtn(e)}</p>` : ''}
  </div>
</section>`;
}

/* The kids' club week at a glance, then camps and parties. */
function timetable(e) {
  const t = e.x.timetable, s = e.services;
  const names = [...new Set(t.items.map((c) => c[2]))];
  return `<section class="x-sec x-time-sec" id="services" data-k1-seen="the services">
  <div class="x-wrap">
    ${head(t.h, t.p, NOTE.services)}
    <div class="x-time">${t.days.map((d) => `<div class="x-day"><h3>${d}</h3><div>${t.items.filter((c) => c[0] === d).map(([, time, name, ages]) => `<a class="x-class x-class-${(names.indexOf(name) % 4) + 1}" href="${P}"><b>${name}</b><span>${time} &middot; ages ${ages}</span></a>`).join('')}</div></div>`).join('')}</div>
    <p class="x-time-price">${s.sub}</p>
    <div class="x-extras">${t.extras.map((i) => { const [n, d, pr, when] = s.items[i]; return `<a class="x-extra" href="${P}"><h3>${n}</h3><p>${d}</p><span><b>${pr}</b> &middot; ${when}</span></a>`; }).join('')}</div>
  </div>
</section>`;
}

/* The promises, tile by tile: what you get, how sure, how soon, how easy. */
function value(e) {
  const v = e.x.value;
  return `<section class="x-sec x-value-sec">
  <div class="x-wrap">
    ${head(v.h, v.p, v.note)}
    <ul class="x-value">${v.items.map(([ic, h, p, label]) => `<li><span class="x-value-ico">${icon(ic)}</span>${label ? `<small>${label}</small>` : ''}<h3>${h}</h3><p>${p}</p></li>`).join('')}</ul>
  </div>
</section>`;
}

function areas(e) {
  const a = e.x.areas;
  return `<section class="x-sec x-areas-sec">
  <div class="x-wrap x-areas">
    <div class="x-head"><h2>${a.h}</h2><p>${a.p}</p></div>
    <ul>${a.list.map((t) => `<li>${icon('pin')}${t}</li>`).join('')}</ul>
  </div>
</section>`;
}

/* "Sound familiar?" as a side-by-side: the last engineer, and this one. */
function compare(e) {
  const c = e.x.compare;
  return `<section class="x-sec x-pains-sec x-compare-sec" data-k1-seen="the problems">
  <div class="x-wrap">
    ${head(c.h, '', NOTE.pains)}
    <div class="x-compare" role="table" aria-label="${strip(c.h)}">
      <div class="x-compare-r x-compare-h" role="row"><span role="columnheader">${c.them}</span><span role="columnheader">${c.us}</span></div>
      ${c.items.map(([a, b]) => `<div class="x-compare-r" role="row"><span role="cell">${CROSS}${a}</span><span role="cell">${CHECK}${b}</span></div>`).join('')}
    </div>
  </div>
</section>`;
}

/* Before and after, with a handle to drag (ex.js). */
function beforeafter(e) {
  const b = e.x.ba;
  return `<section class="x-sec x-ba-sec" data-k1-seen="the before and after">
  <div class="x-wrap">
    ${head(b.h, b.p, b.note)}
    <div class="x-ba" style="--pos:50%">
      <div class="x-ba-img x-ba-after" aria-hidden="true">${ART.valet()}<span>After</span></div>
      <div class="x-ba-img x-ba-before" aria-hidden="true">${ART.valet()}<span>Before</span></div>
      <span class="x-ba-handle" aria-hidden="true"><i>&lsaquo;&rsaquo;</i></span>
      <input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after">
    </div>
  </div>
</section>`;
}

function flavours(e) {
  const f = e.x.flavours;
  return `<section class="x-sec x-flavours-sec">
  <div class="x-wrap">
    ${head(f.h, f.p)}
    <ul class="x-flavours">${f.items.map((t) => `<li>${t}</li>`).join('')}</ul>
  </div>
</section>`;
}

function pains(e) {
  const s = e.pains;
  return `<section class="x-sec x-pains-sec" data-k1-seen="the problems">
  <div class="x-wrap">
    ${head(s.h, '', NOTE.pains)}
    <ul class="x-pains${PEOPLE.includes(e.key) ? ' is-bubbles' : ''}">${s.items.map((t) => `<li><span class="x-pain-ico">${CROSS}</span><span>${t}</span></li>`).join('')}</ul>
  </div>
</section>`;
}

function solution(e) {
  const s = e.solution;
  return `<section class="x-sec x-solution-sec">
  <div class="x-wrap x-solution">
    <div class="x-head"><h2>${s.h}</h2><p>${s.p}</p>${e.x.seal ? `<p class="x-seal" aria-hidden="true"><b>${e.x.seal[0]}</b><span>${e.x.seal[1]}</span></p>` : ''}${ctaBtn(e)}</div>
    <ul class="x-points">${s.items.map(([h, p]) => `<li><span class="x-point-ico">${CHECK}</span><div><h3>${h}</h3><p>${p}</p></div></li>`).join('')}</ul>
  </div>
</section>`;
}

function faq(e) {
  return `<section class="x-sec x-faq-sec" id="faq">
  <div class="x-wrap x-faq-wrap">
    <div class="x-head"><h2>Questions</h2><p>Anything else? <a href="${P}">Send us a message</a>.</p></div>
    <div class="x-faq">${e.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
  </div>
</section>`;
}

/* Reviews are placeholders on purpose: on a real site, these are the
   business's own Google reviews. Three cards, one big quote, or (for the
   driving school) pass photos with a review under each. */
function reviews(e) {
  const who = e.key === 'kids' ? 'parents' : e.key === 'driving' ? 'pupils' : 'customers';
  const kind = e.layout.reviews || 'cards';
  const quote = `A five-star review from one of your ${who} goes here, pulled in from Google.`;
  const cap = (i) => `<figcaption><span class="x-avatar" aria-hidden="true">${'ABC'[i]}</span><span><b>Customer name</b><small>Google review</small></span></figcaption>`;
  let body;
  if (kind === 'quote') {
    body = `<figure class="x-bigquote">${stars}<blockquote>&ldquo;${quote}&rdquo;</blockquote>${cap(0)}<span class="x-dots" aria-hidden="true"><i class="is-on"></i><i></i><i></i></span></figure>`;
  } else if (kind === 'passes') {
    body = `<div class="x-passes">${[0, 1, 2].map((i) => `<figure class="x-pass"><span class="x-pass-img" aria-hidden="true">${i ? '' : photoTag}<em>Passed!</em></span>${stars}<blockquote>${quote}</blockquote>${cap(i)}</figure>`).join('')}</div>`;
  } else {
    body = `<div class="x-reviews">${[0, 1, 2].map((i) => `<figure class="x-review">${stars}<blockquote>${quote}</blockquote>${cap(i)}</figure>`).join('')}</div>`;
  }
  const h = kind === 'passes' ? 'Recent passes' : `What ${who} say`;
  const n = kind === 'passes' ? 'Your pupils&rsquo; pass photos and reviews show here.' : NOTE.reviews;
  return `<section class="x-sec x-reviews-sec" id="reviews" data-k1-seen="the reviews">
  <div class="x-wrap">
    ${head(h, '', n)}
    ${body}
  </div>
</section>`;
}

/* The button again; for the emergency trades, the phone number too. */
function band(e) {
  const call = e.layout.band === 'call';
  return `<section class="x-band">
  <div class="x-wrap">
    <h2>${e.band.h}</h2><p>${e.band.p}</p>
    <div class="x-band-btns">${ctaBtn(e, 'x-btn-band')}${call ? `<a class="x-btn x-btn-call" href="${P}">${icon('phone')}${e.phone}</a>` : ''}</div>
    ${riskList(e)}
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

const SECTIONS = { trust, stats, gallery, rail, menu, packages, tiers, table, lessons, sets, steps, timetable, value, areas, compare, beforeafter, flavours, pains, solution, faq, reviews, band };

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

/* The strip above the example: what this page is, before anything else.
   Someone from an ad lands on what looks like a stranger's business; this
   says it is an example, and that ours builds theirs for £9.99. It scrolls
   away with the page; the pill at the foot stays. */
function topStrip(e) {
  return `<div class="k1-top" id="k1Top">
  <p class="k1-top-t"><small>Example website for ${strip(e.one).replace(/&rsquo;/g, '’')}s</small><b>Our team builds yours, &pound;9.99/mo</b></p>
  <a class="k1-top-go" href="${join(e)}">Get yours</a>
</div>`;
}

/* The pop-up every link on the example opens. */
function modal(e) {
  return `<div class="k1-modal" id="k1Modal" hidden>
  <div class="k1-modal-card" role="dialog" aria-modal="true" aria-labelledby="k1ModalH">
    <button class="k1-modal-x" type="button" data-k1-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <span class="k1-face" aria-hidden="true"><span><i></i><i></i></span></span>
    <h2 id="k1ModalH">This is a preview of how yours could look.</h2>
    <p class="k1-modal-say" id="k1Say" hidden></p>
    <p>Join today and we build your full website from the page you already have.</p>
    <p class="k1-modal-offer"><b>Live by tomorrow.</b> &pound;9.99 a month, cancel any month.</p>
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
  const dark = Boolean(e.theme.dark);
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
<body class="T-${e.key} H-${e.layout.hero}${dark ? ' hero-dark' : ''}" data-consent-slim>
${topStrip(e)}
<header class="x-nav" id="xNav">
  <div class="x-wrap x-nav-in">
    <a class="x-logo" href="${P}" aria-label="${strip(e.name)}">${mark(e.icon)}</a>
    <button class="x-burger" type="button" data-preview aria-label="Menu"><span></span><span></span></button>
  </div>
</header>
<main>
${HEROES[e.layout.hero](e)}
${e.layout.order.map((k) => SECTIONS[k](e)).join('\n')}
</main>
${footer(e)}
${modal(e)}
${pill(e)}
<script src="/consent.js?v=10"></script>
<script src="/examples/ex.js?v=${EX_JS_V}"></script>
<script src="/beacon.js?v=5" data-site="${SITE_ID}" defer></script>
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
<script src="/chat.js?v=10" data-site="${SITE_ID}" data-name="Kanvas One" data-edits data-trigger="#navChat" data-full defer></script>
<script src="/beacon.js?v=5" data-site="${SITE_ID}" defer></script>
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
