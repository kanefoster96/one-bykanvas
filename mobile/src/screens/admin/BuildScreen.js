/* Kane's first tab. Four counts on black (sites and apps to build,
 * requests and changes waiting), All sites, every build with a progress
 * bar, free designs to make, then customers' requests: needs your reply
 * first, then open, then closed. A build opens its checklist; a request
 * its conversation. Same data and rules as the admin page. */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Button, Card, Empty, FadeIn, Label, Note, Segmented, Skeleton, Tag, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { admin } from '../../lib/api';
import { useApp } from '../../state/app';
import { C, H, R } from '../../theme';
import { haptic, openOutside } from '../../lib/phone';
import { shortWhen, since } from '../../lib/format';
import { JOB_WORD, KIND_WORD, PLAN_WORD, STATUS_TAG, STATUS_WORD, isClosed, lateOf, needsMe, openJobsOf, progressOf, promiseOf, ticksFrom } from '../../lib/build';

export function Bar({ done, total, night }) {
  const w = total ? Math.round((done / total) * 100) : 0;
  return (
    <View style={[s.bar, night && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
      <View style={[s.barFill, { width: w + '%' }, night && { backgroundColor: C.or2 }]} />
    </View>
  );
}

export function RequestRow({ r, onPress, last }) {
  const mine = needsMe(r);
  return (
    <Press onPress={onPress} scale={0.985} style={[s.rq, !last && s.rqLine]}>
      <View style={s.rqTop}>
        {mine ? <View style={s.unread} /> : null}
        <Text style={[s.rqTitle, mine && { fontWeight: '700' }]} numberOfLines={1}>{r.title || 'Request'}</Text>
        <Text style={s.rqWhen}>{shortWhen(r.created_at)}</Text>
      </View>
      <View style={s.rqSub}>
        <Tag text={mine ? 'Needs reply' : (STATUS_WORD[r.status] || 'New')} kind={mine ? 'reply' : (STATUS_TAG[r.status] || 'plain')} />
        <Text style={s.rqWho} numberOfLines={1}>{[r.business_name || r.contact_name || 'Customer', KIND_WORD[r.kind] || 'Request'].join(' · ')}</Text>
      </View>
      {mine && r.latest && r.latest.author !== 'admin' ? <Text style={s.rqSnip} numberOfLines={1}>{r.latest.body}</Text> : null}
    </Press>
  );
}

/* A free design someone asked for: who, what they said, and a box for
   where the example lives, which sends it to them. */
function DesignCard({ d, onSent }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: '' });
  const send = async () => {
    const link = url.trim();
    if (!/^https:\/\/\S+\.\S{2,}/i.test(link)) { setNote({ text: 'That needs to be a full https:// address.', bad: true }); haptic.warning(); return; }
    setBusy(true); setNote({ text: 'Sending…' });
    try { await admin({ action: 'sendPreview', leadId: d.id, url: link }); haptic.success(); setNote({ text: 'Sent. It is in their inbox.', ok: true }); setTimeout(onSent, 900); }
    catch (e) { setNote({ text: e.message, bad: true }); haptic.error(); }
    setBusy(false);
  };
  const lines = [['Name', d.name !== d.business ? d.name : null], ['Email', d.email, 'mailto:' + d.email], ['Find them', d.handle, /^@[\w.]+$/.test(d.handle || '') ? 'https://instagram.com/' + d.handle.slice(1) : /^https?:\/\//.test(d.handle || '') ? d.handle : null],
    ['Web address', d.requested_domain ? d.requested_domain + ' (picked, nothing registered)' : null], ['They added', d.about]].filter((x) => x[1]);
  return (
    <View style={s.design}>
      <Press onPress={() => { animateNext(); setOpen(!open); }} scale={0.985}>
        <Text style={s.designBiz}>{d.business || d.name || 'Customer'}</Text>
        <Text style={s.designTitle}>Make their free design</Text>
        <Text style={s.designLine} numberOfLines={1}>{[d.handle, d.requested_domain ? 'wants ' + d.requested_domain : null].filter(Boolean).join(' · ') || 'No details yet'}</Text>
        <Text style={s.designMeta}>Asked {since(d.created_at)}</Text>
      </Press>
      {open ? (
        <FadeIn style={{ marginTop: 12 }}>
          {lines.map((l) => (
            <Text key={l[0]} style={s.jobLine}><Text style={{ fontWeight: '600', color: C.ink }}>{l[0]}: </Text>
              <Text onPress={l[2] ? () => openOutside(l[2]) : undefined} style={l[2] ? { textDecorationLine: 'underline' } : null}>{l[1]}</Text></Text>
          ))}
          <TextInput value={url} onChangeText={setUrl} placeholder="https://where-the-example-lives" placeholderTextColor={C.ink3} autoCapitalize="none" keyboardType="url" style={s.urlField} />
          <Button title="Send the free design" onPress={send} busy={busy} style={{ marginTop: 10 }} />
          <Note {...note} />
        </FadeIn>
      ) : null}
    </View>
  );
}

export default function BuildScreen({ navigation }) {
  const { setCounts } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(null); // 'site' | 'app'
  const [kind, setKind] = useState('all');
  const [showClosed, setShowClosed] = useState(false);

  const { refreshing, onRefresh, reload } = useLoad(async () => {
    try {
      const [inbox, board] = await Promise.all([admin({ action: 'requestsInbox' }), admin({ action: 'buildBoard' })]);
      const ticks = ticksFrom(board.steps);
      const rows = inbox.requests || [];
      const designs = inbox.designs || [];
      const builds = board.builds || [];
      const open = rows.filter((r) => !isClosed(r));
      const waiting = open.filter((r) => r.last_note_by === 'customer').length + designs.length + builds.filter((p) => p.site_status === 'building').length;
      setCounts({ build: waiting });
      if (data) animateNext();
      setData({ rows, designs, builds, ticks, customers: board.customers || 0, live: board.live || 0 });
      setError('');
    } catch (e) { setError(e.message); }
  });

  if (!data) {
    return (
      <Page>
        {error ? <Empty title="Could not load" text={error} /> : (
          <View>
            <View style={s.grid}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={118} radius={R.cardLg} width="48.5%" style={{ marginBottom: 10 }} />)}</View>
            <Skeleton height={64} radius={R.card} />
            <Skeleton height={20} width="40%" style={{ marginTop: 28 }} />
            <Skeleton height={70} style={{ marginTop: 14 }} />
          </View>
        )}
      </Page>
    );
  }

  const { rows, designs, builds, ticks } = data;
  const sites = builds.filter((p) => p.site_status === 'building');
  const apps = builds.filter((p) => openJobsOf(ticks, p).indexOf('app') !== -1);
  const openKind = (k) => rows.filter((r) => (r.kind || 'edit') === k && !isClosed(r));
  const feats = openKind('feature'), edits = openKind('edit');
  const mine = (list) => list.filter((r) => r.last_note_by === 'customer').length;
  const tiles = [
    { key: 'site', n: sites.length, label: 'Sites to build', hot: sites.some(lateOf), sub: sites.some(lateOf) ? 'Past the promise' : '' },
    { key: 'app', n: apps.length, label: 'Apps to build' },
    { key: 'feature', n: feats.length, label: 'Requests', hot: mine(feats) > 0, sub: mine(feats) ? mine(feats) + ' waiting on you' : '' },
    { key: 'edit', n: edits.length, label: 'Changes', hot: mine(edits) > 0, sub: mine(edits) ? mine(edits) + ' waiting on you' : '' }
  ];
  const inBuild = builds.filter((p) => { const j = openJobsOf(ticks, p); return j.length && (!filter || j.indexOf(filter) !== -1); });
  const listed = rows.filter((r) => kind === 'all' || (r.kind || 'edit') === kind).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const needs = listed.filter(needsMe);
  const open = listed.filter((r) => !isClosed(r) && !needsMe(r));
  const closed = listed.filter(isClosed);

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      <View style={s.grid}>
        {tiles.map((t) => {
          const on = t.key === filter || t.key === kind;
          return (
            <Press key={t.key} style={[s.tile, on && s.tileOn]} feel="select" testID={'tile-' + t.key} onPress={() => {
              animateNext();
              if (t.key === 'site' || t.key === 'app') setFilter(filter === t.key ? null : t.key);
              else setKind(kind === t.key ? 'all' : t.key);
            }}>
              <Text style={[s.tileN, t.hot && { color: C.orLight }]}>{t.n}</Text>
              <Text style={s.tileLabel}>{t.label}</Text>
              {t.sub ? <Text style={[s.tileSub, t.hot && { color: C.orLight }]}>{t.sub}</Text> : null}
            </Press>
          );
        })}
      </View>

      <Press style={s.all} scale={0.985} onPress={() => navigation.navigate('WebPage', { title: 'All sites', path: '/admin.html?s=customers' })}>
        <View style={{ flex: 1 }}>
          <Text style={s.allTitle}>All sites</Text>
          <Text style={s.allSub}>{data.customers + ' customer' + (data.customers === 1 ? '' : 's') + ' · ' + data.live + ' live'}</Text>
        </View>
        <Icon name="chevron" size={18} color={C.ink3} />
      </Press>

      <Label style={s.section}>{filter === 'site' ? 'Sites to build' : filter === 'app' ? 'Apps to build' : 'In build'}</Label>
      {!inBuild.length ? <Text style={s.none}>{filter ? 'Nothing here.' : 'Nothing in build.'}</Text> : inBuild.map((p, i) => (
        <Press key={p.id} scale={0.985} style={[s.brow, i < inBuild.length - 1 && s.rqLine]} onPress={() => navigation.navigate('BuildDetail', { id: p.id, job: filter || openJobsOf(ticks, p)[0] })}>
          <View style={s.browTop}>
            <Text style={s.browName} numberOfLines={1}>{p.business_name || p.contact_name || 'Customer'}</Text>
            <Tag text={PLAN_WORD[p.active_plan] || 'Plan'} kind="building" />
          </View>
          {openJobsOf(ticks, p).filter((j) => !filter || j === filter).map((job) => {
            const g = progressOf(ticks, p, job);
            return (
              <View key={job} style={s.browLine}>
                {p.active_plan === 'max' ? <Text style={s.browJob}>{JOB_WORD[job]}</Text> : null}
                <Bar done={g.done} total={g.total} />
                <Text style={s.browCount}>{g.done + ' of ' + g.total}</Text>
              </View>
            );
          })}
          {lateOf(p) ? <Text style={s.late}>{'Joined ' + since(p.created_at) + ' · past the ' + promiseOf(p)}</Text> : null}
        </Press>
      ))}

      {designs.length ? <Label style={s.section}>Free designs to make</Label> : null}
      {designs.map((d) => <DesignCard key={d.id} d={d} onSent={() => reload(true)} />)}

      <Label style={s.section}>Requests</Label>
      <Segmented value={kind} onChange={(v) => { animateNext(); setKind(v); }} options={[{ value: 'all', label: 'All' }, { value: 'edit', label: 'Changes' }, { value: 'feature', label: 'Features' }]} />
      {[['Needs your reply', needs], ['Open', open]].map(([title, list]) => list.length ? (
        <View key={title}>
          <Text style={s.group}>{title + ' (' + list.length + ')'}</Text>
          {list.map((r, i) => <RequestRow key={r.id} r={r} last={i === list.length - 1} onPress={() => navigation.navigate('AdminRequest', { id: r.id })} />)}
        </View>
      ) : null)}
      {!needs.length && !open.length ? <Text style={s.none}>Nothing open.</Text> : null}
      {closed.length ? (
        <View>
          <Press onPress={() => { animateNext(); setShowClosed(!showClosed); }} style={s.closedHead} feel="select">
            <Text style={s.group}>{'Closed (' + closed.length + ')'}</Text>
            <View style={{ transform: [{ rotate: showClosed ? '90deg' : '0deg' }], marginTop: 18 }}><Icon name="chevron" size={16} color={C.ink3} /></View>
          </Press>
          {showClosed ? closed.map((r, i) => <RequestRow key={r.id} r={r} last={i === closed.length - 1} onPress={() => navigation.navigate('AdminRequest', { id: r.id })} />) : null}
        </View>
      ) : null}
      {error ? <Note text={error} bad /> : null}
    </Page>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 2 },
  tile: { width: '48.5%', minHeight: 112, marginBottom: 10, borderRadius: R.cardLg, backgroundColor: C.night, padding: 16, borderWidth: 1.5, borderColor: 'transparent' },
  tileOn: { borderColor: C.orLight },
  tileN: { fontSize: 34, fontWeight: '700', letterSpacing: -1, color: C.onNight },
  tileLabel: { marginTop: 2, fontSize: 15, fontWeight: '600', color: C.onNight },
  tileSub: { marginTop: 2, fontSize: 13, color: C.onNight2 },
  all: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.lineSoft, borderRadius: R.card, paddingHorizontal: 18, paddingVertical: 15, marginTop: 2 },
  allTitle: { fontSize: 17, fontWeight: '600', color: C.ink },
  allSub: { marginTop: 2, fontSize: 14, color: C.ink2 },
  section: { marginTop: 30, marginBottom: 8 },
  none: { fontSize: 15.5, color: C.ink2, marginTop: 4 },
  brow: { paddingVertical: 14 },
  browTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  browName: { flex: 1, fontSize: 17, fontWeight: '600', color: C.ink, marginRight: 10 },
  browLine: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  browJob: { width: 64, fontSize: 13.5, fontWeight: '600', color: C.ink2 },
  browCount: { marginLeft: 10, fontSize: 13.5, color: C.ink2, fontVariant: ['tabular-nums'] },
  bar: { flex: 1, height: 7, borderRadius: 4, backgroundColor: C.grey, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: C.ink },
  late: { marginTop: 8, fontSize: 13.5, fontWeight: '600', color: C.bad },
  group: { marginTop: 18, marginBottom: 2, fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink3 },
  closedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rq: { paddingVertical: 14 },
  rqLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rqTop: { flexDirection: 'row', alignItems: 'center' },
  unread: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.or2, marginRight: 8 },
  rqTitle: { flex: 1, fontSize: 16.5, fontWeight: '600', color: C.ink, marginRight: 10 },
  rqWhen: { fontSize: 13, color: C.ink3 },
  rqSub: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  rqWho: { flex: 1, marginLeft: 8, fontSize: 13.5, color: C.ink2 },
  rqSnip: { marginTop: 7, fontSize: 14, color: C.ink2 },
  design: { borderWidth: 1, borderColor: C.lineSoft, borderRadius: R.card, padding: 16, marginBottom: 10 },
  designBiz: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.ink3 },
  designTitle: { marginTop: 4, fontSize: 18, fontWeight: '600', color: C.ink },
  designLine: { marginTop: 8, fontSize: 14.5, color: C.ink2 },
  designMeta: { marginTop: 4, fontSize: 13, color: C.ink3 },
  jobLine: { fontSize: 14.5, lineHeight: 21, color: C.ink2, marginBottom: 4 },
  urlField: { marginTop: 10, height: H.field, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: C.ink }
});
