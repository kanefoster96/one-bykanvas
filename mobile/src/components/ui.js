/* The building blocks every screen is made of. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LayoutAnimation, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Press from './Press';
import Icon from './Icon';
import { C, H, OR_GRAD, R, T } from '../theme';
import { haptic } from '../lib/phone';
import { initials } from '../lib/format';

/* A list that changes (a row in, a row out) moves rather than jumps. */
export function animateNext() {
  if (Platform.OS === 'web') return;
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

/* primary: the orange gradient, the one thing to do here.
   dark: black, for a strong second choice. ghost: white with a line.
   danger: red words, for removing something. */
export function Button({ title, onPress, kind = 'primary', small, busy, disabled, icon, style, feel, testID }) {
  const h = small ? H.btnSm : H.btn;
  const txt = kind === 'primary' || kind === 'dark' ? '#fff' : kind === 'danger' ? C.bad : C.ink;
  const inner = (
    <View style={[s.btnInner, { height: h, paddingHorizontal: small ? 16 : 22 }]}>
      {busy ? <ActivityIndicator color={txt} /> : (
        <>
          {icon ? <View style={{ marginRight: 8 }}><Icon name={icon} size={small ? 18 : 20} color={txt} /></View> : null}
          <Text style={[s.btnText, { color: txt, fontSize: small ? 14.5 : 16 }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </View>
  );
  return (
    <Press testID={testID} onPress={onPress} disabled={disabled || busy} feel={feel || (kind === 'primary' ? 'medium' : 'light')}
      style={[s.btn, { borderRadius: R.pill }, kind === 'dark' && { backgroundColor: C.ink }, kind === 'ghost' && s.ghost, kind === 'danger' && s.ghost, style]}>
      {kind === 'primary' ? <LinearGradient {...OR_GRAD} style={{ borderRadius: R.pill }}>{inner}</LinearGradient> : inner}
    </Press>
  );
}

/* A small rounded action: Call, Email, Open file. */
export function Chip({ title, onPress, dark, icon, disabled }) {
  const color = dark ? '#fff' : C.ink;
  const body = (
    <View style={s.chipInner}>
      {icon ? <View style={{ marginRight: 6 }}><Icon name={icon} size={16} color={color} /></View> : null}
      <Text style={[s.chipText, { color }]}>{title}</Text>
    </View>
  );
  return (
    <Press onPress={onPress} disabled={disabled} style={[s.chip, dark && s.chipDarkWrap]}>
      {dark ? <LinearGradient {...OR_GRAD} style={{ borderRadius: R.pill }}>{body}</LinearGradient> : body}
    </Press>
  );
}

/* Pills in a track, one chosen: the period on Analytics, Inbox or
   Contacts. The black pill slides to the one tapped. */
export function Segmented({ options, value, onChange, style, stretch }) {
  const [boxes, setBoxes] = useState({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const ready = useRef(false);
  useEffect(() => {
    const b = boxes[value];
    if (!b) return;
    if (!ready.current) { x.setValue(b.x); w.setValue(b.width); ready.current = true; return; }
    Animated.parallel([
      Animated.spring(x, { toValue: b.x, useNativeDriver: false, speed: 22, bounciness: 4 }),
      Animated.spring(w, { toValue: b.width, useNativeDriver: false, speed: 22, bounciness: 4 })
    ]).start();
  }, [value, boxes, x, w]);
  return (
    <View style={[s.seg, stretch && { alignSelf: 'stretch' }, style]}>
      {boxes[value] ? <Animated.View style={[s.segOn, { left: x, width: w }]} /> : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Press key={o.value} feel={null} scale={0.95} onPress={() => { if (!on) { haptic.select(); onChange(o.value); } }}
            style={[s.segItem, stretch && { flex: 1 }]} accessibilityRole="tab"
            onLayout={(e) => { const l = e.nativeEvent.layout; setBoxes((b) => ({ ...b, [o.value]: { x: l.x, width: l.width } })); }}>
            <View style={[s.segPad, stretch && { alignItems: 'center' }]}>
              <Text style={[s.segText, on && { color: '#fff' }]} numberOfLines={1}>{o.label}</Text>
              {o.dot ? <View style={s.segDot} /> : null}
            </View>
          </Press>
        );
      })}
    </View>
  );
}

export function Card({ children, style, night }) {
  return <View style={[s.card, night && s.night, style]}>{children}</View>;
}

export function Label({ children, orange, style, night }) {
  return <Text style={[orange ? T.orLabel : T.label, night && { color: C.orLight }, style]}>{children}</Text>;
}

/* A request's or a build's state, as a small coloured tag. */
const TAG = {
  reply: { bg: C.orSoft, fg: C.orSoftText },
  waiting: { bg: C.orSoft, fg: C.orSoftText },
  building: { bg: C.ink, fg: '#fff' },
  done: { bg: C.grey, fg: C.ink2 },
  cancelled: { bg: C.grey, fg: C.ink3 },
  plain: { bg: C.grey, fg: C.ink2 }
};
export function Tag({ text, kind = 'plain', style }) {
  const t = TAG[kind] || TAG.plain;
  return (
    <View style={[s.tag, { backgroundColor: t.bg }, style]}>
      <Text style={[s.tagText, { color: t.fg }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/* A person: their initials on black, or an outline when we don't know
   who they are. A dot in the corner: orange when they're on the site now. */
export function Avatar({ name, size = 46, online, badge }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={[s.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: name ? C.ink : C.grey }]}>
        {name ? <Text style={[s.avText, { fontSize: size * 0.35 }]}>{initials(name)}</Text> : <Icon name="anon" size={size * 0.52} color={C.ink2} />}
      </View>
      {online ? <View style={[s.avDot, { backgroundColor: C.or2 }]} /> : badge ? <View style={s.avBadge}><Icon name="chat" size={10} color="#fff" stroke={2.4} /></View> : null}
    </View>
  );
}

export function Empty({ title, text, style }) {
  return (
    <View style={[s.empty, style]}>
      {title ? <Text style={s.emptyTitle}>{title}</Text> : null}
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
    </View>
  );
}

/* What happened: a quiet line under a form, red when it went wrong. */
export function Note({ text, bad, ok, style }) {
  if (!text) return null;
  return <Text style={[s.note, bad && { color: C.bad }, ok && { color: C.ink }, style]}>{text}</Text>;
}

export function Field({ label, style, inputStyle, multiline, ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={style}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={C.ink3}
        {...rest}
        multiline={multiline}
        onFocus={(e) => { setFocus(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur && rest.onBlur(e); }}
        style={[s.field, multiline && s.fieldMulti, focus && { borderColor: C.ink }, inputStyle]}
      />
    </View>
  );
}

/* A row in a white list: tap to open, chevron on the right. */
export function Row({ title, sub, onPress, right, left, last, testID }) {
  return (
    <Press testID={testID} onPress={onPress} scale={0.985} style={[s.row, !last && s.rowLine]}>
      {left ? <View style={{ marginRight: 14 }}>{left}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right !== undefined ? right : <Icon name="chevron" size={18} color={C.ink3} />}
    </Press>
  );
}

/* A gentle shimmer where content is about to be, instead of a spinner. */
export function Skeleton({ height = 18, width = '100%', radius = 8, style }) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: C.lineSoft, opacity: v }, style]} />;
}

/* Comes in from slightly below, once, when it first appears. */
export function FadeIn({ children, delay = 0, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

export function Badge({ n, style }) {
  if (!n) return null;
  return <View style={[s.badge, style]}><Text style={s.badgeText}>{n > 99 ? '99+' : String(n)}</Text></View>;
}

const s = StyleSheet.create({
  btn: { alignSelf: 'stretch' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '600', letterSpacing: -0.2 },
  ghost: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  chip: { borderRadius: R.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  chipDarkWrap: { borderWidth: 0 },
  chipInner: { height: H.btnSm, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.grey, borderRadius: R.pill, padding: 3 },
  segOn: { position: 'absolute', top: 3, bottom: 3, borderRadius: R.pill, backgroundColor: C.ink },
  segItem: {},
  segPad: { height: H.seg, paddingHorizontal: 14, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  segDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.or2, marginLeft: 6 },
  card: { backgroundColor: C.grey, borderRadius: R.cardLg, padding: 18 },
  night: { backgroundColor: C.night },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill },
  tagText: { fontSize: 12, fontWeight: '600' },
  av: { alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontWeight: '600', letterSpacing: 0.4 },
  avDot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  avBadge: { position: 'absolute', right: -2, bottom: -2, width: 19, height: 19, borderRadius: 10, backgroundColor: C.ink, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 36, paddingHorizontal: 8, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.ink, textAlign: 'center' },
  emptyText: { marginTop: 6, fontSize: 15, lineHeight: 21, color: C.ink2, textAlign: 'center' },
  note: { marginTop: 8, fontSize: 14, lineHeight: 19, color: C.ink2 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 6 },
  field: { minHeight: H.field, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 16, color: C.ink, backgroundColor: '#fff' },
  fieldMulti: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, backgroundColor: '#fff' },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowTitle: { fontSize: 16.5, fontWeight: '600', color: C.ink },
  rowSub: { marginTop: 3, fontSize: 14, color: C.ink2 },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' }
});
