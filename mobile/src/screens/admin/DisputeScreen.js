/* A bank dispute: what they said, the deadline, and the evidence, drafted
 * from what we hold (their sign-up, payments, site and requests, and our
 * terms). Read it, add anything you have (a message where they asked for
 * work, a call), save as you go, then send it. Evidence can only be sent
 * once, so sending needs SUBMIT typed. From the Money tab's Care list. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Button, Empty, Field, Label, Note, Skeleton, Tag } from '../../components/ui';
import { confirm } from '../../components/chat';
import { admin } from '../../lib/api';
import { haptic, openOutside } from '../../lib/phone';
import { bus } from '../../lib/bus';
import { C, R } from '../../theme';
import { DISPUTE_WORD, dayLong, daysUntil, money } from '../../lib/money';

/* Stripe's evidence fields, in the order a bank reads them, in our words. */
const FIELDS = [
  ['product_description', 'What they bought'],
  ['service_date', 'When it started'],
  ['access_activity_log', 'Proof they used it'],
  ['cancellation_policy_disclosure', 'How cancelling works'],
  ['cancellation_rebuttal', 'Did they cancel first?'],
  ['refund_policy_disclosure', 'Refunds'],
  ['refund_refusal_explanation', 'Why no refund (if they asked)'],
  ['uncategorized_text', 'Anything else (their payments are listed here)'],
  ['customer_name', 'Their name'],
  ['customer_email_address', 'Their email']
];

export default function DisputeScreen({ route, navigation }) {
  const { disputeId } = route.params;
  const [d, setD] = useState(null);
  const [ev, setEv] = useState({});
  const [dirty, setDirty] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState({ text: '' });
  const [error, setError] = useState('');

  useLoad(async (quiet) => {
    if (quiet && dirty) return; // never overwrite what is being typed
    try {
      const res = await admin({ action: 'disputeDraft', disputeId });
      setD(res.dispute); setEv(res.evidence || {}); setDirty(false); setError('');
      navigation.setOptions({ title: route.params.name || 'Dispute' });
    } catch (e) { setError(e.message); }
  });

  if (!d) return error ? <Empty title="Could not load" text={error} /> : <Page><Skeleton height={24} width="60%" /><Skeleton height={400} style={{ marginTop: 18 }} radius={R.card} /></Page>;

  const sent = Boolean(d.submitted_at), closed = Boolean(d.closed_at);
  const left = daysUntil(d.evidence_due_by);
  const set = (k, v) => { setEv((x) => Object.assign({}, x, { [k]: v })); setDirty(true); };

  const save = async () => {
    setBusy('save'); setNote({ text: '' });
    try { await admin({ action: 'disputeSave', disputeId, evidence: ev }); setDirty(false); haptic.success(); setNote({ text: 'Saved.', ok: true }); }
    catch (e) { haptic.error(); setNote({ text: e.message, bad: true }); }
    setBusy('');
  };
  const submit = async () => {
    if (!(await confirm({ title: 'Send the evidence?', body: 'It goes to their bank through Stripe and cannot be changed after. The bank usually decides within a few weeks.', ok: 'Send it', danger: true }))) return;
    setBusy('send'); setNote({ text: '' });
    try {
      await admin({ action: 'disputeSubmit', disputeId, evidence: ev, confirm: typed });
      haptic.success(); setNote({ text: 'Sent. You will get a notification when the bank decides.', ok: true });
      setD(Object.assign({}, d, { submitted_at: new Date().toISOString() })); setDirty(false);
      bus.emit('refresh');
    } catch (e) { haptic.error(); setNote({ text: e.message, bad: true }); }
    setBusy('');
  };

  return (
    <Page contentStyle={{ paddingTop: 4 }}>
      <Text style={s.amount}>{money(d.amount)}</Text>
      <View style={s.tags}>
        <Tag text={closed ? (d.status === 'won' ? 'Won' : d.status === 'lost' ? 'Lost' : 'Closed') : sent ? 'Evidence sent' : 'Needs answer'} kind={!closed && !sent ? 'reply' : 'plain'} />
      </View>
      <Text style={s.said}>{DISPUTE_WORD[d.reason] || 'Disputed'}</Text>
      {!closed && !sent && d.evidence_due_by ? (
        <Text style={[s.due, left != null && left <= 2 && { color: C.bad }]}>{'Answer by ' + dayLong(d.evidence_due_by) + (left != null ? ' (' + Math.max(0, left) + ' day' + (left === 1 ? '' : 's') + ' left)' : '')}</Text>
      ) : null}
      <Text style={s.hint}>The money is held by their bank while it looks. Clear, factual answers win: what they bought, that they agreed to the terms, and that they used it.</Text>
      <Button title="Open in Stripe" kind="ghost" small onPress={() => openOutside('https://dashboard.stripe.com/disputes/' + disputeId)} style={{ marginTop: 12 }} />

      <Label style={s.section}>{sent || closed ? 'What was sent' : 'The evidence'}</Label>
      {FIELDS.map(([k, label]) => (
        <Field key={k} label={label} value={ev[k] || ''} onChangeText={(v) => set(k, v)} editable={!sent && !closed}
          multiline={!/customer_/.test(k)} style={{ marginBottom: 14 }} inputStyle={/customer_/.test(k) ? null : s.box} />
      ))}

      {!sent && !closed ? (
        <View>
          <Button title={dirty ? 'Save changes' : 'Saved'} kind="dark" onPress={save} busy={busy === 'save'} disabled={!dirty} />
          <Field label="Type SUBMIT to send it" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} style={{ marginTop: 22 }} testID="submit-word" />
          <Button title="Send to the bank" onPress={submit} busy={busy === 'send'} disabled={typed.trim().toUpperCase() !== 'SUBMIT'} style={{ marginTop: 12 }} testID="submit-dispute" />
        </View>
      ) : null}
      <Note {...note} />
    </Page>
  );
}

const s = StyleSheet.create({
  amount: { fontSize: 34, fontWeight: '700', letterSpacing: -1, color: C.ink },
  tags: { flexDirection: 'row', marginTop: 6 },
  said: { marginTop: 10, fontSize: 17, fontWeight: '600', color: C.ink },
  due: { marginTop: 4, fontSize: 15, fontWeight: '600', color: C.or },
  hint: { marginTop: 10, fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  section: { marginTop: 26, marginBottom: 10 },
  box: { minHeight: 90 }
});
