/* The Chat tab: the inbox of conversations from the site's live chat
 * (and texts and WhatsApp where the site has them), and beside it
 * Contacts, everyone the site has dealt with. A black bar at the bottom
 * says who is on the site now; tap it to message them. */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, useEvery, useLoad } from '../../components/screen';
import { Avatar, Button, Empty, Segmented, Skeleton, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { useApp } from '../../state/app';
import { hereNow, loadChats, useChats } from '../../state/chat';
import { api } from '../../lib/api';
import { C, R } from '../../theme';
import { displayName, pageName, shortWhen } from '../../lib/format';

const SOURCE_WORD = { chat: 'From live chat', enquiry: 'From an enquiry', payment: 'Paid on your site', manual: 'Added by you' };

function Search({ value, onChange, placeholder }) {
  return (
    <View style={s.search}>
      <Icon name="search" size={18} color={C.ink3} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.ink3} style={s.searchInput}
        autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
    </View>
  );
}

export function ConvRow({ c, onPress, last }) {
  const preview = (c.last_by === 'owner' ? 'You: ' : '') + (c.preview || (c.via_app ? 'From their One app' : c.online && c.now_path ? 'On ' + pageName(c.now_path) + ' now' : c.page ? 'Visited ' + pageName(c.page) : ''));
  return (
    <Press onPress={onPress} scale={0.985} style={s.row}>
      <Avatar name={c.name} online={c.online && (c.channel || 'web') === 'web'} badge={!(c.online && (c.channel || 'web') === 'web')} />
      <View style={[s.rowBody, !last && s.line]}>
        <View style={s.rowTop}>
          <Text style={[s.name, c.unread && { fontWeight: '700' }, c.status === 'closed' && { color: C.ink3 }]} numberOfLines={1}>{displayName(c)}</Text>
          <Text style={[s.when, c.unread && { color: C.ink, fontWeight: '600' }]}>{shortWhen(c.last_at)}</Text>
        </View>
        <View style={s.rowTop}>
          {c.unread ? <View style={s.dot} /> : null}
          <Text style={[s.preview, c.unread && { color: C.ink }]} numberOfLines={1}>{preview}</Text>
        </View>
      </View>
    </Press>
  );
}

/* Contacts: loaded once the tab shows them, kept while it is open. */
function useContacts(navigation, siteId, enabled) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const { refreshing, onRefresh } = useLoad(async () => {
    if (!enabled || !siteId) return;
    try { const r = await api({ action: 'contacts_list', site_id: siteId }); setList(r.contacts || []); setError(''); }
    catch (e) { setError(e.message); }
  }, [siteId, enabled]);
  const rows = useMemo(() => (list || []).filter((c) => !q || [c.name, c.email, c.phone, c.company, c.address].join(' ').toLowerCase().indexOf(q.toLowerCase()) >= 0), [list, q]);
  return { refreshing, onRefresh, body: (
    <View>
      <Search value={q} onChange={setQ} placeholder="Search name, email, phone" />
      <View style={s.contactsBar}>
        <Text style={s.count}>{list && list.length ? list.length + (list.length === 1 ? ' person' : ' people') : ''}</Text>
        <Button title="Add a customer" icon="plus" small onPress={() => navigation.navigate('Contact', { contact: null })} style={{ alignSelf: 'auto' }} />
      </View>
      {!list ? (error ? <Empty text={error} /> : [0, 1, 2].map((i) => <Skeleton key={i} height={56} style={{ marginTop: 12 }} />)) : null}
      {list && !list.length ? <Empty title="Nobody in your book yet" text="Everyone who chats, sends an enquiry or pays through your site lands here on their own; add anyone else with Add a customer." /> : null}
      {list && list.length && !rows.length ? <Text style={s.none}>Nobody matches.</Text> : null}
      {rows.map((c, i) => {
        const name = c.name || c.email || c.phone || 'Customer';
        const sub = [c.company, c.phone, c.email].filter((v) => v && v !== name).join(' · ');
        return (
          <Press key={c.id} onPress={() => navigation.navigate('Contact', { contact: c })} scale={0.985} style={s.row}>
            <Avatar name={c.name} />
            <View style={[s.rowBody, i < rows.length - 1 && s.line]}>
              <View style={s.rowTop}><Text style={s.name} numberOfLines={1}>{name}</Text><Text style={s.when}>{shortWhen(c.last_seen_at)}</Text></View>
              <Text style={s.preview} numberOfLines={1}>{sub || (c.notes ? c.notes + (c.notes === 1 ? ' note' : ' notes') : SOURCE_WORD[c.source] || '')}</Text>
            </View>
          </Press>
        );
      })}
    </View>
  ) };
}

