/* The chat with Kane: quick questions, photos and files (a logo, coach
 * photos, a price list). Polled while it is on screen; Kane's replies also
 * arrive as notifications. Files go into the customer's own folder in the
 * private attachments bucket and the server signs a link to each. */
import { useCallback, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ThreadLayout from '../../components/ThreadLayout';
import { Bubble, Composer } from '../../components/chat';
import { Empty, Skeleton, animateNext } from '../../components/ui';
import { useEvery, useLoad } from '../../components/screen';
import { useApp } from '../../state/app';
import { api, uploadFiles } from '../../lib/api';
import { ago } from '../../lib/format';
import { haptic, maybeAskForRating } from '../../lib/phone';
import { C } from '../../theme';

export default function SupportChatScreen({ navigation }) {
  const { user, refreshMe } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={s.head}>
          <View style={s.av}><Text style={s.avText}>K</Text></View>
          <View style={{ marginLeft: 10 }}>
            <Text style={s.name}>Kane</Text>
            <Text style={s.meta}>Replies come here and to your phone</Text>
          </View>
        </View>
      )
    });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      const res = await api({ action: 'support_get' });
      setMsgs((cur) => { if (cur && cur.length !== (res.messages || []).length) animateNext(); return res.messages || []; });
      setError('');
    } catch (e) { setError(e.message); }
  }, []);
  const { refreshing, onRefresh } = useLoad(async () => { await load(); refreshMe(); });
  useEvery(8000, load);

  const send = async (body, files) => {
    const payload = { action: 'support_send', body };
    if (files.length) payload.files = await uploadFiles(user.id, files, 'chat');
    const res = await api(payload);
    animateNext();
    setMsgs((cur) => (cur || []).concat(res.message));
    haptic.success();
    maybeAskForRating();
  };

  if (!msgs) return error ? <Empty title="Could not open the chat" text={error} /> : <View style={{ padding: 20 }}><Skeleton height={44} width="70%" radius={20} /></View>;
  return (
    <ThreadLayout follow={msgs.length} refreshing={refreshing} onRefresh={onRefresh}
      composer={<Composer files placeholder="Write a message" onSend={send} testID="supportBody" />}>
      {!msgs.length ? <Bubble system text="Say hello. Kane sees this in his inbox and replies here; if you are not in the app, by email too." /> : null}
      {msgs.map((m) => (
        <Bubble key={m.id} mine={m.author === 'visitor'} who={m.author === 'visitor' ? 'You' : 'Kane'} text={m.body} when={ago(m.at)} />
      ))}
    </ThreadLayout>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  av: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  name: { fontSize: 16, fontWeight: '600', color: C.ink },
  meta: { fontSize: 12.5, color: C.ink2 }
});
