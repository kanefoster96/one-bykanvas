/* The app's icons: the same line drawings the web app uses (24 grid,
   1.8 stroke, round ends), so the two read as one product. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const P = {
  build: [['p', 'M9 5h10M9 12h10M9 19h10'], ['p', 'm3.5 5 1.2 1.2L7 4'], ['p', 'm3.5 12 1.2 1.2L7 11'], ['p', 'M4 19h2']],
  chart: [['p', 'M4 20V10'], ['p', 'M10 20V4'], ['p', 'M16 20v-7'], ['p', 'M22 20H2']],
  home: [['p', 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z']],
  chat: [['p', 'M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z']],
  contacts: [['c', 12, 8, 4], ['p', 'M4 21a8 8 0 0 1 16 0']],
  grid: [['r', 3, 3, 8, 8, 2], ['r', 13, 3, 8, 8, 2], ['r', 3, 13, 8, 8, 2], ['r', 13, 13, 8, 8, 2]],
  mail: [['r', 3, 5, 18, 14, 3], ['p', 'M3.5 7l8.5 6 8.5-6']],
  support: [['c', 12, 12, 9], ['p', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7'], ['p', 'M12 17h.01']],
  bell: [['p', 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9'], ['p', 'M13.7 21a2 2 0 0 1-3.4 0']],
  user: [['c', 12, 8, 4], ['p', 'M4 21a8 8 0 0 1 16 0']],
  anon: [['c', 12, 9, 3.6], ['p', 'M5.5 19.5a6.5 6.5 0 0 1 13 0']],
  send: [['p', 'M12 19V5'], ['p', 'M5 12l7-7 7 7']],
  clip: [['p', 'M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9']],
  photo: [['r', 3, 4, 18, 16, 3], ['c', 9, 10, 2], ['p', 'M21 16l-5-5-9 9']],
  doc: [['p', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'], ['p', 'M14 3v5h5']],
  chevron: [['p', 'm9 5 7 7-7 7']],
  down: [['p', 'm6 9 6 6 6-6']],
  back: [['p', 'm15 5-7 7 7 7']],
  close: [['p', 'M6 6l12 12M18 6L6 18']],
  plus: [['p', 'M12 5v14M5 12h14']],
  more: [['c', 5, 12, 1.2, true], ['c', 12, 12, 1.2, true], ['c', 19, 12, 1.2, true]],
  search: [['c', 11, 11, 7], ['p', 'm20 20-3.5-3.5']],
  check: [['p', 'm5 12.5 4.5 4.5L19 7.5']],
  phone: [['p', 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2']],
  share: [['p', 'M12 3v12'], ['p', 'm7 8 5-5 5 5'], ['p', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6']],
  globe: [['c', 12, 12, 9], ['p', 'M3 12h18'], ['p', 'M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18']],
  pin: [['p', 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z'], ['c', 12, 9, 2.5]],
  edit: [['p', 'M4 20h4L19 9l-4-4L4 16z'], ['p', 'm13.5 6.5 4 4']],
  trash: [['p', 'M4 7h16'], ['p', 'M9 7V4h6v3'], ['p', 'M6 7l1 13h10l1-13']],
  lock: [['r', 5, 11, 14, 10, 2], ['p', 'M8 11V7a4 4 0 0 1 8 0v4']],
  pound: [['p', 'M16.5 7A3.8 3.8 0 0 0 9.5 8.6V12c0 3.4-1.2 5.9-3 7.5h11'], ['p', 'M6.5 13h7.5']]
};

export default function Icon({ name, size = 24, color = '#1d1d1f', stroke = 1.8 }) {
  const parts = P[name] || [];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {parts.map((p, i) => {
        if (p[0] === 'p') return <Path key={i} d={p[1]} />;
        if (p[0] === 'c') return <Circle key={i} cx={p[1]} cy={p[2]} r={p[3]} fill={p[4] ? color : 'none'} />;
        return <Rect key={i} x={p[1]} y={p[2]} width={p[3]} height={p[4]} rx={p[5]} />;
      })}
    </Svg>
  );
}
