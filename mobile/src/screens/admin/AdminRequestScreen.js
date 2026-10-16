/* One request, the admin's side. At the top, what they asked for, who and
 * when, a switch for where it is up to (Open, In progress, Done) and Edit
 * and Delete; below, the conversation; at the bottom, a reply or a note
 * only Kane sees. Everything that changes the request asks first. */
import { useCallback, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import ThreadLayout from '../../components/ThreadLayout';
import { Attachments, Bubble, Composer, MessageText, confirm } from '../../components/chat';
import { Button, Empty, FadeIn, Note, Segmented, Skeleton, Tag, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import { useLoad } from '../../components/screen';
import { admin } from '../../lib/api';
import { haptic, openOutside } from '../../lib/phone';
import { ago } from '../../lib/format';
import { STATUS_TAG, STATUS_WORD, sentLine } from '../../lib/build';
import { C, H, R } from '../../theme';

const STEPS = [
  ['new', 'Open', 'Move it back to open?', () => 'They aren’t told.', 'Move to open'],
  ['in_progress', 'In progress', 'Mark it in progress?', (n) => n + ' gets a notification.', 'Mark in progress'],
  ['done', 'Done', 'Mark it done?', (n) => n + ' gets a message to say it’s done.', 'Mark done']
];

function files(list) { return (list || []).map((f) => ({ url: f.url, pdf: /\.pdf$/i.test(f.path || '') })); }

export default function AdminRequestScreen({ route, navigation }) {
  const id = route.params.id;
  const [t, setT] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('waiting');
  const [editing, setEditing] = useState(null); // { title, body }
  const [note, setNote] = useState({ text: '' });
  const [busy, setBusy] = useState(false);
  const [sentNote, setSentNote] = useState('');

  const load = useCallback(async () => {
    try { const r = await admin({ action: 'requestThread', requestId: id }); setT(r); setError(''); }
    catch (e) { setError(e.message); }
  }, [id]);
  const { refreshing, onRefresh } = useLoad(load, [id]);

  const r = t && t.request;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: r ? (r.title || 'Request') : '',
      headerRight: r ? () => <Tag text={STATUS_WORD[r.status] || 'New'} kind={STATUS_TAG[r.status] || 'plain'} /> : undefined
    });
  }, [navigation, r]);

  if (!t) return error ? <Empty title="Could not load this request" text={error} /> : (
    <View style={{ padding: 20 }}><Skeleton height={14} width="50%" /><Skeleton height={120} style={{ marginTop: 14 }} radius={R.card} /><Skeleton height={60} width="70%" style={{ marginTop: 18 }} /></View>
  );

  const c = t.customer || {};
  const notes = t.notes || [];
  const first = notes.length && notes[0].author === 'customer' ? notes[0] : null;
  const rest = first ? notes.slice(1) : notes;
  const words = first ? first.body : (r.detail || r.title);
  const at = r.status === 'in_progress' ? 'in_progress' : r.status === 'done' ? 'done' : r.status === 'declined' ? '' : 'new';
  const name = c.contact_name || c.business_name || 'They';

  const run = async (payload, busyText, after) => {
    setBusy(true); setNote({ text: busyText });
    try { const res = await admin(payload); haptic.success(); setNote({ text: '' }); await after(res); }
    catch (e) { setNote({ text: e.message, bad: true }); haptic.error(); }
    setBusy(false);
  };

  const setStatus = async (step) => {
    if (step[0] === at) return;
    if (!(await confirm({ title: step[2], body: step[3](name), ok: step[4], cancel: 'Not yet' }))) return;
    run({ action: 'setRequestState', requestId: id, status: step[0] }, 'Saving…', load);
  };
  const save = async () => {
    if (editing.body.trim().length < 10) { setNote({ text: 'That needs a few more words.', bad: true }); return; }
    if (!(await confirm({ title: 'Save your changes?', body: 'They aren’t told.', ok: 'Save changes', cancel: 'Keep editing' }))) return;
    run({ action: 'editRequest', requestId: id, title: editing.title.trim(), body: editing.body.trim() }, 'Saving…', async () => { setEditing(null); await load(); });
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete this request?', body: 'It and all its messages are removed for good. They aren’t told.', ok: 'Delete', cancel: 'Keep it', danger: true }))) return;
    run({ action: 'deleteRequest', requestId: id }, 'Deleting…', () => navigation.goBack());
  };

  const send = async (body) => {
    const payload = { action: 'addRequestNote', requestId: id, body };
    if (mode === 'private') payload.isPrivate = true; else payload.status = mode;
    const res = await admin(payload);
    animateNext();
    setT((cur) => Object.assign({}, cur, {
      request: res.request || cur.request,
      notes: cur.notes.concat(Object.assign({ author: 'admin', private: mode === 'private', created_at: new Date().toISOString(), attachments: [] }, res.note))
    }));
    haptic.success();
    setSentNote(mode === 'private' ? 'Saved, only you see it.' : 'Sent.');
    setMode('waiting');
   
  };

  return (
    <ThreadLayout
      follow={notes.length}
      startAtTop={rest.length <= 2}
      refreshing={refreshing}
      onRefresh={onRefresh}
      composer={
        <Composer
          placeholder={mode === 'private' ? 'A note only you see' : 'Write a reply'}
          onSend={send}
          note={sentNote}
          top={<Segmented style={{ marginBottom: 10 }} value={mode} onChange={setMode} options={[{ value: 'waiting', label: 'Reply' }, { value: 'private', label: 'Private note' }]} />}
        />
      }
    >
      <FadeIn style={s.summary}>
        <Text style={s.meta}>{sentLine(r)}</Text>
        <Text style={s.who}>
          {[c.business_name, c.contact_name].filter(Boolean).join(' · ') || 'Customer'}
          {c.email ? <Text>{' · '}<Text style={s.mail} onPress={() => openOutside('mailto:' + c.email)}>{c.email}</Text></Text> : null}
        </Text>
        {editing ? (
          <View>
            <TextInput value={editing.title} onChangeText={(v) => setEditing({ ...editing, title: v })} placeholder="Title" maxLength={120} style={s.field} placeholderTextColor={C.ink3} />
            <TextInput value={editing.body} onChangeText={(v) => setEditing({ ...editing, body: v })} multiline maxLength={4000} style={[s.field, s.fieldMulti]} />
          </View>
        ) : <MessageText text={words} style={s.text} />}
        {first && first.attachments && first.attachments.length ? <Attachments items={files(first.attachments)} /> : null}

        <View style={s.switch}>
          {STEPS.map((st) => {
            const on = st[0] === at;
            return (
              <Press key={st[0]} onPress={() => setStatus(st)} disabled={busy} feel="select" style={[s.sw, on && s.swOn]}>
                <Text style={[s.swText, on && { color: '#fff' }]}>{st[1]}</Text>
              </Press>
            );
          })}
        </View>
        <View style={s.acts}>
          {editing ? (
            <>
              <Button title="Save" small onPress={save} disabled={busy} style={s.act} />
              <Button title="Discard" small kind="ghost" onPress={() => { setEditing(null); setNote({ text: '' }); }} style={s.act} />
            </>
          ) : (
            <>
              <Button title="Edit" small kind="ghost" icon="edit" onPress={() => setEditing({ title: r.title || '', body: words || '' })} style={s.act} />
              <Button title="Delete" small kind="danger" icon="trash" onPress={del} disabled={busy} style={s.act} />
            </>
          )}
        </View>
        <Note {...note} />
      </FadeIn>

      {rest.map((n) => (
        <Bubble key={n.id || n.created_at} mine={n.author === 'admin'} isPrivate={n.private}
          who={n.author === 'admin' ? (n.private ? 'Private note' : 'You') : 'Them'}
          text={n.body} when={ago(n.created_at)}
          extra={n.attachments && n.attachments.length ? <Attachments items={files(n.attachments)} /> : null} />
      ))}
      {!rest.length ? <Text style={s.empty}>No replies yet</Text> : null}
    </ThreadLayout>
  );
}

const s = StyleSheet.create({
  summary: { backgroundColor: C.grey, borderRadius: R.cardLg, padding: 18, marginBottom: 14 },
  meta: { fontSize: 13, fontWeight: '600', color: C.ink3 },
  who: { marginTop: 4, fontSize: 14.5, color: C.ink2 },
  mail: { color: C.ink, textDecorationLine: 'underline' },
  text: { marginTop: 12, fontSize: 16.5, lineHeight: 23, color: C.ink },
  field: { marginTop: 10, minHeight: H.field, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink, backgroundColor: '#fff' },
  fieldMulti: { minHeight: 120, textAlignVertical: 'top' },
  switch: { flexDirection: 'row', marginTop: 16, backgroundColor: '#fff', borderRadius: R.pill, padding: 3 },
  sw: { flex: 1, height: H.seg, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  swOn: { backgroundColor: C.ink },
  swText: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  acts: { flexDirection: 'row', marginTop: 12 },
  act: { flex: 1, marginRight: 8 },
  empty: { textAlign: 'center', marginTop: 10, fontSize: 14, color: C.ink3 }
});
