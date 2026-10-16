/* Anything tappable: it gives a little under the finger (scales down a
   touch and dims), springs back on release, and gives a light tap of
   vibration when it fires. The one place press feel is decided.

   Where it sits (width, flex, margins, position) is set on the pressable
   itself; how it looks (colour, padding, corners, the children's layout)
   on the layer inside that scales. */
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { haptic } from '../lib/phone';

const OUTER = /^(width|flex|flexGrow|flexShrink|flexBasis|alignSelf|margin.*|position|top|left|right|bottom|minWidth|maxWidth|zIndex)$/;

function split(style) {
  const flat = StyleSheet.flatten(style) || {};
  const outer = {};
  const inner = {};
  Object.keys(flat).forEach((k) => { if (OUTER.test(k)) outer[k] = flat[k]; else inner[k] = flat[k]; });
  if (outer.flex || outer.width || outer.alignSelf === 'stretch') inner.flexGrow = 1;
  return [outer, inner];
}

export default function Press({ onPress, onLongPress, style, children, disabled, feel = 'light', scale = 0.97, accessibilityLabel, accessibilityRole = 'button', hitSlop, testID, onLayout }) {
  const v = useRef(new Animated.Value(0)).current;
  const to = (n) => Animated.spring(v, { toValue: n, useNativeDriver: true, speed: 40, bounciness: n ? 0 : 6 }).start();
  const s = v.interpolate({ inputRange: [0, 1], outputRange: [1, scale] });
  const o = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const [outer, inner] = split(style);
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : (e) => { if (feel && haptic[feel]) haptic[feel](); if (onPress) onPress(e); }}
      onLongPress={disabled || !onLongPress ? undefined : (e) => { haptic.medium(); onLongPress(e); }}
      onPressIn={disabled ? undefined : () => to(1)}
      onPressOut={() => to(0)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={outer}
      onLayout={onLayout}
    >
      <Animated.View style={[inner, { transform: [{ scale: s }], opacity: disabled ? 0.45 : o }]}>{children}</Animated.View>
    </Pressable>
  );
}
