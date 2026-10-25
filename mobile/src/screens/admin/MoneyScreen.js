/* Kane's Money tab: Kanvas One's own money, not a customer's.
 *
 *   Overview  what comes in a month, what was collected, what is at risk,
 *             this month against last, each plan, the latest payments and
 *             everyone paying.
 *   Care      the people who need something from you: cards failing (and
 *             how much of the 14 days is left), disputes, plans set to end
 *             and why, cards that run out before the next payment, and who
 *             left in the last month.
 *   Metrics   the three things to look at first, then churn, lifetime,
 *             value, cost per customer (from the ad spend typed in here),
 *             why people left, and how each month's sign-ups have stayed.
 * A customer opens their own page (plan, refunds, ending it); a dispute
 * opens its evidence. Everything comes from /api/admin money and metrics
 * (api/_money.js). */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Button, Empty, FadeIn, Field, Label, Note, Segmented, Skeleton, Tag, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { admin } from '../../lib/api';
import { useApp } from '../../state/app';
import { haptic } from '../../lib/phone';
import { C, H, R } from '../../theme';
import { CHARGE_TAG, CHARGE_WORD, DISPUTE_WORD, PLAN_WORD, SOURCE_WORD, day, dayLong, daysUntil, money, perMonth, reasonWord } from '../../lib/money';

function Tile({ n, label, sub, hot, onPress, testID }) {
  return (
    <Press style={s.tile} onPress={onPress} feel={onPress ? 'select' : null} scale={onPress ? 0.97 : 1} testID={testID}>
      <Text style={[s.tileN, hot && { color: C.orLight }]} numberOfLines={1} adjustsFontSizeToFit>{n}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {sub ? <Text style={[s.tileSub, hot && { color: C.orLight }]}>{sub}</Text> : null}
    </Press>
  );
}

function Line({ label, a, b, strong, last }) {
  return (
    <View style={[s.line, !last && s.lineRule]}>
      <Text style={[s.lineLabel, strong && { fontWeight: '700', color: C.ink }]}>{label}</Text>
      <Text style={[s.lineA, strong && { fontWeight: '700' }]}>{a}</Text>
      {b !== undefined ? <Text style={s.lineB}>{b}</Text> : null}
    </View>
  );
}

/* One row in a list of people: who, a line under, and money or a tag on
   the right. */
function Person({ title, sub, note, right, tag, onPress, last, testID }) {
  return (
    <Press onPress={onPress} scale={0.985} style={[s.person, !last && s.lineRule]} testID={testID}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.personTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.personSub} numberOfLines={2}>{sub}</Text> : null}
        {note ? <Text style={s.personNote} numberOfLines={2}>{note}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
        {right ? <Text style={s.personRight}>{right}</Text> : null}
        {tag ? <Tag text={tag.text} kind={tag.kind} style={{ marginTop: right ? 5 : 0 }} /> : null}
      </View>
      {onPress ? <View style={{ marginLeft: 8 }}><Icon name="chevron" size={16} color={C.ink3} /></View> : null}
    </Press>
  );
}

