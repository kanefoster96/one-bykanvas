/* What every list screen shares: a scrolling page under a large title,
   pull down to refresh (with a tap of vibration when it catches), and
   reloading when the screen comes back into view or a notification says
   something changed. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { C, PAD } from '../theme';
import { bus } from '../lib/bus';
import { haptic } from '../lib/phone';

/* load(quiet) fetches and sets state; it runs on first show, when the
   screen is shown again (quietly), on pull, and on a 'refresh' signal
   while it is on screen. Returns { refreshing, onRefresh, reload }. */
export function useLoad(load, deps) {
  const [refreshing, setRefreshing] = useState(false);
  const focused = useIsFocused();
  const first = useRef(true);
  const fn = useRef(load);
  fn.current = load;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { const q = !first.current; first.current = false; Promise.resolve(fn.current(q)).catch(() => {}); }, deps || []));
  useEffect(() => bus.on('refresh', () => { if (focused) Promise.resolve(fn.current(true)).catch(() => {}); }), [focused]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.light();
    try { await fn.current(true); } catch (e) { /* the screen shows its own error */ }
    setRefreshing(false);
  }, []);
  return { refreshing, onRefresh, reload: (q) => fn.current(q) };
}

/* A repeating timer while the screen is on show (live numbers, a chat). */
export function useEvery(ms, fn, on = true) {
  const focused = useIsFocused();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!focused || !on || !ms) return undefined;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [focused, ms, on]);
}

export function Page({ children, refreshing, onRefresh, style, contentStyle, scrollRef, ...rest }) {
  return (
    <ScrollView
      ref={scrollRef}
      style={[s.page, style]}
      contentContainerStyle={[s.content, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink2} /> : undefined}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: PAD, paddingBottom: 40, paddingTop: 6 }
});
