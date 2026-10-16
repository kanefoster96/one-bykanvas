/* One person in the site's book: their details (edit and save), Chat,
 * Call, Email and Map, their history (payments and conversations) and
 * dated notes. Opened with no contact, it adds a new one. */
import { useCallback, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, useLoad } from '../../components/screen';
import { Avatar, Button, Card, Chip, Field, FadeIn, Label, Note, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import { confirm } from '../../components/chat';
import { useApp } from '../../state/app';
import { api } from '../../lib/api';
import { haptic, openOutside } from '../../lib/phone';
import { ago, pounds, shortWhen, telHref } from '../../lib/format';
import { C, H } from '../../theme';

const SOURCE_WORD = { chat: 'From live chat', enquiry: 'From an enquiry', payment: 'Paid on your site', manual: 'Added by you' };
const blank = { id: null, name: '', phone: '', email: '', address: '', company: '' };

export default function ContactScreen({ route, navigation }) {
  const { site, hasChat } = useApp();
  const [c, setC] = useState(route.params.contact ? Object.assign({}, blank, route.params.contact) : blank);
  const [form, setForm] = useState(() => Object.assign({}, blank, route.params.contact || {}));
  const [hist, setHist] = useState(null);
  const [notes, setNotes] = useState(null);
  const [note, setNote] = useState({ text: '' });
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const name = c.name || c.email || c.phone || (c.id ? 'Customer' : 'New customer');

  const load = useCallback(async () => {
    if (!c.id) return;
    try {
      const res = await api({ action: 'contact_get', site_id: site.site_id, contact_id: c.id });
      setC(res.contact); setForm(Object.assign({}, blank, res.contact));
      setNotes(res.notes || []);
      setHist({ convs: res.conversations || [], pays: res.payments || { count: 0 } });
    } catch (e) { setNote({ text: e.message, bad: true }); }
  }, [c.id, site]);
  const { refreshing, onRefresh } = useLoad(load, [c.id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={s.head}>
          <Avatar name={c.name} size={32} />
          <Text style={s.headName} numberOfLines={1}>{name}</Text>
        </View>
      )
    });
  }, [navigation, c.name, name]);

  const save = async () => {
    setBusy(true); setNote({ text: 'Saving…' });
    try {
      const wasNew = !c.id;
      const res = await api({ action: 'contact_save', site_id: site.site_id, contact: { id: c.id, name: form.name, phone: form.phone, email: form.email, address: form.address, company: form.company } });
      setC(res.contact); setForm(Object.assign({}, blank, res.contact));
      if (wasNew) { setNotes([]); setHist({ convs: [], pays: { count: 0 } }); }
      haptic.success();
      setNote({ text: wasNew ? 'Added.' : 'Saved.', ok: true });
    } catch (e) { setNote({ text: e.message, bad: true }); haptic.error(); }
    setBusy(false);
  };
  const del = async () => {
    if (!(await confirm({ title: 'Remove ' + name + '?', body: 'Their details and notes are deleted. Their chats stay in the inbox.', ok: 'Remove', danger: true }))) return;
    try { await api({ action: 'contact_delete', site_id: site.site_id, contact_id: c.id }); haptic.success(); navigation.goBack(); }
    catch (e) { setNote({ text: e.message, bad: true }); }
  };
  const chat = async () => {
    try {
      const res = await api({ action: 'contact_chat', site_id: site.site_id, contact_id: c.id });
      navigation.navigate('Thread', { id: res.conversation_id, note: res.created ? 'A new chat. Your first message goes to them by email, with a link to carry it on in the chat on your site.' : '' });
    } catch (e) { setNote({ text: e.message, bad: true }); }
  };
  const addNote = async () => {
    const text = draft.trim();
    if (!text) return;
    setNoteBusy(true);
    try {
      const res = await api({ action: 'contact_note_add', site_id: site.site_id, contact_id: c.id, body: text });
      animateNext(); setNotes((cur) => [res.note].concat(cur || [])); setDraft(''); haptic.success();
    } catch (e) { setNote({ text: e.message, bad: true }); }
    setNoteBusy(false);
  };
  const delNote = async (n) => {
    if (!(await confirm({ title: 'Delete this note?', ok: 'Delete', danger: true }))) return;
    try { await api({ action: 'contact_note_delete', site_id: site.site_id, note_id: n.id }); animateNext(); setNotes((cur) => cur.filter((x) => x.id !== n.id)); }
    catch (e) { setNote({ text: e.message, bad: true }); }
  };

  const f = (k) => ({ value: form[k] || '', onChangeText: (v) => setForm(Object.assign({}, form, { [k]: v })) });
  const sinceD = c.first_seen_at ? new Date(c.first_seen_at) : null;
  const meta = c.id ? [SOURCE_WORD[c.source], sinceD && !isNaN(sinceD) ? 'since ' + sinceD.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null].filter(Boolean).join(' · ') : 'A name, a phone, an email: whatever you have.';
  const bits = [];
  if (hist && hist.pays.count) bits.push(hist.pays.count + (hist.pays.count === 1 ? ' payment, ' : ' payments, ') + pounds(hist.pays.amount, 'gbp') + (hist.pays.last_at ? ', last ' + ago(hist.pays.last_at) : ''));
  if (hist && hist.convs.length) bits.push(hist.convs.length + (hist.convs.length === 1 ? ' conversation' : ' conversations'));

  return (
    <Page refreshing={refreshing} onRefresh={c.id ? onRefresh : undefined}>
      {meta ? <Text style={s.meta}>{meta}</Text> : null}
      {c.id ? (
        <View style={s.tools}>
          {hasChat ? <Chip dark title="Chat" icon="chat" onPress={chat} /> : null}
          {c.phone ? <Chip title="Call" icon="phone" onPress={() => openOutside(telHref(c.phone))} /> : null}
          {c.email ? <Chip title="Email" icon="mail" onPress={() => openOutside('mailto:' + c.email)} /> : null}
          {c.address ? <Chip title="Map" icon="pin" onPress={() => openOutside('https://maps.apple.com/?q=' + encodeURIComponent(c.address))} /> : null}
        </View>
      ) : null}

      <Card style={{ marginTop: 16 }}>
        <Label orange>Details</Label>
        <Field label="Name" {...f('name')} autoCapitalize="words" maxLength={80} style={s.field} autoFocus={!c.id} />
        <Field label="Phone" {...f('phone')} keyboardType="phone-pad" maxLength={30} style={s.field} />
        <Field label="Email" {...f('email')} keyboardType="email-address" autoCapitalize="none" maxLength={200} style={s.field} />
        <Field label="Address" {...f('address')} multiline maxLength={300} style={s.field} inputStyle={{ minHeight: 70 }} />
        <Field label="Business (optional)" {...f('company')} maxLength={120} style={s.field} />
        <Button title={c.id ? 'Save' : 'Add to my book'} onPress={save} busy={busy} style={{ marginTop: 16 }} />
        <Note {...note} />
        {c.id ? <Press onPress={del} style={s.del}><Text style={s.delText}>Remove from my book</Text></Press> : null}
      </Card>

      {bits.length ? (
        <Card style={{ marginTop: 14 }}>
          <Label orange>History</Label>
          <Text style={s.hint}>{bits.join('. ') + '.'}</Text>
          {hist.convs.slice(0, 5).map((cv) => (
            <Press key={cv.id} onPress={() => navigation.navigate('Thread', { id: cv.id })} style={s.histRow} scale={0.99}>
              <Text style={s.histKey} numberOfLines={1}>{(cv.channel === 'sms' ? 'Text · ' : cv.channel === 'whatsapp' ? 'WhatsApp · ' : '') + (cv.preview || 'Conversation')}</Text>
              <Text style={s.histWhen}>{shortWhen(cv.last_at)}</Text>
            </Press>
          ))}
        </Card>
      ) : null}

      {c.id ? (
        <Card style={{ marginTop: 14 }}>
          <Label orange>Notes</Label>
          <TextInput value={draft} onChangeText={setDraft} multiline maxLength={4000} placeholder="Last visit, what they have, what they asked for…" placeholderTextColor={C.ink3} style={s.noteField} />
          <Button title="Add note" small onPress={addNote} busy={noteBusy} disabled={!draft.trim()} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          {notes && !notes.length ? <Text style={s.hint}>No notes yet. The kind of thing you would otherwise keep in your head.</Text> : null}
          {(notes || []).map((n) => {
            const d = new Date(n.at);
            return (
              <FadeIn key={n.id} style={s.noteRow}>
                <Text style={s.noteBody}>{n.body}</Text>
                <View style={s.noteFoot}>
                  <Text style={s.noteWhen}>{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={s.noteDel} onPress={() => delNote(n)}>Delete</Text>
                </View>
              </FadeIn>
            );
          })}
        </Card>
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', maxWidth: 240 },
  headName: { marginLeft: 10, fontSize: 16.5, fontWeight: '600', color: C.ink, flexShrink: 1 },
  meta: { fontSize: 14.5, color: C.ink2 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  field: { marginTop: 12 },
  del: { marginTop: 14, alignSelf: 'center', padding: 6 },
  delText: { color: C.bad, fontSize: 15, fontWeight: '600' },
  hint: { marginTop: 8, fontSize: 14.5, lineHeight: 20, color: C.ink2 },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 6 },
  histKey: { flex: 1, fontSize: 15, color: C.ink, marginRight: 8 },
  histWhen: { fontSize: 13, color: C.ink3 },
  noteField: { marginTop: 10, minHeight: 70, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, fontSize: 16, color: C.ink, backgroundColor: '#fff', textAlignVertical: 'top' },
  noteRow: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  noteBody: { fontSize: 15.5, lineHeight: 21, color: C.ink },
  noteFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  noteWhen: { fontSize: 13, color: C.ink3 },
  noteDel: { fontSize: 13, fontWeight: '600', color: C.bad }
});