function Overview({ d, open, toCare }) {
  const sum = d.summary || {};
  const tm = d.thisMonth || {}, lm = d.lastMonth || {};
  const [everyone, setEveryone] = useState(false);
  const plans = Object.keys(sum.byPlan || {}).sort((a, b) => sum.byPlan[b].monthly - sum.byPlan[a].monthly);
  const subs = (d.subscriptions || []).slice().sort((a, b) => b.monthly - a.monthly);
  return (
    <View>
      <View style={s.grid}>
        <Tile n={money(sum.mrr)} label="Coming in a month" sub={(sum.paying || 0) + ' paying'} testID="tile-mrr" />
        <Tile n={money(tm.gross - tm.refunds)} label="Collected" sub={(tm.label || '').split(' ')[0] + ' so far'} />
        <Tile n={money(sum.atRisk)} label="At risk" hot={sum.failing > 0} onPress={toCare}
          sub={sum.failing ? sum.failing + ' card' + (sum.failing === 1 ? '' : 's') + ' failing' : 'No failing cards'} />
        <Tile n={money(sum.ending)} label="Set to end" hot={sum.endingCount > 0} onPress={toCare}
          sub={sum.endingCount ? sum.endingCount + ' plan' + (sum.endingCount === 1 ? '' : 's') : 'Nobody leaving'} />
      </View>
      {!d.stripe ? <Note text="Stripe is not connected here, so subscriptions are not shown." bad /> : null}

      <Label style={s.section}>Money in</Label>
      <View style={s.table}>
        <View style={[s.line, s.lineRule]}>
          <Text style={s.lineLabel} />
          <Text style={s.lineHead}>{(tm.label || 'This month').split(' ')[0]}</Text>
          <Text style={s.lineHeadB}>{(lm.label || 'Last month').split(' ')[0]}</Text>
        </View>
        <Line label="Plans" a={money(tm.plan)} b={money(lm.plan)} />
        <Line label="Request charges" a={money(tm.extras)} b={money(lm.extras)} />
        <Line label="Refunds" a={tm.refunds ? '−' + money(tm.refunds) : money(0)} b={lm.refunds ? '−' + money(lm.refunds) : money(0)} />
        <Line label="Stripe fees" a={tm.fees ? '−' + money(tm.fees) : money(0)} b={lm.fees ? '−' + money(lm.fees) : money(0)} />
        <Line label="Yours to keep" a={money(tm.net)} b={money(lm.net)} strong />
        <Line label="Failed payments" a={String(tm.failed || 0)} b={String(lm.failed || 0)} last />
      </View>

      {plans.length ? <Label style={s.section}>Each plan</Label> : null}
      {plans.map((k, i) => {
        const p = sum.byPlan[k];
        return <Person key={k} title={PLAN_WORD[k] || 'Other'} last={i === plans.length - 1}
          sub={p.count + ' customer' + (p.count === 1 ? '' : 's') + (p.yearly ? ' · ' + p.yearly + ' yearly' : '')} right={perMonth(p.monthly)} />;
      })}

      <Label style={s.section}>Latest payments</Label>
      {!(d.recent || []).length ? <Text style={s.none}>No payments yet.</Text> : d.recent.slice(0, 15).map((r, i, all) => (
        <Person key={r.charge_id} title={r.name} last={i === all.length - 1}
          sub={[day(r.charged_at), PLAN_WORD[r.plan], r.kind === 'extra' ? 'Request' : r.interval === 'year' ? 'Yearly' : null].filter(Boolean).join(' · ')}
          note={r.status === 'failed' ? r.failure_message : null}
          right={money(r.amount)} tag={r.status === 'paid' ? null : { text: CHARGE_WORD[r.status] || r.status, kind: CHARGE_TAG[r.status] }}
          onPress={r.user_id ? () => open(r.user_id, r.name) : undefined} />
      ))}

      {subs.length ? (
        <View>
          <Press onPress={() => { animateNext(); setEveryone(!everyone); }} style={s.foldHead} feel="select" testID="everyone">
            <Label style={s.section}>{'Everyone paying (' + subs.length + ')'}</Label>
            <View style={{ transform: [{ rotate: everyone ? '90deg' : '0deg' }], marginTop: 22 }}><Icon name="chevron" size={16} color={C.ink3} /></View>
          </Press>
          {everyone ? subs.map((x, i) => (
            <Person key={x.id} title={x.name} last={i === subs.length - 1}
              sub={[PLAN_WORD[x.plan] || 'Plan', x.interval === 'year' ? 'yearly' : 'monthly', x.bucket === 'ending' ? 'ends ' + day(x.endsAt) : x.renewsAt ? 'renews ' + day(x.renewsAt) : null].filter(Boolean).join(' · ')}
              right={perMonth(x.monthly)}
              tag={x.bucket === 'failing' ? { text: 'Card failing', kind: 'reply' } : x.bucket === 'ending' ? { text: 'Ending', kind: 'plain' } : null}
              onPress={x.userId ? () => open(x.userId, x.name) : undefined} />
          )) : null}
        </View>
      ) : null}
    </View>
  );
}