export default function InboxScreen({ navigation }) {
  const { site, hasChat, contactsAllowed, setCounts } = useApp();
  const both = hasChat && contactsAllowed;
  const [mode, setMode] = useState(hasChat ? 'inbox' : 'contacts');
  const chats = useChats();
  const [q, setQ] = useState('');
  const siteId = site && site.site_id;

  useEffect(() => { navigation.setOptions({ title: mode === 'inbox' ? 'Inbox' : 'Contacts' }); }, [navigation, mode]);
  const inbox = useLoad(() => (hasChat ? loadChats(siteId) : null), [siteId, hasChat]);
  useEvery(10000, () => loadChats(siteId), hasChat && mode === 'inbox');
  useEffect(() => { setCounts({ chat: chats.convs.filter((c) => c.unread).length }); }, [chats.convs, setCounts]);
  const contacts = useContacts(navigation, siteId, contactsAllowed && mode === 'contacts');

  const rows = useMemo(() => {
    if (!q) return chats.convs;
    const f = q.toLowerCase();
    return chats.convs.filter((c) => (displayName(c) + ' ' + (c.preview || '') + ' ' + (c.email || '') + ' ' + (c.phone || '')).toLowerCase().indexOf(f) >= 0);
  }, [chats.convs, q]);
  const here = hereNow(chats);

  if (!site) return <Page><Empty title="Nothing here yet" text="Your chats appear here once your site is live." /></Page>;
  const cur = mode === 'inbox' ? inbox : contacts;
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Page refreshing={cur.refreshing} onRefresh={cur.onRefresh} contentStyle={{ paddingBottom: here.length && mode === 'inbox' ? 90 : 40 }}>
        {both ? <Segmented style={{ marginBottom: 12 }} value={mode} onChange={(v) => { animateNext(); setMode(v); }} options={[{ value: 'inbox', label: 'Inbox' }, { value: 'contacts', label: 'Contacts' }]} /> : null}
        {mode === 'contacts' ? contacts.body : (
          <View>
            <Search value={q} onChange={setQ} placeholder="Search" />
            {!chats.loaded ? [0, 1, 2, 3].map((i) => <View key={i} style={{ flexDirection: 'row', marginTop: 16 }}><Skeleton height={46} width={46} radius={23} /><View style={{ flex: 1, marginLeft: 12 }}><Skeleton height={14} width="50%" /><Skeleton height={12} width="80%" style={{ marginTop: 8 }} /></View></View>) : null}
            {chats.loaded && chats.error && !chats.convs.length ? <Empty title="Could not load your chats" text={chats.error} /> : null}
            {chats.loaded && !chats.error && !chats.convs.length ? <Empty title="No conversations yet" text="The chat button is live on your site; the first message lands here and on your phone." /> : null}
            {chats.convs.length && !rows.length ? <Text style={s.none}>Nothing matches.</Text> : null}
            {rows.map((c, i) => <ConvRow key={c.id} c={c} last={i === rows.length - 1} onPress={() => navigation.navigate('Thread', { id: c.id })} />)}
          </View>
        )}
      </Page>
      {mode === 'inbox' && here.length ? (
        <Press onPress={() => navigation.navigate('Online')} style={s.onlineBar} scale={0.98} testID="onlineBar">
          <View style={s.onlineN}><Text style={s.onlineNText}>{here.length}</Text></View>
          <Text style={s.onlineText}>{here.length === 1 ? 'Visitor on your site now' : 'Visitors on your site now'}</Text>
          <Icon name="chevron" size={18} color="#fff" />
        </Press>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.grey, borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 6 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: C.ink, height: 42 },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  rowBody: { flex: 1, marginLeft: 12, paddingBottom: 12 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 16.5, fontWeight: '600', color: C.ink, marginRight: 8 },
  when: { fontSize: 13.5, color: C.ink3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.or2, marginRight: 6, marginTop: 3 },
  preview: { flex: 1, marginTop: 3, fontSize: 15, color: C.ink2 },
  none: { marginTop: 14, fontSize: 15, color: C.ink2 },
  contactsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  count: { fontSize: 14, color: C.ink2 },
  onlineBar: { position: 'absolute', left: 14, right: 14, bottom: 12, height: 56, borderRadius: R.card, backgroundColor: C.night, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  onlineN: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' },
  onlineNText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  onlineText: { flex: 1, marginLeft: 12, color: '#fff', fontSize: 16, fontWeight: '600' }
});
