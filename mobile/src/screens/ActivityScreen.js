/* The bell: payments, bookings, messages and replies from Kane, newest
   first, what is new since last time picked out. Tap one to open it. */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty, FadeIn, Skeleton } from '../components/ui';
import Press from '../components/Press';
import { useLoad } from '../components/screen';
import { useApp } from '../state/app';
import { api } from '../lib/api';
import { openLink } from '../lib/push';
import { nav } from '../navRef';
import { ago } from '../lib/format';
import { C } from '../theme';

const ICON = { money_in: '£', money_failed: '!', money_refund: '↩', money_cancelled: '✕', work: '⚒', booking: '◷', person: '☺', enquiry: '✉', chat: '…', review: '★', support: '?' };

export default function ActivityScreen({ navigation }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState(null);
  const [seenAt] = useState(() => (app.me && app.me.user && app.me.user.notifications_seen_at ? new Date(app.me.user.notifications_seen_at).getTime() : Date.now() - 864e5));
  const [error, setError] = useState('');
  useLoad(async () => {
    try {
      const res = await api({ action: 'events' });
      setRows(res.events || []);
      await api({ action: 'seen' });
      app.refreshMe();
    } catch (e) { setError(e.message); }
  });
  const unreadBefore = (app.me && app.me.unread && app.me.unread.notifications) || 0;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={s.title}>Activity</Text>
      {!rows ? (error ? <Empty title="Could not load activity" text={error} /> : [0, 1, 2, 3].map((i) => <Skeleton key={i} height={52} style={{ marginTop: 14 }} />)) : null}
      {rows && !rows.length ? <Empty text="Nothing yet. Payments, bookings, messages and replies from Kane all land here." /> : null}
      {(rows || []).map((n, i) => {
        const isNew = i < unreadBefore || new Date(n.created_at).getTime() > seenAt;
        return (
          <FadeIn key={i} delay={Math.min(i, 8) * 30}>
            <Press onPress={() => { navigation.goBack(); setTimeout(() => openLink(nav, app, n), 250); }} scale={0.985} style={s.row}>
              <View style={[s.icon, isNew && { backgroundColor: C.or }]}><Text style={[s.iconText, isNew && { color: '#fff' }]}>{ICON[n.kind] || '•'}</Text></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.rowTitle, isNew && { fontWeight: '700' }]} numberOfLines={2}>{n.title}</Text>
                {n.body ? <Text style={s.rowText} numberOfLines={2}>{n.body}</Text> : null}
              </View>
              <Text style={s.when}>{ago(n.created_at)}</Text>
            </Press>
          </FadeIn>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingTop: 26 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: C.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.grey, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16, fontWeight: '700', color: C.ink },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: C.ink },
  rowText: { marginTop: 2, fontSize: 14, lineHeight: 19, color: C.ink2 },
  when: { marginLeft: 8, fontSize: 13, color: C.ink3 }
});
