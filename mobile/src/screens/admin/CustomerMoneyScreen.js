/* One customer's plan and payments, from the Money tab: what they pay,
 * when it renews or ends and why, and the four things you can do about
 * it. Same rules as the admin page, because it is the same API:
 *
 *   Change plan   any plan, monthly or yearly (One is monthly only).
 *                 Shows what it costs today before anything changes.
 *   Refund        a payment, in full or part.
 *   Set to end    at the end of what they have paid for, with a reason
 *                 (and a note). They get an email saying when.
 *   End it now    for the rare case it has to stop today. Needs the
 *                 business name typed; nothing is refunded by it.
 * And Keep their plan, while one is set to end. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Button, Chip, Empty, FadeIn, Field, Label, Note, Skeleton, Tag, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import { choose, confirm } from '../../components/chat';
import { admin } from '../../lib/api';
import { haptic, openOutside } from '../../lib/phone';
import { telHref } from '../../lib/format';
import { bus } from '../../lib/bus';
import { C, R } from '../../theme';
import { PLAN_WORD, REASONS, SOURCE_WORD, day, money } from '../../lib/money';

const STATUS = { active: 'Active', trialing: 'Active', past_due: 'Card failing', unpaid: 'Card failing', canceled: 'Ended', incomplete: 'Not paid yet', incomplete_expired: 'Never paid', paused: 'Paused' };
const PLANS = [
  { key: 'starter', yearly: true }, { key: 'business', yearly: true }, { key: 'max', yearly: false }
];

/* Pick a reason: the chips, one chosen. */
function Reasons({ value, onChange }) {
  return (
    <View style={s.reasons}>
      {REASONS.map((r) => {
        const on = r.key === value;
        return (
          <Press key={r.key} onPress={() => { haptic.select(); onChange(on ? null : r.key); }} scale={0.96} feel={null}
            style={[s.reason, on && s.reasonOn]} testID={'reason-' + r.key}>
            <Text style={[s.reasonText, on && { color: '#fff' }]}>{r.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

export default function CustomerMoneyScreen({ route, navigation }) {
  const { userId } = route.params;
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState(null); // 'end' | 'now' | 'refund'
  const [reason, setReason] = useState(null);
  const [why, setWhy] = useState('');
  const [typed, setTyped] = useState('');
  const [refund, setRefund] = useState(null); // the invoice being refunded
  const [part, setPart] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: '' });

  const { refreshing, onRefresh, reload } = useLoad(async () => {
    try {
      const res = await admin({ action: 'billing', userId });
      if (b) animateNext();
      setB(res);
      setError('');
      navigation.setOptions({ title: (res.person && res.person.name) || route.params.name || '' });
    } catch (e) { setError(e.message); }
  });

  const openPanel = (p) => { animateNext(); setPanel(panel === p ? null : p); setNote({ text: '' }); setReason(null); setWhy(''); setTyped(''); };
  const done = async (text) => {
    haptic.success(); setNote({ text, ok: true }); animateNext(); setPanel(null); setRefund(null); setPart('');
    await reload(true);
    bus.emit('refresh');
  };
  const run = async (payload, text) => {
    setBusy(true); setNote({ text: '' });
    try { const out = await admin(Object.assign({ userId }, payload)); await done(typeof text === 'function' ? text(out) : text); }
    catch (e) { haptic.error(); setNote({ text: e.message, bad: true }); }
    setBusy(false);
  };

  if (!b) {
    return error ? <Empty title="Could not load" text={error} />
      : <Page><Skeleton height={26} width="55%" /><Skeleton height={130} style={{ marginTop: 18 }} radius={R.card} /><Skeleton height={200} style={{ marginTop: 22 }} radius={R.card} /></Page>;
  }

  const p = b.person || {};
  const sub = b.subscription && !b.subscription.missing ? b.subscription : null;
  const live = sub && ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status);
  const ending = live && (sub.cancelAtPeriodEnd || sub.cancelAt);
  const endsOn = sub && (sub.cancelAt || sub.currentPeriodEnd);
  const plan = (sub && sub.plan) || b.plan;
  const c = p.cancellation;

  const changePlan = async () => {
    const options = [];
    PLANS.forEach((x) => {
      options.push({ plan: x.key, interval: 'month', label: PLAN_WORD[x.key] + ', monthly' });
      if (x.yearly) options.push({ plan: x.key, interval: 'year', label: PLAN_WORD[x.key] + ', yearly' });
    });
    const now = options.filter((o) => !(o.plan === plan && o.interval === (sub.interval || 'month')));
    const i = await choose('Move ' + (p.name || 'them') + ' to', now.map((o) => o.label));
    if (i < 0) return;
    const to = now[i];
    setBusy(true); setNote({ text: 'Working out the price…' });
    let pre;
    try { pre = await admin({ action: 'changePlan', userId, plan: to.plan, interval: to.interval, apply: false }); }
    catch (e) { setBusy(false); haptic.error(); setNote({ text: e.message, bad: true }); return; }
    setBusy(false); setNote({ text: '' });
    const price = money(pre.amount) + (pre.interval === 'year' ? ' a year' : ' a month');
    const body = pre.upgrading
      ? 'They are charged ' + (pre.dueNow != null ? money(pre.dueNow) : 'the difference') + ' today, then ' + price + '.'
      : 'They keep ' + (PLAN_WORD[pre.from] || 'their plan') + ' until ' + day(pre.renewsAt ? new Date(pre.renewsAt * 1000).toISOString() : null) + ', then pay ' + price + '.';
    if (!(await confirm({ title: 'Move to ' + to.label + '?', body, ok: 'Move them' }))) return;
    await run({ action: 'changePlan', plan: to.plan, interval: to.interval, apply: true },
      (out) => out.upgrading ? 'Moved to ' + to.label + '.' : 'Moving to ' + to.label + ' at their renewal.');
  };

  const setToEnd = async () => {
    if (!reason) { haptic.warning(); setNote({ text: 'Pick a reason first.', bad: true }); return; }
    if (!(await confirm({ title: 'Set to end on ' + day(sub.currentPeriodEnd) + '?', body: 'They keep everything until then and are not charged again. They get an email saying so.', ok: 'Set to end', danger: true }))) return;
    await run({ action: 'setCancelAtPeriodEnd', cancel: true, reason, note: why }, 'Set to end. They have been emailed.');
  };
  const keep = async () => {
    if (!(await confirm({ title: 'Keep their plan?', body: 'It carries on and renews as normal.', ok: 'Keep it' }))) return;
    await run({ action: 'reactivate' }, 'Kept. It renews as normal.');
  };
  const endNow = async () => {
    if (!reason) { haptic.warning(); setNote({ text: 'Pick a reason first.', bad: true }); return; }
    if (!(await confirm({ title: 'End it today?', body: 'Their plan stops now. Nothing is refunded by this: refund a payment separately if you mean to.', ok: 'End it now', danger: true }))) return;
    await run({ action: 'cancelNow', confirm: typed, reason, note: why }, 'Ended.');
  };
  const doRefund = async (inv, amountPence) => {
    const amt = amountPence == null ? inv.refundable : amountPence;
    if (!(await confirm({ title: 'Refund ' + money(amt) + '?', body: 'Back to their card in 5 to 10 days. This cannot be undone.', ok: 'Refund', danger: true }))) return;
    await run({ action: 'refund', paymentId: inv.id, amount: amountPence == null ? null : amountPence }, 'Refunded ' + money(amt) + '.');
  };
  const startRefund = async (inv) => {
    const i = await choose('Refund from ' + money(inv.amount_paid), ['All of it (' + money(inv.refundable) + ')', 'Part of it']);
    if (i === 0) doRefund(inv, null);
    if (i === 1) { animateNext(); setRefund(inv); setPart(''); setPanel('refund'); setNote({ text: '' }); }
  };
  const partRefund = () => {
    const pence = Math.round(Number(String(part).replace(/[£,\s]/g, '')) * 100);
    if (!pence || pence < 1 || pence > refund.refundable) { haptic.warning(); setNote({ text: 'Between £0.01 and ' + money(refund.refundable) + '.', bad: true }); return; }
    doRefund(refund, pence);
  };

  const status = sub ? (ending ? 'Ends ' + day(endsOn) : STATUS[sub.status] || sub.status) : (STATUS[b.profileStatus] || 'No plan');
  const confirmName = String(p.name || 'CANCEL');

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: 4 }}>
      <View style={s.head}>
        <Text style={s.name} numberOfLines={2}>{p.name || route.params.name || 'Customer'}</Text>
        <View style={s.tags}>
          {plan ? <Tag text={PLAN_WORD[plan] || plan} kind="building" /> : null}
          <Tag text={status} kind={sub && (sub.status === 'past_due' || sub.status === 'unpaid') ? 'reply' : ending ? 'waiting' : 'plain'} style={{ marginLeft: 6 }} />
        </View>
        {p.contact && p.contact !== p.name ? <Text style={s.who}>{p.contact}</Text> : null}
        <View style={s.chips}>
          {p.phone ? <Chip title="Call" icon="phone" onPress={() => openOutside(telHref(p.phone))} /> : null}
          {p.email ? <Chip title="Email" icon="mail" onPress={() => openOutside('mailto:' + p.email)} /> : null}
          <Chip title="Customer page" onPress={() => navigation.navigate('WebPage', { title: p.name || 'Customer', path: '/admin.html?c=' + userId })} />
        </View>
      </View>

      {!b.configured ? <Note text="Stripe is not connected here." bad /> : null}
      {sub ? (
        <View style={s.card}>
          <View style={s.cardRow}><Text style={s.k}>Pays</Text><Text style={s.v}>{sub.amount != null ? money(sub.amount) + (sub.interval === 'year' ? ' a year' : ' a month') : '—'}</Text></View>
          <View style={s.cardRow}><Text style={s.k}>{ending ? 'Ends' : sub.status === 'canceled' ? 'Ended' : 'Renews'}</Text><Text style={s.v}>{day(endsOn) || '—'}</Text></View>
          {c && c.reason && !c.undone_at ? (
            <View style={s.why}>
              <Text style={s.whyTitle}>{(c.ended_at ? 'Left: ' : 'Leaving: ') + (c.label || 'No reason given')}</Text>
              <Text style={s.whyText}>{[SOURCE_WORD[c.source] ? 'Set ' + SOURCE_WORD[c.source] : null, c.scheduled_at ? day(c.scheduled_at) : null].filter(Boolean).join(', ')}</Text>
              {c.note ? <Text style={s.whyNote}>{'“' + c.note + '”'}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : <Text style={s.none}>{b.subscription && b.subscription.missing ? 'Their subscription could not be found in Stripe.' : 'No subscription.'}</Text>}

      {live ? (
        <View style={{ marginTop: 16 }}>
          {ending ? <Button title="Keep their plan" onPress={keep} busy={busy && !panel} testID="keep" /> : null}
          {!ending && sub.status !== 'past_due' && sub.status !== 'unpaid' ? <Button title="Change plan" kind="dark" onPress={changePlan} busy={busy && !panel} testID="change-plan" /> : null}
          {!ending ? <Button title="Set to end" kind="ghost" onPress={() => openPanel('end')} style={{ marginTop: 10 }} testID="set-to-end" /> : null}
          {panel === 'end' ? (
            <FadeIn style={s.panel}>
              <Text style={s.panelTitle}>{'Ends on ' + day(sub.currentPeriodEnd) + '. Why are they leaving?'}</Text>
              <Reasons value={reason} onChange={setReason} />
              <Field value={why} onChangeText={setWhy} placeholder="Anything they said (optional)" multiline style={{ marginTop: 12 }} maxLength={450} />
              <Button title="Set to end" kind="dark" onPress={setToEnd} busy={busy} disabled={!reason} style={{ marginTop: 12 }} testID="confirm-end" />
            </FadeIn>
          ) : null}
          <Button title="End it now…" kind="danger" small onPress={() => openPanel('now')} style={{ marginTop: 10 }} testID="end-now" />
          {panel === 'now' ? (
            <FadeIn style={s.panel}>
              <Text style={s.panelTitle}>Stops today, not at the end of the period. Only for fraud, a duplicate, or when they ask. Why?</Text>
              <Reasons value={reason} onChange={setReason} />
              <Field value={why} onChangeText={setWhy} placeholder="Anything they said (optional)" multiline style={{ marginTop: 12 }} maxLength={450} />
              <Field value={typed} onChangeText={setTyped} label={'Type ' + confirmName + ' to confirm'} autoCapitalize="none" autoCorrect={false} style={{ marginTop: 12 }} testID="confirm-name" />
              <Button title="End it now" kind="danger" onPress={endNow} busy={busy}
                disabled={!reason || typed.trim().toLowerCase() !== confirmName.trim().toLowerCase()} style={{ marginTop: 12 }} testID="confirm-now" />
            </FadeIn>
          ) : null}
        </View>
      ) : null}
      <Note {...note} />

      <Label style={s.section}>Payments</Label>
      {!(b.invoices || []).length ? <Text style={s.none}>No payments yet.</Text> : b.invoices.map((inv, i) => (
        <View key={inv.id} style={[s.inv, i < b.invoices.length - 1 && s.rule]}>
          <View style={{ flex: 1 }}>
            <Text style={s.invTitle}>{money(inv.amount_paid || inv.total)}<Text style={s.invWhen}>{'  ' + day(inv.created)}</Text></Text>
            <Text style={s.invSub} numberOfLines={1}>{[
              inv.status === 'paid' ? (inv.refunded ? (inv.refundable ? money(inv.refunded) + ' refunded' : 'Refunded') : 'Paid')
                : inv.status === 'open' ? 'Not paid yet' + (inv.attempt_count ? ' (' + inv.attempt_count + ' tr' + (inv.attempt_count === 1 ? 'y' : 'ies') + ')' : '')
                : inv.status === 'void' ? 'Void' : inv.status,
              inv.number
            ].filter(Boolean).join(' · ')}</Text>
          </View>
          {inv.status === 'paid' && inv.refundable > 0 ? <Chip title="Refund" onPress={() => startRefund(inv)} /> : null}
          {inv.hosted_invoice_url ? <View style={{ marginLeft: 8 }}><Chip title="Invoice" onPress={() => openOutside(inv.hosted_invoice_url)} /></View> : null}
        </View>
      ))}
      {panel === 'refund' && refund ? (
        <FadeIn style={s.panel}>
          <Text style={s.panelTitle}>{'How much of ' + money(refund.refundable) + '?'}</Text>
          <Field value={part} onChangeText={setPart} placeholder="£" keyboardType="decimal-pad" testID="refund-amount" />
          <Button title="Refund" kind="danger" onPress={partRefund} busy={busy} disabled={!part.trim()} style={{ marginTop: 12 }} />
        </FadeIn>
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  head: { marginBottom: 14 },
  name: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: C.ink },
  tags: { flexDirection: 'row', marginTop: 8 },
  who: { marginTop: 8, fontSize: 15, color: C.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  card: { backgroundColor: C.grey, borderRadius: R.cardLg, padding: 16 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontSize: 15, color: C.ink2 },
  v: { fontSize: 15.5, fontWeight: '600', color: C.ink },
  why: { marginTop: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  whyTitle: { fontSize: 15.5, fontWeight: '600', color: C.ink },
  whyText: { marginTop: 2, fontSize: 13.5, color: C.ink3 },
  whyNote: { marginTop: 6, fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  none: { fontSize: 15.5, color: C.ink2, marginTop: 4 },
  panel: { marginTop: 12, borderWidth: 1, borderColor: C.lineSoft, borderRadius: R.card, padding: 16 },
  panelTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: C.ink, marginBottom: 10 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  reasonOn: { backgroundColor: C.ink, borderColor: C.ink },
  reasonText: { fontSize: 14, fontWeight: '500', color: C.ink },
  section: { marginTop: 28, marginBottom: 6 },
  inv: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  invTitle: { fontSize: 16.5, fontWeight: '600', color: C.ink },
  invWhen: { fontSize: 14, fontWeight: '400', color: C.ink3 },
  invSub: { marginTop: 3, fontSize: 14, color: C.ink2 }
});
