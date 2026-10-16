/* The app's look, from the website's tokens (styles.css :root): black,
   white and orange. Orange is for the one thing to do on a screen and for
   what needs attention; black cards hold the numbers that matter. */
export const C = {
  ink: '#1d1d1f',
  ink2: '#6e6e73',
  ink3: '#86868b',
  bg: '#ffffff',
  grey: '#f5f5f7',
  line: '#d2d2d7',
  lineSoft: '#e8e8ed',
  night: '#0b0b0d',
  night2: '#18181b',
  nightLine: 'rgba(255,255,255,0.1)',
  onNight: '#f5f5f2',
  onNight2: 'rgba(245,245,242,0.68)',
  or: '#c93e09',
  or2: '#ef4a10',
  orLight: '#ff8a4c',
  orSoft: '#fff1ea',
  orSoftText: '#c2410c',
  bad: '#b3261e',
  badSoft: '#fdecea',
  privateBg: '#fdf6e9',
  privateText: '#8a5a17'
};

/* The orange gradient on main buttons (135deg, #c93e09 to #ef4a10). */
export const OR_GRAD = { colors: ['#c93e09', '#ef4a10'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
/* Orange title text: the lighter end, so it reads on black. */
export const OR_TEXT = { colors: ['#ff8a4c', '#ff5a1f', '#ef4a10'], start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };

export const H = { btn: 48, btnSm: 40, seg: 36, field: 48 };
export const R = { card: 18, cardLg: 22, pill: 999 };
export const PAD = 20;

/* Type: the phone's own system font (SF on iPhone), the website's sizes. */
export const T = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: C.ink },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: C.ink },
  head: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, color: C.ink },
  body: { fontSize: 16, lineHeight: 22, color: C.ink },
  sub: { fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  small: { fontSize: 13, color: C.ink3 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.ink3 },
  orLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.or }
};
