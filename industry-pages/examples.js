/* The example websites: /examples, and one made-up business per trade at
 * /examples/<slug>. Built by `node industry-pages/build.js` along with the
 * other generated pages; the data is in examples-data.js.
 *
 * Each example looks like a site we'd build for that trade, with its own
 * fonts, colours and layout (examples/ex.css). Every link and button on it
 * goes to /free?trade=<key>, so whatever someone presses, they land on the
 * free design with their trade already in the green pill, and the press
 * shows in their journey in the One app. The pill at the bottom says it is
 * an example, switches trade, and closes back to /free.
 *
 * The pictures are drawn, not photographed: there are no stock photos of
 * made-up businesses to show, and the gallery says plainly that on a real
 * site it is the customer's own work.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const EXAMPLES = require('./examples-data.js');

const EX_CSS_V = 1;
const EX_JS_V = 1;
const SITE_ID = '9094de37-b610-41b6-98f1-2aaf8f5bd52b';

const free = (e) => '/free?trade=' + e.key;

/* ------------------------------------------------------------------ art */

/* Points along a quadratic curve, for the lashes. */
function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}
function lashes() {
  const p0 = [70, 200], p1 = [200, 290], p2 = [330, 200];
  let out = '';
  for (let i = 0; i <= 22; i++) {
    const t = 0.04 + i * 0.92 / 22;
    const [x, y] = quad(p0, p1, p2, t);
    // Tangent, then the normal pointing down and away from the lid.
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const L = 34 + 38 * Math.pow(t, 1.6);          // longer toward the outer corner
    const sweep = 10 + 26 * t;                     // and swept outward
    const ex = x + nx * L + sweep, ey = y + ny * L;
    const cx = x + nx * L * 0.6, cy = y + ny * L * 0.6;
    out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`;
  }
  return out;
}

const ART = {
  hair: () => `<svg viewBox="0 0 400 500" aria-hidden="true">
    <g fill="none" stroke-linecap="round">
      <path class="s-b" stroke-width="22" opacity=".55" d="M70 -10 C 10 140, 250 190, 150 320 S 90 470, 230 520"/>
      <path class="s-a" stroke-width="14" d="M120 -10 C 60 150, 300 200, 200 330 S 140 470, 280 520"/>
      <path class="s-b" stroke-width="9" d="M170 -10 C 110 150, 350 210, 250 340 S 190 470, 330 520"/>
      <path class="s-a" stroke-width="5" opacity=".7" d="M215 -10 C 160 150, 390 215, 295 345 S 240 470, 380 520"/>
      <path class="s-i" stroke-width="2" opacity=".35" d="M250 -10 C 200 150, 430 220, 335 350 S 285 470, 420 520"/>
    </g>
    <circle class="f-w" cx="300" cy="110" r="10"/><circle class="f-a" cx="86" cy="400" r="6"/>
  </svg>`,

  lash: () => `<svg viewBox="0 0 400 400" aria-hidden="true">
    <circle class="f-b" cx="320" cy="90" r="16" opacity=".6"/><circle class="f-a" cx="80" cy="320" r="8" opacity=".5"/>
    <path class="s-b" fill="none" stroke-width="3" stroke-linecap="round" opacity=".6" d="M110 150 Q200 112 290 150"/>
    <g fill="none" class="s-i" stroke-width="3.2" stroke-linecap="round">${lashes()}</g>
    <path fill="none" class="s-i" stroke-width="7" stroke-linecap="round" d="M70 200 Q200 290 330 200"/>
  </svg>`,

  mua: () => `<svg viewBox="0 0 400 480" aria-hidden="true">
    <path fill="none" class="s-b" stroke-width="54" stroke-linecap="round" opacity=".45" d="M60 330 C 150 250, 260 300, 340 220"/>
    <path fill="none" class="s-a" stroke-width="26" stroke-linecap="round" d="M80 360 C 170 290, 270 330, 330 270"/>
    <circle class="f-s" cx="275" cy="135" r="78"/><circle fill="none" class="s-a" stroke-width="3" cx="275" cy="135" r="78"/>
    <circle class="f-b" cx="275" cy="135" r="52" opacity=".55"/><circle class="f-a" cx="262" cy="122" r="20" opacity=".55"/>
    <g transform="rotate(-38 120 170)"><rect class="f-a" x="108" y="90" width="24" height="170" rx="6"/><rect class="f-i" x="111" y="210" width="18" height="70" rx="5" opacity=".9"/><path class="f-b" d="M104 92 C 104 40, 136 40, 136 92 Z"/></g>
    <circle class="f-a" cx="340" cy="400" r="5"/><circle class="f-b" cx="70" cy="110" r="4"/>
  </svg>`,

  nails: () => {
    const cols = ['#f3d6c6', 'var(--accent)', '#9b2c4b', 'var(--accent2)', '#ffffff'];
    let g = '';
    cols.forEach((c, i) => {
      const x = 28 + i * 72, y = 150 + (i % 2) * 34;
      g += `<g><rect x="${x + 16}" y="${y}" width="28" height="64" rx="6" class="f-i"/>
        <rect x="${x}" y="${y + 56}" width="60" height="96" rx="16" style="fill:${c}" stroke="rgba(0,0,0,.08)"/>
        <rect x="${x + 9}" y="${y + 68}" width="8" height="54" rx="4" fill="#fff" opacity=".45"/></g>`;
    });
    return `<svg viewBox="0 0 400 400" aria-hidden="true">
      <ellipse class="f-s" cx="200" cy="352" rx="190" ry="22"/>${g}
      <circle class="f-a" cx="56" cy="80" r="7" opacity=".6"/><circle class="f-b" cx="340" cy="96" r="11"/>
    </svg>`;
  },

  cake: () => `<svg viewBox="0 0 400 480" aria-hidden="true">
    <ellipse class="f-s" cx="200" cy="440" rx="170" ry="22"/>
    <rect class="f-w" x="60" y="300" width="280" height="130" rx="14" stroke="rgba(0,0,0,.06)"/>
    <path class="f-a" d="M60 314 q0 -14 14 -14 h252 q14 0 14 14 v14 q-12 0 -12 14 q0 14 -14 14 q-12 0 -12 -16 v-6 q0 -12 -12 -12 q-12 0 -12 24 q0 12 -12 12 q-12 0 -12 -12 v-14 q0 -10 -12 -10 q-12 0 -12 30 q0 12 -12 12 q-12 0 -12 -12 v-22 q0 -8 -12 -8 q-12 0 -12 20 q0 12 -12 12 q-12 0 -12 -14 v-10 q0 -8 -12 -8 q-12 0 -12 16 q0 12 -12 12 q-14 0 -14 -16 z"/>
    <rect class="f-w" x="100" y="190" width="200" height="118" rx="12" stroke="rgba(0,0,0,.06)"/>
    <rect class="f-b" x="100" y="250" width="200" height="16" opacity=".8"/>
    <rect class="f-w" x="140" y="110" width="120" height="86" rx="10" stroke="rgba(0,0,0,.06)"/>
    <path class="f-a" d="M140 122 q0 -12 12 -12 h96 q12 0 12 12 v10 q-10 0 -10 12 q0 10 -10 10 q-10 0 -10 -14 q0 -8 -10 -8 q-10 0 -10 22 q0 10 -10 10 q-10 0 -10 -10 v-12 q0 -8 -10 -8 q-10 0 -10 14 q0 10 -10 10 q-12 0 -12 -14 z"/>
    <circle class="f-a" cx="172" cy="104" r="11"/><circle class="f-a" cx="200" cy="98" r="12"/><circle class="f-a" cx="228" cy="104" r="11"/>
    <rect class="f-b" x="196" y="52" width="8" height="40" rx="3"/><path class="f-b" d="M200 24 c10 12 10 22 0 26 c-10 -4 -10 -14 0 -26z"/>
    <circle class="f-b" cx="70" cy="120" r="6"/><circle class="f-a" cx="340" cy="170" r="8" opacity=".5"/>
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
    <circle cx="200" cy="200" r="190" fill="#fff"/><circle cx="200" cy="200" r="190" fill="none" stroke="var(--accent)" stroke-opacity=".25" stroke-width="6"/>
    <path fill="url(#fl)" d="M205 62 C 262 128, 300 176, 284 246 C 272 300, 232 330, 196 330 C 146 330, 110 296, 110 246 C 110 198, 140 168, 160 140 C 162 176, 178 196, 198 192 C 186 148, 186 106, 205 62 Z"/>
    <path fill="#fff" opacity=".85" d="M200 220 C 226 248, 236 266, 228 288 C 222 304, 210 312, 198 312 C 180 312, 166 300, 166 282 C 166 262, 182 246, 200 220 Z"/>
  </svg>`,

  valet: () => `<svg viewBox="0 0 400 320" aria-hidden="true">
    <ellipse cx="200" cy="262" rx="180" ry="18" fill="#000" opacity=".35"/>
    <path fill="#1b2633" stroke="var(--accent)" stroke-width="2.5" d="M40 230 C 40 200, 60 186, 96 180 L 136 130 C 146 118, 160 112, 178 112 H 262 C 282 112, 296 120, 310 136 L 340 176 C 362 180, 372 196, 372 214 V 236 C 372 244, 366 248, 358 248 H 52 C 44 248, 40 242, 40 230 Z"/>
    <path fill="#2a3a4b" d="M150 136 C 156 128, 164 124, 176 124 H 216 V 176 H 112 Z M228 124 H 262 C 276 124, 288 130, 298 142 L 324 176 H 228 Z"/>
    <path fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" d="M70 196 H 330"/>
    <circle cx="112" cy="248" r="32" fill="#0b0f14" stroke="#3a4a5c" stroke-width="6"/><circle cx="112" cy="248" r="12" fill="#56677a"/>
    <circle cx="300" cy="248" r="32" fill="#0b0f14" stroke="#3a4a5c" stroke-width="6"/><circle cx="300" cy="248" r="12" fill="#56677a"/>
    <g class="f-a"><path d="M330 40 l6 18 18 6 -18 6 -6 18 -6 -18 -18 -6 18 -6z"/><path d="M80 70 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4z" opacity=".8"/><path d="M250 80 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" opacity=".6"/></g>
    <g fill="var(--accent)" opacity=".5"><path d="M180 40 c6 9 9 14 9 19 a9 9 0 0 1 -18 0 c0 -5 3 -10 9 -19z"/><path d="M130 30 c4 6 6 9 6 12 a6 6 0 0 1 -12 0 c0 -3 2 -6 6 -12z"/></g>
  </svg>`,

  driving: () => `<svg viewBox="0 0 400 420" aria-hidden="true">
    <path fill="#2f3b35" d="M150 420 C 170 330, 260 300, 270 220 C 278 160, 230 120, 250 0 H 330 C 310 120, 362 170, 350 240 C 336 330, 250 350, 240 420 Z"/>
    <path fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="22 18" d="M195 420 C 215 330, 300 310, 310 230 C 318 165, 270 125, 290 0"/>
    <g transform="rotate(-12 130 170)"><rect x="40" y="80" width="180" height="180" rx="16" fill="#fff" stroke="rgba(0,0,0,.08)" stroke-width="2"/>
    <path class="f-e" d="M98 112 H132 V194 H180 V226 H98 Z"/></g>
    <circle cx="300" cy="330" r="10" class="f-b"/><circle cx="60" cy="350" r="7" class="f-a"/>
  </svg>`
};

/* ------------------------------------------------------------ helpers */

const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/></svg>';
const stars = (n = 5) => '<span class="x-stars" aria-label="' + n + ' stars">' + STAR.repeat(n) + '</span>';

const ICON = {
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  board: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 8v4M11 8v4M14.5 8v4M7.5 16h9"/>',
  car: '<path d="M4 16v-3.5L6.2 8a2 2 0 0 1 1.8-1h8a2 2 0 0 1 1.8 1L20 12.5V16"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="16" r="1.6"/><circle cx="16.5" cy="16" r="1.6"/>',
  house: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5V14h4v5.5"/>',
  doc: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6M9 17h3.5"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.7.5 1 1.3 1 2.1h5c0-.8.3-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  flame: '<path d="M12 21c4 0 7-2.8 7-6.8 0-3.6-2.7-6.1-4.2-9.2-.6 2.3-1.8 3.6-3.1 4.2C11 7 10 5 10 3c-3.4 2.4-7 6.3-7 11.2C3 18.2 7 21 12 21z"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/>',
  boiler: '<rect x="5" y="3" width="14" height="14" rx="2.5"/><path d="M8 7h8M9 17v4M15 17v4"/><circle cx="12" cy="12" r="2"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  dial: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
};
const icon = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[k] || ICON.doc) + '</svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';

const strip = (s) => s.replace(/<[^>]+>/g, '');

/* The gallery: on a real site, the customer's own photos. Here, soft
   colour fields in the site's palette, and a note that says so. */
const SPOTS = [[28, 30, 72, 78], [70, 24, 30, 80], [40, 70, 75, 25], [22, 64, 66, 20], [60, 40, 25, 75], [35, 25, 70, 70]];
function gallery(e) {
  const g = e.gallery;
  if (!g) return '';
  const tiles = g.items.map((t, i) => {
    const s = SPOTS[i % SPOTS.length];
    return `<a class="x-tile x-tile-${i}" href="${free(e)}" style="--x1:${s[0]}%;--y1:${s[1]}%;--x2:${s[2]}%;--y2:${s[3]}%"><span>${t}</span></a>`;
  }).join('');
  return `<section class="x-sec x-gallery-sec" id="work" data-k1-seen="the gallery">
    <div class="x-wrap">
      <div class="x-head"><h2>${g.h}</h2>
        <p class="k1-note"><span class="k1-note-dot" aria-hidden="true"></span>On your site, this is your own work, taken from your Instagram.</p></div>
      <div class="x-gallery">${tiles}</div>
    </div>
  </section>`;
}

function prices(e) {
  const p = e.prices;
  const F = free(e);
  let body = '';
  if (p.style === 'menu') {
    body = '<div class="x-menu">' + p.groups.map(([h, rows]) => `<div class="x-menu-group"><h3>${h}</h3><ul>` +
      rows.map(([n, pr]) => `<li><span>${n}</span><i aria-hidden="true"></i><b>${pr}</b></li>`).join('') + '</ul></div>').join('') + '</div>';
  } else if (p.style === 'cards') {
    body = '<div class="x-cards">' + p.items.map(([n, d, pr, t]) => `<a class="x-card" href="${F}"><div class="x-card-top"><h3>${n}</h3><b>${pr}</b></div><p>${d}</p><span class="x-card-meta">${t}<em>Book &rsaquo;</em></span></a>`).join('') + '</div>';
  } else if (p.style === 'packages') {
    body = '<div class="x-pkgs">' + p.items.map(([n, pr, list, hot]) => `<div class="x-pkg${hot ? ' is-hot' : ''}">${hot ? '<span class="x-pkg-flag">Most popular</span>' : ''}<h3>${n}</h3><p class="x-pkg-price">${pr}</p><ul>` +
      list.map((l) => `<li>${CHECK}<span>${l}</span></li>`).join('') + `</ul><a class="x-btn ${hot ? '' : 'x-btn-ghost'}" href="${F}">Book ${strip(n).toLowerCase().startsWith('the') ? 'this' : 'now'}</a></div>`).join('') + '</div>';
  } else if (p.style === 'table') {
    body = '<div class="x-table">' + p.rows.map(([a, b, c, d]) => `<a class="x-row" href="${F}"><span class="x-row-a">${a}</span><span class="x-row-b"><b>${b}</b>${c ? `<small>${c}</small>` : ''}</span><span class="x-row-d">${d}</span><span class="x-row-go" aria-hidden="true">&rsaquo;</span></a>`).join('') + '</div>';
  } else if (p.style === 'grid') {
    body = '<div class="x-grid">' + p.items.map(([ic, n, d, pr]) => `<a class="x-svc" href="${F}"><span class="x-svc-ico">${icon(ic)}</span><h3>${n}</h3><p>${d}</p><span class="x-svc-price">${pr}<em>&rsaquo;</em></span></a>`).join('') + '</div>';
  }
  return `<section class="x-sec x-prices-sec" id="prices" data-k1-seen="the prices">
    <div class="x-wrap">
      <div class="x-head"><p class="x-eyebrow">${p.eyebrow}</p><h2>${p.h}</h2>${p.note ? `<p>${p.note}</p>` : ''}</div>
      ${body}
    </div>
  </section>`;
}

function reviews(e) {
  return `<section class="x-sec x-reviews-sec" id="reviews" data-k1-seen="the reviews">
    <div class="x-wrap">
      <div class="x-head"><p class="x-eyebrow">Reviews</p><h2>${e.layout === 'play' && e.key === 'kids' ? 'What parents say' : 'What clients say'}</h2></div>
      <div class="x-reviews">${e.reviews.map(([t, n, w]) => `<figure class="x-review">${stars()}<blockquote>&ldquo;${t}&rdquo;</blockquote><figcaption><b>${n}</b> &middot; ${w}</figcaption></figure>`).join('')}</div>
      <p class="x-reviews-more"><a href="${free(e)}">${stars()} ${e.hero.rating.includes('Google') ? e.hero.rating : 'Read more reviews on Google'} &rsaquo;</a></p>
    </div>
  </section>`;
}

function visit(e) {
  const v = e.visit, F = free(e);
  return `<section class="x-sec x-visit-sec" id="visit">
    <div class="x-wrap x-visit">
      <div class="x-visit-main">
        <p class="x-eyebrow">${e.place}</p><h2>${v.h}</h2>
        <p class="x-visit-addr">${v.address}</p><p class="x-visit-note">${v.note}</p>
        <div class="x-visit-btns"><a class="x-btn" href="${F}">${PHONE}<span>${v.phone}</span></a><a class="x-btn x-btn-ghost" href="${F}">Message us</a></div>
      </div>
      <dl class="x-hours">${v.hours.map(([d, h]) => `<div><dt>${d}</dt><dd>${h}</dd></div>`).join('')}</dl>
    </div>
  </section>`;
}

function band(e) {
  const b = e.band;
  return `<section class="x-band"><div class="x-wrap"><h2>${b.h}</h2><p>${b.p}</p><a class="x-btn x-btn-band" href="${free(e)}">${b.cta}</a></div></section>`;
}

function steps(e) {
  const s = e.steps;
  if (!s) return '';
  return `<section class="x-sec x-steps-sec"><div class="x-wrap"><div class="x-head"><h2>${s.h}</h2></div><ol class="x-steps">${s.items.map(([h, p], i) => `<li><span class="x-step-n">${i + 1}</span><h3>${h}</h3><p>${p}</p></li>`).join('')}</ol></div></section>`;
}

function info(e) {
  const s = e.info || e.why;
  if (!s) return '';
  return `<section class="x-sec x-info-sec"><div class="x-wrap"><div class="x-head"><h2>${s.h}</h2></div><div class="x-info">${s.items.map(([h, p], i) => `<div class="x-info-item x-info-${i}"><span class="x-info-ico" aria-hidden="true">${CHECK}</span><h3>${h}</h3><p>${p}</p></div>`).join('')}</div></div></section>`;
}

function about(e) {
  const a = e.about;
  if (!a) return '';
  return `<section class="x-sec x-about-sec"><div class="x-wrap x-about"><div class="x-about-art"><span>Your photo here</span></div><div><p class="x-eyebrow">${a.eyebrow}</p><h2>${a.h}</h2><p>${a.p}</p><p class="x-sign">${a.sign}</p><a class="x-link" href="${free(e)}">Meet the team &rsaquo;</a></div></div></section>`;
}

function chips(e) {
  const c = e.flavours || e.areas;
  if (!c) return '';
  return `<section class="x-sec x-chips-sec" id="areas"><div class="x-wrap"><div class="x-head"><h2>${c.h}</h2></div><div class="x-chips">${c.items.map((t) => `<a class="x-chip" href="${free(e)}">${t}</a>`).join('')}</div></div></section>`;
}

function addons(e) {
  const a = e.addons;
  if (!a) return '';
  return `<section class="x-sec x-addons-sec"><div class="x-wrap"><div class="x-head"><h2>${a.h}</h2></div><div class="x-addons">${a.items.map(([n, p]) => `<a class="x-addon" href="${free(e)}"><span>${n}</span><b>${p}</b></a>`).join('')}</div></div></section>`;
}

function banner(e) {
  const b = e.banner;
  if (!b) return '';
  return `<section class="x-sec x-banner-sec"><div class="x-wrap"><a class="x-banner" href="${free(e)}"><div><h2>${b.h}</h2><p>${b.p}</p></div><span class="x-btn">${b.cta}</span></a></div></section>`;
}

function faq(e) {
  if (!e.faq) return '';
  return `<section class="x-sec x-faq-sec" id="faq"><div class="x-wrap"><div class="x-head"><h2>Questions</h2></div><div class="x-faq">${e.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div></section>`;
}

function trust(e) {
  if (!e.trust) return '';
  return `<div class="x-trust"><div class="x-wrap">${e.trust.map((t) => `<span>${CHECK}${t}</span>`).join('')}</div></div>`;
}

/* -------------------------------------------------------------- the hero */

function hero(e) {
  const h = e.hero, F = free(e);
  const art = `<div class="x-art x-art-${h.art}">${ART[h.art]()}</div>`;
  if (e.layout === 'trade') {
    return `<section class="x-hero"><div class="x-wrap x-hero-in">
      <div class="x-hero-copy">
        <p class="x-eyebrow">${h.eyebrow}</p><h1>${h.h1}</h1><p class="x-sub">${h.sub}</p>
        <ul class="x-checks">${h.checks.map((c) => `<li>${CHECK}<span>${c}</span></li>`).join('')}</ul>
        <p class="x-rating">${stars()}<span>${h.rating}</span></p>
      </div>
      <div class="x-quote">
        ${art}
        <h2>What do you need?</h2>
        <div class="x-jobs">${h.jobs.map((j) => `<a href="${F}">${j}</a>`).join('')}</div>
        <a class="x-btn x-btn-wide" href="${F}">${e.cta}</a>
        <a class="x-call" href="${F}">${PHONE}<span>Or call <b>${e.visit.phone}</b></span></a>
      </div>
    </div></section>`;
  }
  return `<section class="x-hero"><div class="x-wrap x-hero-in">
    <div class="x-hero-copy">
      <p class="x-eyebrow">${h.eyebrow}</p><h1>${h.h1}</h1><p class="x-sub">${h.sub}</p>
      <div class="x-hero-btns"><a class="x-btn" href="${F}">${e.cta}</a><a class="x-btn x-btn-ghost" href="${F}">${h.second}</a></div>
      <p class="x-rating">${h.rating.includes('Google') ? stars() : ''}<span>${h.rating}</span></p>
    </div>
    ${art}
  </div></section>`;
}

/* -------------------------------------------------------------- the page */

const ORDER = {
  editorial: (e) => [hero(e), prices(e), e.flavours ? chips(e) : '', about(e), steps(e), gallery(e), reviews(e), visit(e), band(e)],
  soft:      (e) => [hero(e), prices(e), info(e), gallery(e), reviews(e), band(e), visit(e)],
  dark:      (e) => [hero(e), prices(e), addons(e), steps(e), gallery(e), reviews(e), band(e), visit(e)],
  play:      (e) => [hero(e), banner(e), info(e), prices(e), reviews(e), faq(e), band(e), visit(e)],
  trade:     (e) => [hero(e), trust(e), prices(e), chips(e), reviews(e), band(e), visit(e)]
};

function themeCss(t) {
  const v = {
    '--bg': t.bg, '--ink': t.ink, '--muted': t.muted, '--accent': t.accent, '--accent2': t.accent2,
    '--accent3': t.accent3 || t.accent2, '--accent4': t.accent4 || t.accent, '--soft': t.soft, '--surface': t.surface,
    '--line': t.line, '--fh': t.fh, '--fb': t.fb, '--hw': t.hw, '--hls': t.hls, '--radius': t.radius,
    '--btn-radius': t.btnRadius, '--on-accent': t.onAccent, '--hero': t.hero || t.bg, '--hero-ink': t.heroInk || t.ink,
    '--case': t.upper ? 'uppercase' : 'none'
  };
  return ':root{' + Object.entries(v).map(([k, val]) => k + ':' + val).join(';') + '}';
}

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
  <a class="k1-go" href="${free(e)}">Get yours free</a>
  <a class="k1-x" href="${free(e)}" aria-label="Close the example"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></a>
</div>`;
}

function page(e) {
  const F = free(e);
  const title = `Example ${strip(e.one).replace(/&rsquo;/g, '’')} website | Kanvas One`;
  const desc = `What a ${strip(e.one).replace(/&rsquo;/g, '’')} website from Kanvas One could look like. Get yours designed free within 24 hours.`;
  const navLinks = e.nav.map((n) => `<a href="${F}">${n}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<!-- A made-up business, so it is never offered to someone searching for it. -->
<meta name="robots" content="noindex, follow">
<meta name="theme-color" content="${e.theme.hero || e.theme.bg}">
<link rel="icon" href="/assets/favicon.svg?v=4" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${e.fonts}&display=swap">
<link rel="stylesheet" href="/examples/ex.css?v=${EX_CSS_V}">
<style>${themeCss(e.theme)}</style>
</head>
<body class="L-${e.layout} T-${e.key}">
${e.topbar ? `<a class="x-top" href="${F}">${PHONE}<span>${e.topbar}</span><b>${e.visit.phone}</b></a>` : ''}
<header class="x-nav">
  <div class="x-wrap x-nav-in">
    <a class="x-logo" href="${F}">${e.name}</a>
    <nav class="x-links" aria-label="${strip(e.name)}">${navLinks}</nav>
    <a class="x-btn x-btn-nav" href="${F}"><span class="x-long">${e.cta}</span><span class="x-short">${e.ctaShort || 'Book'}</span></a>
  </div>
</header>
<main>
${ORDER[e.layout](e).filter(Boolean).join('\n')}
</main>
<footer class="x-foot">
  <div class="x-wrap">
    <p class="x-foot-logo">${e.name}</p>
    <p>${e.visit.address} &middot; ${e.visit.phone}</p>
    <nav class="x-foot-links" aria-label="Footer">${e.nav.map((n) => `<a href="${F}">${n}</a>`).join('')}<a href="${F}">Privacy</a></nav>
    <p class="x-credit"><a href="${F}">Website by Kanvas One</a></p>
  </div>
</footer>
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
    <p class="foot-legal">All prices in GBP. The price you see is the total price &mdash; we are not VAT registered, so there is no VAT to add. Your page goes live on your own address the same day you join; the features you ask for are built within 14 days of joining, or your next month is free (see terms). Your web address is included for as long as your plan is active. It is registered and renewed by us on your behalf; if you leave, we transfer it to you. Cancel anytime &mdash; no further payments are taken.</p>
    <p class="foot-copy">&copy; <span id="year">2026</span> Kanvas. All rights reserved.</p>
  </div>
</footer>

<script src="/consent.js?v=9"></script>
<script src="/supabase-config.js?v=1"></script>
<script src="/session.js?v=3"></script>
<script src="/script.js?v=${o.scriptV}"></script>
<script src="/chat.js?v=6" data-site="${SITE_ID}" data-name="Kanvas One" data-trigger="#navChat" data-full defer></script>
<script src="/beacon.js?v=4" data-site="${SITE_ID}" defer></script>
<script src="/admin-pill.js?v=8"></script>
</body>
</html>
`;
}

function indexPage(v) {
  const cards = EXAMPLES.map((e) => `<a class="exg-card reveal" href="/examples/${e.slug}">
        <span class="exg-shot"><img src="/assets/examples/${e.slug}.jpg" alt="" width="390" height="720" loading="lazy" decoding="async"></span>
        <span class="exg-meta"><b>${e.label}</b><span>${e.name}</span></span>
        <span class="exg-go">View example &rsaquo;</span>
      </a>`).join('\n      ');
  return shell({
    cssV: v.cssV, scriptV: v.scriptV,
    title: 'Example Websites for Local Businesses | Kanvas One',
    desc: 'See what your website could look like. Example sites for hairdressers, electricians, cake makers, nail techs and more, then get yours designed free within 24 hours.',
    canonical: 'https://kanvas.one/examples',
    body: `<section class="page-hero exg-hero">
  <div class="wrap center">
    <p class="sb-tag reveal">Examples</p>
    <h1 class="reveal">See what yours could <span class="g-free">look like.</span></h1>
    <p class="sub reveal">Example websites for local businesses. Pick yours, have a look around, then get your own designed free within 24 hours.</p>
  </div>
</section>
<section class="section pt0">
  <div class="wrap">
    <div class="exg">
      ${cards}
    </div>
    <div class="exg-end reveal">
      <h2>Don&rsquo;t see your business?</h2>
      <p>We design for every kind of local business. Send us your name and we&rsquo;ll design yours, free.</p>
      <a class="btn exg-btn" href="/free">Get my free design</a>
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
