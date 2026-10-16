/* One of the customer's requests: what they asked, with Edit and Cancel
 * while it is open and Delete once it is closed (each asks first), then
 * the conversation with Kanvas One, and a reply box with photos. */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import ThreadLayout from '../../components/ThreadLayout';
import { Attachments, Bubble, Composer, MessageText, confirm } from '../../components/chat';
import { Button, Empty, FadeIn, Note, Skeleton, Tag, animateNext } from '../../components/ui';
import { useLoad } from '../../components/screen';
import { useApp } from '../../state/app';
import { requests as post, signedUrls, uploadFiles } from '../../lib/api';
import { LABEL, TAG, isDone, loadRequest, markSeen, unread } from '../../lib/requests';
import { sentLine } from '../../lib/build';
import { agoLong } from '../../lib/format';
import { haptic } from '../../lib/phone';
import { C, H, R } from '../../theme';

/* Stored photos, signed for an hour when the thread opens. */
function Files({ paths }) {
  const [items, setItems] = useState(null);
  useLoad(async () => {
    try { const urls = await signedUrls(paths); setItems(urls.map((u, i) => ({ url: u, pdf: /\.pdf($|\?)/i.test(paths[i]) })).filter((x) => x.url)); }
    catch (e) { setItems([]); }
  }, [paths.join('|')]);
  if (!items) return <View style={{ flexDirection: 'row', marginTop: 8 }}>{paths.map((p) => <Skeleton key={p} width={92} height={92} radius={12} style={{ marginRight: 6 }} />)}</View>;
  return <Attachments items={items} />;
}

export default function RequestScreen({ route, navigation }) {
  const { id } = route.params;
  const { user, refreshMe } = useApp();
  const [t, setT] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: '' });

  const seen = useRef(false);
  const load = useCallback(async () => {
    try {
      const d = await loadRequest(id);
      if (!d) { navigation.goBack(); return; }
      setT(d); setError('');
      // Read now: once per visit, and the badge drops (no refresh signal,
      // which would only load this screen again).
      if (unread(d.request) && !seen.current) { seen.current = true; await markSeen(id).catch(() => {}); refreshMe(); }
    } catch (e) { setError(e.message); }
  }, [id, navigation, refreshMe]);
  const { refreshing, onRefresh } = useLoad(load, [id]);

  const r = t && t.request;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: r ? (r.title || String(r.detail || '').split('\n')[0]) : '',
      headerRight: r ? () => <Tag text={LABEL[r.status] || 'Sent'} kind={TAG[r.status] || 'plain'} /> : undefined
    });
  }, [navigation, r]);

  if (!t) return error ? <Empty title="Could not load this request" text={error} /> : <View style={{ padding: 20 }}><Skeleton height={120} radius={R.card} /></View>;

  const notes = t.notes;
  const first = notes.length && notes[0].author === 'customer' ? notes[0] : null;
  const rest = first ? notes.slice(1) : notes;
  let lastAdmin = null;
  rest.forEach((n) => { if (n.author === 'admin') lastAdmin = n; });

  const act = async (payload, busyText) => {
    setBusy(true); setNote({ text: busyText });
    try { const res = await post(payload); haptic.success(); setNote({ text: '' }); return res; }
    catch (e) { setNote({ text: e.message, bad: true }); haptic.error(); return null; }
    finally { setBusy(false); }
  };
  const save = async () => {
    const words = editing.trim();
    if (words.length < 10) { setNote({ text: 'Add a little more so we know what you need.', bad: true }); return; }
    if (!(await confirm({ title: 'Save your changes?', body: 'We’ll see the new version straight away.', ok: 'Save changes', cancel: 'Keep editing' }))) return;
    if (await act({ action: 'edit', requestId: id, body: words }, 'Saving…')) { setEditing(null); load(); }
  };
  const cancel = async () => {
    if (!(await confirm({ title: 'Cancel this request?', body: 'We’ll stop work on it. You can reply later to reopen it.', ok: 'Yes, cancel it', cancel: 'Keep it', danger: true }))) return;
    if (await act({ action: 'cancel', requestId: id }, 'Cancelling…')) load();
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete this request?', body: 'It and its messages are removed for good.', ok: 'Delete', cancel: 'Keep it', danger: true }))) return;
    if (await act({ action: 'delete', requestId: id }, 'Deleting…')) navigation.goBack();
  };

  const send = async (body, files) => {
    const paths = files.length ? await uploadFiles(user.id, files) : [];
    await post({ action: 'reply', requestId: id, body, attachmentPaths: paths });
    haptic.success();
    animateNext();
    await load();
   
  };

  return (
    <ThreadLayout follow={notes.length} startAtTop={rest.length <= 2} refreshing={refreshing} onRefresh={onRefresh}
      composer={<Composer files minLength={10} placeholder={isDone(r) ? 'Reply to reopen' : 'Write a reply'} onSend={send} />}>
      <FadeIn style={s.summary}>
        <Text style={s.meta}>{sentLine(r)}</Text>
        {editing !== null ? (
          <TextInput value={editing} onChangeText={setEditing} multiline maxLength={4000} autoFocus style={s.field} />
        ) : <MessageText text={first ? first.body : r.detail} style={s.text} />}
        {first && first.attachment_paths && first.attachment_paths.length ? <Files paths={first.attachment_paths} /> : null}
        <View style={s.acts}>
          {editing !== null ? (
            <>
              <Button title="Save" small onPress={save} disabled={busy} style={s.act} />
              <Button title="Discard" small kind="ghost" onPress={() => { setEditing(null); setNote({ text: '' }); }} style={s.act} />
            </>
          ) : isDone(r) ? (
            <Button title="Delete" small kind="danger" icon="trash" onPress={del} disabled={busy} style={s.act} />
          ) : (
            <>
              <Button title="Edit" small kind="ghost" icon="edit" onPress={() => setEditing(first ? first.body : (r.detail || ''))} disabled={busy} style={s.act} />
              <Button title="Cancel request" small kind="danger" onPress={cancel} disabled={busy} style={s.act} />
            </>
          )}
        </View>
        <Note {...note} />
      </FadeIn>
      {rest.map((n) => (
        <Bubble key={n.id} mine={n.author !== 'admin'} who={n.author === 'admin' ? 'Kanvas One' : 'You'}
          tag={r.status === 'done' && n === lastAdmin ? 'Done' : null}
          text={n.body} when={agoLong(n.created_at)}
          extra={n.attachment_paths && n.attachment_paths.length ? <Files paths={n.attachment_paths} /> : null} />
      ))}
      {!rest.length ? <Text style={s.empty}>No replies yet</Text> : null}
    </ThreadLayout>
  );
}

const s = StyleSheet.create({
  summary: { backgroundColor: C.grey, borderRadius: R.cardLg, padding: 18, marginBottom: 14 },
  meta: { fontSize: 13, fontWeight: '600', color: C.ink3 },
  text: { marginTop: 10, fontSize: 16.5, lineHeight: 23, color: C.ink },
  field: { marginTop: 10, minHeight: 120, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, fontSize: 16, color: C.ink, backgroundColor: '#fff', textAlignVertical: 'top' },
  acts: { flexDirection: 'row', marginTop: 14 },
  act: { flex: 1, marginRight: 8, minHeight: H.btnSm },
  empty: { textAlign: 'center', marginTop: 10, fontSize: 14, color: C.ink3 }
});
