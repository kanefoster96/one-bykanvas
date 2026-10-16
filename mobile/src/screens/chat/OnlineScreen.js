/* Who is on the site right now (a sheet over the inbox): the page each is
   on and for how long, with Message to open a chat that pops up in front
   of them, or Open chat if they already have one. */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Chip, Empty, Note } from '../../components/ui';
import { useApp } from '../../state/app';
import { hereNow, useChats } from '../../state/chat';
import { api } from '../../lib/api';
import { countryName, displayName, pageName, sessionNo } from '../../lib/format';
import { C } from '../../theme';

function onSiteFor(v) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(v.first_at || v.last_at).getTime()) / 60000));
  return mins < 60 ? mins + ' min' : Math.round(mins / 60) + ' h';
}

export default function OnlineScreen({ navigation }) {
  const { site } = useApp();
  const chats = useChats();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const here = hereNow(chats);

  const open = async (v, c) => {
    setBusy(v.session);
    try {
      const id = c ? c.id : (await api({ action: 'visitor_chat_start', site_id: site.site_id, session: v.session })).conversation_id;
      navigation.goBack();
      navigation.navigate('Thread', { id, note: c ? '' : 'They are on ' + pageName(v.path || '/') + ' now. Your message pops up in the chat on their screen.' });
    } catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={s.title}>On your site now</Text>
      <Text style={s.hint}>Live, from the visitor counter on your site. Tap Message to open a chat that pops up in front of them.</Text>
      <Note text={error} bad />
      {!here.length ? <Empty text="Nobody is on the site right now." /> : here.map((v) => {
        const c = v.conv || chats.convs.filter((x) => x.id === v.conversation_id)[0] || null;
        return (
          <View key={v.session || v.conversation_id} style={s.row}>
            <Avatar name={c ? c.name : v.name} online />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name} numberOfLines={1}>{v.name || (c ? displayName(c) : 'Visitor #' + sessionNo(v.session))}</Text>
              <Text style={s.sub} numberOfLines={2}><Text style={{ color: C.ink, fontWeight: '600' }}>{'On ' + pageName(v.path || '/')}</Text>{' · ' + onSiteFor(v) + (v.device ? ' · ' + (v.device === 'phone' ? 'Phone' : 'Desktop') : '') + (v.country ? ' · ' + countryName(v.country) : '')}</Text>
            </View>
            <Chip dark={!c} title={busy === v.session ? '…' : c ? 'Open chat' : 'Message'} onPress={() => open(v, c)} disabled={!!busy} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingTop: 26 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: C.ink },
  hint: { marginTop: 6, marginBottom: 6, fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontSize: 16, fontWeight: '600', color: C.ink },
  sub: { marginTop: 3, fontSize: 13.5, color: C.ink2 }
});