function Care({ d, open, openDispute }) {
  const care = d.care || [];
  const of = (k) => care.filter((c) => c.kind === k);
  const failing = of('failing'), disputes = of('dispute'), ending = of('ending'), cards = of('card'), ended = of('ended');
  if (!failing.length && !disputes.length && !ending.length && !cards.length && !ended.length) {
    return <Empty title="All clear" text="No failing cards, disputes or plans set to end. Nobody needs you here right now." />;
  }
  const group = (title, list, row, hint) => list.length ? (
    <View key={title}>
      <Label style={s.section}>{title + ' (' + list.length + ')'}</Label>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {list.map((c, i) => row(c, i === list.length - 1, i))}
    </View>
  ) : null;
  return (
    <View>
      {group('Disputes', disputes, (c, last, i) => {
        const left = daysUntil(c.dueBy);
        return <Person key={c.disputeId} title={c.name} last={last} testID={'dispute-' + i}
          sub={money(c.amount) + ' · ' + (DISPUTE_WORD[c.reason] || 'Disputed')}
          note={c.submitted ? 'Evidence sent. Waiting on the bank.' : c.dueBy ? 'Answer by ' + dayLong(c.dueBy) + (left != null ? ' (' + Math.max(0, left) + ' day' + (left === 1 ? '' : 's') + ')' : '') : null}
          tag={c.submitted ? { text: 'Sent', kind: 'plain' } : { text: 'Answer', kind: 'reply' }}
          onPress={() => openDispute(c.disputeId, c.name)} />;
      }, 'Their bank has taken the money back while it looks. The evidence is drafted: check it and send it before the date.')}

      {group('Cards failing', failing, (c, last) => (
        <Person key={'f' + c.userId} title={c.name} last={last}
          sub={perMonth(c.monthly) + (c.graceDaysLeft != null ? ' · ' + c.graceDaysLeft + ' of 14 days left' : '')}
          note={c.detail} tag={{ text: c.graceDaysLeft != null && c.graceDaysLeft <= 3 ? 'Ending soon' : 'Retrying', kind: 'reply' }}
          onPress={c.userId ? () => open(c.userId, c.name) : undefined} />
      ), 'Stripe keeps retrying and they have been emailed. A message from you usually sorts it faster.')}

      {group('Set to end', ending, (c, last) => (
        <Person key={'e' + c.userId} title={c.name} last={last}
          sub={'Ends ' + day(c.endsAt) + ' · ' + perMonth(c.monthly)}
          note={reasonWord(c.reason, d.reasons) + (c.source ? ', ' + (SOURCE_WORD[c.source] || c.source) : '') + (c.note ? ': “' + c.note + '”' : '')}
          onPress={c.userId ? () => open(c.userId, c.name) : undefined} />
      ), 'Still paid up until the date. A call before then often keeps them, or a cheaper plan.')}

      {group('Cards running out', cards, (c, last) => (
        <Person key={'c' + c.userId} title={c.name} last={last}
          sub={(c.card ? cap(c.card.brand) + ' ' + c.card.last4 + ' ends ' + c.card.expMonth + '/' + String(c.card.expYear).slice(-2) : 'Card') + ' · next payment ' + day(c.renewsAt)}
          onPress={c.userId ? () => open(c.userId, c.name) : undefined} />
      ), 'They get an email a week before the payment. Nothing to do unless it fails.')}

      {group('Left in the last 30 days', ended, (c, last) => (
        <Person key={'x' + (c.userId || c.endedAt)} title={c.name} last={last}
          sub={(PLAN_WORD[c.plan] || 'Plan') + ' · ended ' + day(c.endedAt)}
          note={reasonWord(c.reason, d.reasons) + (c.note ? ': “' + c.note + '”' : '')}
          onPress={c.userId ? () => open(c.userId, c.name) : undefined} />
      ))}
    </View>
  );
}

function cap(x) { return x ? String(x).charAt(0).toUpperCase() + String(x).slice(1) : ''; }

const STATUS_DOT = { good: '#2e7d32', watch: '#d08a00', poor: C.bad, none: C.line };

