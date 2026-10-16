/* One build: who they are and how to reach them, what they asked for,
 * their payments set-up (One), and the checklist for their plan. A tick
 * saves the moment it is made, to the same rows the admin page shows, so
 * the list can sit open on the phone while the site is built on the
 * desktop. The site's job ends with Go live: its address, and they are
 * told. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Button, Chip, Empty, FadeIn, Label, Note, Segmented, Skeleton, Tag, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { Bar } from './BuildScreen';
import { admin } from '../../lib/api';
import { haptic, openOutside, share } from '../../lib/phone';
import { since, telHref } from '../../lib/format';
import { PLAN_WORD, jobsFor, lateOf, openJobsOf, progressOf, promiseOf, setTick, ticksFrom } from '../../lib/build';
import { C, H, R } from '../../theme';

function Check({ on }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: true, speed: 30, bounciness: 10 }).start(); }, [on, v]);
  return (
    <View style={[s.box, on && s.boxOn]}>
      <Animated.View style={{ transform: [{ scale: v }], opacity: v }}><Icon name="check" size={16} color="#fff" stroke={3} /></Animated.View>
    </View>
  );
}

const STRIPE_WORD = { active: 'Card payments on', pending: 'Waiting for them, or Stripe’s checks', restricted: 'Stripe needs something from them', unsupported: 'Stripe can’t take their payments' };

function StripeCard({ p }) {
  const [st, setSt] = useState({ line: p.stripe_connect_id ? 'Checking…' : 'Not set up yet.', res: null });
  const run = useCallback(async (action) => {
    setSt((x) => ({ ...x, line: action === 'stripeConnect' ? 'Making their Stripe account…' : 'Checking…' }));
    try {
      const res = await admin({ action, userId: p.id });
      setSt({ res, line: (STRIPE_WORD[res.cardPayments] || res.cardPayments || '') + (res.needsFromClub ? ' · ' + res.needsFromClub + ' still to fill in' : '') });
    } catch (e) { setSt({ res: null, line: e.message }); }
  }, [p.id]);
  useLoad(() => { if (p.stripe_connect_id && !st.res) return run('stripeConnectStatus'); return null; }, [p.id]);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Their payments (Stripe)</Text>
      <Text style={[s.cardText, st.res && st.res.cardPayments === 'active' && { color: C.ink, fontWeight: '600' }]}>{st.line}</Text>
      <View style={s.chips}>
        {st.res && st.res.account ? (
          <>
            <Chip dark title="Share set-up link" icon="share" onPress={() => share('Here’s your link to set up payments for ' + (p.business_name || 'your club') + ':', st.res.link)} />
            <Chip title="Check again" onPress={() => run('stripeConnectStatus')} />
          </>
        ) : <Chip dark title="Make their set-up link" onPress={() => run('stripeConnect')} />}
      </View>
    </View>
  );
}

export default function BuildDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [job, setJob] = useState(route.params.job || null);
  const [asked, setAsked] = useState(false);
  const [closed, setClosed] = useState({});
  const [note, setNote] = useState({ text: '' });
  const [url, setUrl] = useState(null);
  const [live, setLive] = useState({ busy: false, note: { text: '' } });

  const { refreshing, onRefresh } = useLoad(async () => {
    try {
      const b = await admin({ action: 'buildBoard' });
      const p = (b.builds || []).filter((x) => x.id === id)[0];
      if (!p) { navigation.replace('WebPage', { title: 'Build', path: '/admin.html?b=' + id + (route.params.job ? '&job=' + route.params.job : '') }); return; }
      setBoard({ p, ticks: ticksFrom(b.steps) });
      setError('');
    } catch (e) { setError(e.message); }
  }, [id]);

  const p = board && board.p;
  useLayoutEffect(() => {
    navigation.setOptions({ title: p ? (p.business_name || p.contact_name || 'Customer') : '', headerRight: p ? () => <Tag text={PLAN_WORD[p.active_plan] || 'Plan'} kind="building" /> : undefined });
  }, [navigation, p]);

  if (!board) return error ? <Empty title="Could not load this build" text={error} /> : <Page><Skeleton height={16} width="60%" /><Skeleton height={40} style={{ marginTop: 16 }} /><Skeleton height={300} style={{ marginTop: 22 }} radius={R.card} /></Page>;

  const { ticks } = board;
  const jobs = jobsFor(p.active_plan);
  const cur = jobs.filter((j) => j.job === job)[0] || jobs.filter((j) => j.job === openJobsOf(ticks, p)[0])[0] || jobs[0];
  const g0 = progressOf(ticks, p, cur.job);
  const t = (ticks[p.id] && ticks[p.id][cur.job]) || {};
  const digits = String(p.phone || '').replace(/[^\d+]/g, '');
  const siteUrl = url !== null ? url : (p.site_url || (p.requested_domain ? 'https://' + p.requested_domain : ''));

  const tick = async (step, on) => {
    if (on) haptic.success(); else haptic.light();
    setBoard((b) => ({ ...b, ticks: setTick(Object.assign({}, b.ticks), p.id, cur.job, step, on) }));
    try { await admin({ action: 'tickStep', userId: p.id, job: cur.job, step, done: on }); setNote({ text: '' }); }
    catch (e) { setBoard((b) => ({ ...b, ticks: setTick(Object.assign({}, b.ticks), p.id, cur.job, step, !on) })); setNote({ text: 'Not saved: ' + e.message, bad: true }); haptic.error(); }
  };

  const goLive = async () => {
    const link = siteUrl.trim();
    if (!/^https:\/\/\S+\.\S{2,}/i.test(link)) { setLive({ busy: false, note: { text: 'That needs to be a full https:// address.', bad: true } }); haptic.warning(); return; }
    setLive({ busy: true, note: { text: 'Marking it live…' } });
    try {
      await admin({ action: 'setSite', userId: p.id, siteUrl: link, siteStatus: 'live' });
      haptic.success();
      setBoard((b) => ({ ...b, p: { ...b.p, site_status: 'live', site_url: link } }));
      setLive({ busy: false, note: { text: 'Live. They have been told.', ok: true } });
     
    } catch (e) { setLive({ busy: false, note: { text: e.message, bad: true } }); haptic.error(); }
  };

  const askedRows = [['Trade', p.business_type], ['Web address', p.requested_domain ? p.requested_domain + (p.domain_owned ? ' (theirs, move it across)' : ' (to register)') : null],
    ['Wants the site to', p.site_goals], ['Asked for', (p.site_uses || []).join(', ')], ['Menu/services', p.services], ['Already online', p.existing_links]].filter((x) => x[1]);

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: 4 }}>
      <Text style={s.who}>{[p.contact_name, 'Joined ' + since(p.created_at)].filter(Boolean).join(' · ')}</Text>
      <View style={s.chips}>
        {digits ? <Chip title="Call" icon="phone" onPress={() => openOutside(telHref(digits))} /> : null}
        {digits ? <Chip title="WhatsApp" onPress={() => openOutside('https://wa.me/' + digits.replace(/^\+/, '').replace(/^0/, '44'))} /> : null}
        {p.email ? <Chip title="Email" icon="mail" onPress={() => openOutside('mailto:' + p.email)} /> : null}
        {p.site_url ? <Chip title="Their site" icon="globe" onPress={() => openOutside(p.site_url)} /> : null}
        <Chip title="Customer page" onPress={() => navigation.navigate('WebPage', { title: p.business_name || 'Customer', path: '/admin.html?c=' + p.id })} />
      </View>
      {lateOf(p) ? <Text style={s.late}>{'Late: joined ' + since(p.created_at) + ', promised within ' + promiseOf(p)}</Text> : null}
      {p.active_plan === 'max' ? <StripeCard p={p} /> : null}

      <Press onPress={() => { animateNext(); setAsked(!asked); }} style={s.askedHead} feel="select">
        <Text style={s.askedTitle}>What they asked for</Text>
        <View style={{ transform: [{ rotate: asked ? '90deg' : '0deg' }] }}><Icon name="chevron" size={18} color={C.ink3} /></View>
      </Press>
      {asked ? (
        <FadeIn style={{ marginBottom: 6 }}>
          {askedRows.length ? askedRows.map((l) => <Text key={l[0]} style={s.askedLine}><Text style={{ fontWeight: '600', color: C.ink }}>{l[0] + ': '}</Text>{l[1]}</Text>) : <Text style={s.askedLine}>Nothing yet.</Text>}
          {p.active_plan === 'max' ? <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Chip dark title="Their club setup answers" onPress={() => navigation.navigate('WebPage', { title: 'Setup answers', path: '/onboarding.html?user=' + encodeURIComponent(p.id) })} /></View> : null}
        </FadeIn>
      ) : null}

      <Label style={{ marginTop: 26, marginBottom: 10 }}>Checklist</Label>
      {jobs.length > 1 ? (
        <Segmented style={{ marginBottom: 12 }} value={cur.job} onChange={(v) => { animateNext(); setJob(v); }}
          options={jobs.map((j) => { const g = progressOf(ticks, p, j.job); return { value: j.job, label: j.title + ' ' + g.done + '/' + g.total }; })} />
      ) : null}
      <View style={s.progress}>
        <Bar done={g0.done} total={g0.total} night />
        <Text style={s.progressText}>{g0.done + ' of ' + g0.total + ' steps'}</Text>
      </View>

      {cur.groups.map((group) => {
        const n = group.steps.filter((st) => t[st[0]]).length;
        const done = n === group.steps.length;
        const key = cur.job + ':' + group.title;
        const isOpen = closed[key] === undefined ? !done : !closed[key];
        return (
          <View key={key} style={s.group}>
            <Press onPress={() => { animateNext(); setClosed({ ...closed, [key]: isOpen }); }} style={s.groupHead} feel="select" scale={0.99}>
              <Text style={s.groupTitle}>{group.title}</Text>
              <Text style={[s.groupCount, done && { color: C.or }]}>{n + '/' + group.steps.length}</Text>
              <View style={{ marginLeft: 8, transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}><Icon name="chevron" size={16} color={C.ink3} /></View>
            </Press>
            {isOpen ? group.steps.map((st) => {
              const on = !!t[st[0]];
              return (
                <Press key={st[0]} onPress={() => tick(st[0], !on)} feel={null} scale={0.985} style={s.step} accessibilityRole="checkbox">
                  <Check on={on} />
                  <Text style={[s.stepText, on && s.stepDone]}>{st[1]}</Text>
                </Press>
              );
            }) : null}
          </View>
        );
      })}
      <Note {...note} />

      {cur.job === 'site' && p.site_status === 'building' ? (
        <View style={s.live}>
          <Text style={s.liveTitle}>Go live</Text>
          <TextInput value={siteUrl} onChangeText={setUrl} placeholder="https://their-site.com" placeholderTextColor={C.ink3} autoCapitalize="none" keyboardType="url" style={s.liveField} />
          <Button title="Mark it live" onPress={goLive} busy={live.busy} style={{ marginTop: 10 }} />
          <Note {...live.note} style={{ color: live.note.bad ? '#ff8a80' : C.onNight2 }} />
        </View>
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  who: { fontSize: 15, color: C.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  late: { marginTop: 14, fontSize: 14.5, fontWeight: '600', color: C.bad },
  card: { marginTop: 18, backgroundColor: C.grey, borderRadius: R.card, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  cardText: { marginTop: 4, fontSize: 14.5, color: C.ink2 },
  askedHead: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  askedTitle: { fontSize: 16.5, fontWeight: '600', color: C.ink },
  askedLine: { marginTop: 8, fontSize: 15, lineHeight: 21, color: C.ink2 },
  progress: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.night, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 6 },
  progressText: { marginLeft: 12, fontSize: 14, fontWeight: '600', color: C.onNight, fontVariant: ['tabular-nums'] },
  group: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  groupHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  groupTitle: { flex: 1, fontSize: 16.5, fontWeight: '600', color: C.ink },
  groupCount: { fontSize: 14, color: C.ink3, fontVariant: ['tabular-nums'] },
  step: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingLeft: 2 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.6, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: -1 },
  boxOn: { backgroundColor: C.or, borderColor: C.or },
  stepText: { flex: 1, fontSize: 15.5, lineHeight: 21, color: C.ink },
  stepDone: { color: C.ink3, textDecorationLine: 'line-through' },
  live: { marginTop: 24, backgroundColor: C.night, borderRadius: R.cardLg, padding: 18 },
  liveTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.orLight },
  liveField: { marginTop: 12, height: H.field, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: C.ink }
});
