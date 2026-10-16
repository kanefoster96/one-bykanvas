/* Support, the customer's side: the chat with Kane at the top, then their
 * requests (open first, newest first, closed tucked away) and New request.
 * One clients also get their site information form here. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Button, Card, Chip, Empty, Skeleton, Tag, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { useApp } from '../../state/app';
import { KIND, LABEL, TAG, isDone, loadRequests, unread } from '../../lib/requests';
import { shortWhen } from '../../lib/format';
import { C, R } from '../../theme';

function Row({ r, latest, onPress, last }) {
  const u = unread(r);
  return (
    <Press onPress={onPress} scale={0.985} style={[s.rq, !last && s.line]}>
      <View style={s.rqTop}>
        {u ? <View style={s.dot} /> : null}
        <Text style={[s.rqTitle, u && { fontWeight: '700' }]} numberOfLines={1}>{r.title}</Text>
        <Text style={s.rqWhen}>{shortWhen(r.created_at)}</Text>
      </View>
      <View style={s.rqSub}>
        <Tag text={LABEL[r.status] || 'Sent'} kind={TAG[r.status] || 'plain'} />
        <Text style={s.rqKind}>{KIND[r.kind] || 'Request'}</Text>
      </View>
      {u && latest ? <Text style={s.snip} numberOfLines={1}>{'Kanvas One: ' + String(latest.body).split('\n')[0]}</Text> : null}
    </Press>
  );
}

export default function SupportScreen({ navigation }) {
  const { me, isOneClient, refreshMe } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);
  const supportUnread = (me && me.unread && me.unread.support) || 0;

  const { refreshing, onRefresh } = useLoad(async (quiet) => {
    try { const d = await loadRequests(); if (data) animateNext(); setData(d); setError(''); if (quiet) refreshMe(); }
    catch (e) { setError(e.message); }
  });

  const byNew = data ? data.list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
  const open = byNew.filter((r) => !isDone(r));
  const done = byNew.filter(isDone);

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      <Press onPress={() => navigation.navigate('SupportChat')} style={s.kane} scale={0.985} testID="kaneChat">
        <View style={s.kAv}><Text style={s.kAvText}>K</Text></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.kTitle}>Chat with Kane</Text>
          <Text style={s.kSub}>{supportUnread ? 'New reply from Kane' : 'Photos, files, quick questions. Replies come here and to your phone.'}</Text>
        </View>
        {supportUnread ? <View style={s.kDot} /> : <Icon name="chevron" size={18} color={C.onNight2} />}
      </Press>

      {isOneClient ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.cardTitle}>Your site information</Text>
          <Text style={s.cardText}>What you sell, how you sell it, who you sell to. Kane builds from it, and hears the moment you change anything.</Text>
          <View style={{ marginTop: 12, alignSelf: 'flex-start' }}><Chip dark title="Open your One setup" onPress={() => navigation.navigate('WebPage', { title: 'One setup', path: '/onboarding.html' })} /></View>
        </Card>
      ) : null}

      <View style={s.head}>
        <Text style={s.h2}>Requests</Text>
        <Button title="New request" icon="plus" small onPress={() => navigation.navigate('NewRequest')} style={{ alignSelf: 'auto' }} testID="newRequest" />
      </View>
      {!data ? (error ? <Empty title="Could not load your requests" text={error} /> : [0, 1, 2].map((i) => <Skeleton key={i} height={64} style={{ marginTop: 12 }} />)) : null}
      {data && !data.list.length ? <Empty title="No requests yet" text="Ask for a change to your site, or a new feature. We reply here." /> : null}
      {open.map((r, i) => <Row key={r.id} r={r} latest={data.latest[r.id]} last={i === open.length - 1} onPress={() => navigation.navigate('Request', { id: r.id })} />)}
      {done.length ? (
        <View>
          <Press onPress={() => { animateNext(); setShowDone(!showDone); }} feel="select" style={s.doneHead}>
            <Text style={s.group}>{'Closed (' + done.length + ')'}</Text>
            <View style={{ transform: [{ rotate: showDone || !open.length ? '90deg' : '0deg' }] }}><Icon name="chevron" size={16} color={C.ink3} /></View>
          </Press>
          {showDone || !open.length ? done.map((r, i) => <Row key={r.id} r={r} latest={data.latest[r.id]} last={i === done.length - 1} onPress={() => navigation.navigate('Request', { id: r.id })} />) : null}
        </View>
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  kane: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.night, borderRadius: R.cardLg, padding: 16 },
  kAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' },
  kAvText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  kTitle: { fontSize: 17, fontWeight: '600', color: C.onNight },
  kSub: { marginTop: 2, fontSize: 14, lineHeight: 19, color: C.onNight2 },
  kDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.or2 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: C.ink },
  cardText: { marginTop: 4, fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 4 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: C.ink },
  rq: { paddingVertical: 14 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rqTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.or2, marginRight: 8 },
  rqTitle: { flex: 1, fontSize: 16.5, fontWeight: '600', color: C.ink, marginRight: 10 },
  rqWhen: { fontSize: 13, color: C.ink3 },
  rqSub: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  rqKind: { marginLeft: 8, fontSize: 13.5, color: C.ink2 },
  snip: { marginTop: 7, fontSize: 14, color: C.ink2 },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingVertical: 6 },
  group: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink3 }
});