function Metrics({ m, reload }) {
  const months = [-1, -2, -3].map((o) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + o);
    return { value: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: d.toLocaleDateString('en-GB', { month: 'short' }) };
  });
  const [month, setMonth] = useState(months[0].value);
  const had = (m.adSpend || []).find((x) => x.month === month);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState({ text: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setNote({ text: '' });
    try { await admin({ action: 'setAdSpend', month, amount }); haptic.success(); setAmount(''); setNote({ text: 'Saved.', ok: true }); await reload(); }
    catch (e) { haptic.error(); setNote({ text: e.message, bad: true }); }
    setBusy(false);
  };
  const life = m.lifetime || {};
  const lifeWord = life.stage === 'floor' ? 'Nobody has left yet, so this is how long they have stayed so far. It can only go up.'
    : life.stage === 'projected' ? 'Worked out from how often people leave (' + life.left + ' so far). It firms up once 15 have left.'
    : life.stage === 'measured' ? 'How long the people who left actually stayed.' : 'Shows once someone has paid.';
  const c = m.customers || {};
  return (
    <View>
      <Label style={[s.section, { marginTop: 4 }]}>Look at first</Label>
      {!(m.focus || []).length ? <Text style={s.none}>Everything is on target.</Text> : m.focus.map((f) => (
        <View key={f.key} style={[s.focus, f.status === 'poor' && { borderColor: C.or }]}>
          <View style={s.focusTop}>
            <Text style={s.focusLabel}>{f.label}</Text>
            <Text style={[s.focusN, f.status === 'poor' && { color: C.or }]}>{f.shown}</Text>
          </View>
          <Text style={s.focusTarget}>{'Aim: ' + f.target}</Text>
          <Text style={s.focusFix}>{f.fix}</Text>
        </View>
      ))}

      <View style={[s.grid, { marginTop: 18 }]}>
        <Tile n={String(c.active || 0)} label="Paying now" sub={c.joinedThisMonth + ' joined, ' + c.leftThisMonth + ' left this month'} />
        <Tile n={money(m.arpc)} label="Each customer" sub="a month, on average" />
        <Tile n={life.months == null ? '—' : life.months + ' mo'} label="How long they stay" sub={life.stage === 'floor' ? 'so far' : life.stage === 'projected' ? 'projected' : life.stage === 'measured' ? 'measured' : ''} />
        <Tile n={m.ltv == null ? '—' : money(m.ltv)} label="Each customer is worth" sub={life.stage === 'floor' ? 'paid so far' : 'over their lifetime'} />
      </View>
      <Text style={s.hint}>{lifeWord}</Text>

      <Label style={s.section}>Cost per customer</Label>
      <View style={s.table}>
        <Line label="Ads, last 3 months" a={money(m.spend3)} />
        <Line label="Joined, last 3 months" a={String(m.joined3 || 0)} />
        <Line label="Cost per customer" a={m.cac == null ? '—' : money(m.cac)} strong />
        <Line label="Worth ÷ cost" a={m.ltvCac == null ? '—' : (Math.round(m.ltvCac * 10) / 10) + '×'} last />
      </View>
      <Text style={[s.fieldLabel, { marginTop: 16 }]}>What you spent on your own ads</Text>
      <Segmented value={month} onChange={(v) => { setMonth(v); setAmount(''); setNote({ text: '' }); }} options={months} />
      <View style={s.spendRow}>
        <Field value={amount} onChangeText={setAmount} placeholder={had ? '£' + (had.amount / 100) + ' saved' : '£0'} keyboardType="decimal-pad" style={{ flex: 1 }} testID="ad-spend" />
        <Button title="Save" small onPress={save} busy={busy} disabled={!amount.trim()} style={{ marginLeft: 10, alignSelf: 'center' }} />
      </View>
      <Note {...note} />

      <Label style={s.section}>Scoreboard</Label>
      {(m.board || []).map((b, i, all) => (
        <View key={b.key} style={[s.line, i < all.length - 1 && s.lineRule]}>
          <View style={[s.dot, { backgroundColor: STATUS_DOT[b.status] || C.line }]} />
          <Text style={s.lineLabel}>{b.label}</Text>
          <Text style={s.lineA}>{b.shown}</Text>
          <Text style={s.lineB}>{b.target}</Text>
        </View>
      ))}

      <Label style={s.section}>Why people left (12 months)</Label>
      {!(m.reasons || []).length ? <Text style={s.none}>Nobody has left in the last year.</Text> : m.reasons.map((r, i, all) => (
        <Line key={r.reason} label={r.label} a={String(r.count)} last={i === all.length - 1} />
      ))}

      <Label style={s.section}>Still here, by month joined</Label>
      {!(m.cohorts || []).length ? <Text style={s.none}>Nobody has joined in the last year.</Text> : m.cohorts.slice().reverse().map((h, i, all) => (
        <View key={h.month} style={[s.line, i < all.length - 1 && s.lineRule]}>
          <Text style={s.lineLabel}>{h.month}</Text>
          <View style={s.cohortBar}><View style={[s.cohortFill, { width: Math.round(h.stillHere / h.joined * 100) + '%' }]} /></View>
          <Text style={s.lineB}>{h.stillHere + ' of ' + h.joined}</Text>
        </View>
      ))}
    </View>
  );
}

