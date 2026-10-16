/* A conversation screen: messages that scroll, the box pinned to the
   bottom, and the keyboard pushing the box up rather than covering it.
   Starts at the newest message, and follows new ones as they arrive. */
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

export default function ThreadLayout({ children, composer, follow, startAtTop, refreshing, onRefresh, above }) {
  const ref = useRef(null);
  const headerH = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const atEnd = useRef(true);
  /* The home-bar gap under the box only while the keyboard is down. */
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  useEffect(() => {
    if (startAtTop) return;
    const t = setTimeout(() => { if (ref.current && atEnd.current) ref.current.scrollToEnd({ animated: true }); }, 60);
    return () => clearTimeout(t);
  }, [follow, startAtTop]);
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? headerH : 0}>
      {above}
      <ScrollView
        ref={ref}
        style={s.list}
        contentContainerStyle={s.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => { const n = e.nativeEvent; atEnd.current = n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - 80; }}
        scrollEventThrottle={64}
        onContentSizeChange={() => { if (!startAtTop && atEnd.current && ref.current) ref.current.scrollToEnd({ animated: false }); }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink2} /> : undefined}
      >
        {children}
      </ScrollView>
      <View style={{ paddingBottom: kb ? 0 : insets.bottom, backgroundColor: '#fff' }}>{composer}</View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  list: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 }
});