export default function MoneyScreen({ navigation }) {
  const { setCounts } = useApp();
  const [view, setView] = useState('overview');
  const [d, setD] = useState(null);
  const [m, setM] = useState(null);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    try { setM(await admin({ action: 'metrics' })); setError(''); }
    catch (e) { setError(e.message); }
  };
  const { refreshing, onRefresh } = useLoad(async () => {
    try {
      const res = await admin({ action: 'money' });
      if (d) animateNext();
      setD(res);
      setCounts({ money: (res.care || []).filter((c) => c.kind === 'failing' || c.kind === 'dispute' && !c.submitted).length });
      setError('');
    } catch (e) { setError(e.message); }
    if (view === 'metrics' || m) await loadMetrics();
  });

  const open = (userId, name) => navigation.navigate('CustomerMoney', { userId, name });
  const openDispute = (disputeId, name) => navigation.navigate('Dispute', { disputeId, name });
  const careCount = d ? (d.care || []).filter((c) => c.kind !== 'ended').length : 0;

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      <Segmented stretch value={view} onChange={(v) => { animateNext(); setView(v); if (v === 'metrics' && !m) loadMetrics(); }} style={{ marginBottom: 16 }}
        options={[{ value: 'overview', label: 'Overview' }, { value: 'care', label: careCount ? 'Care (' + careCount + ')' : 'Care', dot: careCount > 0 }, { value: 'metrics', label: 'Metrics' }]} />
      {!d ? (error ? <Empty title="Could not load" text={error} /> : (
        <View>
          <View style={s.grid}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={112} radius={R.cardLg} width="48.5%" style={{ marginBottom: 10 }} />)}</View>
          <Skeleton height={20} width="40%" style={{ marginTop: 18 }} />
          <Skeleton height={180} style={{ marginTop: 14 }} radius={R.card} />
        </View>
      )) : (
        <FadeIn key={view}>
          {view === 'overview' ? <Overview d={d} open={open} toCare={() => { animateNext(); setView('care'); }} /> : null}
          {view === 'care' ? <Care d={d} open={open} openDispute={openDispute} /> : null}
          {view === 'metrics' ? (m ? <Metrics m={m} reload={loadMetrics} /> : error ? <Empty title="Could not load" text={error} /> : <Skeleton height={300} radius={R.card} />) : null}
        </FadeIn>
      )}
      {d && error ? <Note text={error} bad /> : null}
    </Page>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', minHeight: 112, marginBottom: 10, borderRadius: R.cardLg, backgroundColor: C.night, padding: 16 },
  tileN: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: C.onNight },
  tileLabel: { marginTop: 2, fontSize: 15, fontWeight: '600', color: C.onNight },
  tileSub: { marginTop: 2, fontSize: 13, color: C.onNight2 },
  section: { marginTop: 28, marginBottom: 6 },
  hint: { fontSize: 13.5, lineHeight: 19, color: C.ink2, marginBottom: 4 },
  none: { fontSize: 15.5, color: C.ink2, marginTop: 4 },
  table: { borderWidth: 1, borderColor: C.lineSoft, borderRadius: R.card, paddingHorizontal: 16 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  lineRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  lineLabel: { flex: 1, fontSize: 15, color: C.ink2, marginRight: 8 },
  lineHead: { width: 96, textAlign: 'right', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink3 },
  lineHeadB: { width: 84, textAlign: 'right', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink3 },
  lineA: { minWidth: 96, textAlign: 'right', fontSize: 15.5, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  lineB: { minWidth: 84, textAlign: 'right', fontSize: 14, color: C.ink3, fontVariant: ['tabular-nums'] },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  personTitle: { fontSize: 16.5, fontWeight: '600', color: C.ink },
  personSub: { marginTop: 3, fontSize: 14, color: C.ink2 },
  personNote: { marginTop: 4, fontSize: 13.5, color: C.ink3 },
  personRight: { fontSize: 15.5, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  foldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  focus: { borderWidth: 1.5, borderColor: C.lineSoft, borderRadius: R.card, padding: 16, marginBottom: 10 },
  focusTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  focusLabel: { flex: 1, fontSize: 16.5, fontWeight: '600', color: C.ink, marginRight: 10 },
  focusN: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: C.ink },
  focusTarget: { marginTop: 2, fontSize: 13.5, color: C.ink3 },
  focusFix: { marginTop: 8, fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 8 },
  spendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  cohortBar: { width: 90, height: 7, borderRadius: 4, backgroundColor: C.grey, overflow: 'hidden', marginRight: 6 },
  cohortFill: { height: 7, borderRadius: 4, backgroundColor: C.ink }
});
