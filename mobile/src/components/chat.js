/* Conversations: message bubbles, links in them, and the box at the
   bottom with photos waiting to go. Used by live chat, requests (both
   sides) and the chat with Kane. */
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Press from './Press';
import Icon from './Icon';
import { C, OR_GRAD } from '../theme';
import { haptic, openOutside } from '../lib/phone';

/* "Are you sure?", the phone's own way: an alert with the safe choice
   first. Resolves true for yes. */
export function confirm({ title, body, ok = 'Yes', cancel = 'Cancel', danger }) {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(title + (body ? '\n\n' + body : '')));
  haptic.warning();
  return new Promise((resolve) => {
    Alert.alert(title, body || undefined, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: danger ? 'destructive' : 'default', onPress: () => resolve(true) }
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/* Choose from a short list, as an action sheet. Resolves the index, or -1. */
export function choose(title, options, destructiveIndex) {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => ActionSheetIOS.showActionSheetWithOptions(
      { title: title || undefined, options: options.concat('Cancel'), cancelButtonIndex: options.length, destructiveButtonIndex: destructiveIndex },
      (i) => resolve(i === options.length ? -1 : i)
    ));
  }
  if (Platform.OS === 'web') {
    const pick = window.prompt((title ? title + '\n' : '') + options.map((o, i) => (i + 1) + '. ' + o).join('\n'));
    const n = Number(pick) - 1;
    return Promise.resolve(n >= 0 && n < options.length ? n : -1);
  }
  return new Promise((resolve) => Alert.alert(title || '', undefined,
    options.map((o, i) => ({ text: o, onPress: () => resolve(i), style: i === destructiveIndex ? 'destructive' : 'default' })).concat({ text: 'Cancel', style: 'cancel', onPress: () => resolve(-1) }),
    { cancelable: true, onDismiss: () => resolve(-1) }));
}

/* A message's words: paragraphs, with links tappable. A file sent in a
   chat (a signed link to our storage) reads "Open file", not an address. */
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/;
export function MessageText({ text, style, light }) {
  const parts = String(text == null ? '' : text).split(URL_RE);
  return (
    <Text style={style} selectable>
      {parts.map((bit, i) => {
        if (!bit) return null;
        if (i % 2 === 0) return bit;
        const file = /\/storage\/v1\/object\/sign\//.test(bit);
        return (
          <Text key={i} onPress={() => openOutside(bit)} style={[file ? s.fileLink : s.link, light && file && { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
            {file ? ' Open file ' : bit.replace(/^https?:\/\//, '')}
          </Text>
        );
      })}
    </Text>
  );
}

/* One message. mine: on the right in black. private: a note only the
   admin sees, in pale yellow. system: a quiet line in the middle. */
export function Bubble({ who, text, when, mine, isPrivate, system, extra, tag }) {
  if (system) return <Text style={s.system}>{text}</Text>;
  return (
    <View style={[s.msg, mine ? s.msgMine : s.msgTheirs]}>
      {who ? (
        <View style={s.whoRow}>
          <Text style={s.who}>{who}</Text>
          {tag ? <Text style={s.whoTag}>{tag}</Text> : null}
        </View>
      ) : null}
      <View style={[s.body, mine ? s.bodyMine : s.bodyTheirs, isPrivate && s.bodyPrivate]}>
        {text ? <MessageText text={text} light={mine && !isPrivate} style={[s.bodyText, mine && !isPrivate && { color: '#fff' }, isPrivate && { color: C.privateText }]} /> : null}
        {extra}
      </View>
      {when ? <Text style={s.when}>{when}</Text> : null}
    </View>
  );
}

/* Photos sent with a message: small squares, tap to open full size. */
export function Attachments({ items }) {
  if (!items || !items.length) return null;
  return (
    <View style={s.files}>
      {items.map((f, i) => (
        <Press key={i} onPress={() => f.url && openOutside(f.url)} style={s.file}>
          {f.pdf || !f.url ? (
            <View style={s.fileDoc}><Icon name="doc" size={22} color={C.ink2} /><Text style={s.fileDocText}>{f.pdf ? 'PDF ' + (i + 1) : 'File'}</Text></View>
          ) : (
            <Image source={{ uri: f.url }} style={s.fileImg} />
          )}
        </Press>
      ))}
    </View>
  );
}

const ACCEPT_IMG = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

/* Photos and files waiting to go: picked from the library, taken with
   the camera, or chosen from Files. The preview is the photo itself,
   straight off the phone, so it shows the instant it is picked. */
export function useAttach(maxFiles = 5) {
  const [files, setFiles] = useState([]);
  const [problem, setProblem] = useState('');
  const add = (picked) => {
    setFiles((cur) => {
      const room = maxFiles - cur.length;
      if (picked.length > room) setProblem('Up to ' + maxFiles + ' files at a time.');
      const next = picked.slice(0, Math.max(0, room)).filter((f) => {
        if (f.size && f.size > 10 * 1024 * 1024) { setProblem((f.name || 'That file') + ' is over 10 MB. Try a smaller one.'); return false; }
        return true;
      });
      if (next.length) haptic.light();
      return cur.concat(next);
    });
  };
  const pickPhotos = async (camera) => {
    setProblem('');
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setProblem('Camera access is off. Turn it on in Settings to take a photo.'); return; }
      }
      const opts = { mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: !camera, selectionLimit: Math.max(1, maxFiles - files.length), exif: false };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      add((res.assets || []).map((a, i) => ({
        uri: a.uri, file: a.file, type: ACCEPT_IMG.indexOf(a.mimeType) >= 0 ? (a.mimeType === 'image/heic' || a.mimeType === 'image/heif' ? 'image/jpeg' : a.mimeType) : 'image/jpeg',
        name: a.fileName || ('photo-' + Date.now() + '-' + i + '.jpg'), size: a.fileSize, image: true
      })));
    } catch (e) { setProblem('Could not open your photos: ' + (e && e.message)); }
  };
  const pickFile = async () => {
    setProblem('');
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], multiple: true, copyToCacheDirectory: true });
      if (res.canceled) return;
      add((res.assets || []).map((a) => ({ uri: a.uri, file: a.file, type: a.mimeType || 'application/pdf', name: a.name, size: a.size, image: /^image\//.test(a.mimeType || '') })));
    } catch (e) { setProblem('Could not open your files.'); }
  };
  const attach = async () => {
    const i = await choose(null, ['Photo library', 'Take a photo', 'Choose a file']);
    if (i === 0) pickPhotos(false);
    if (i === 1) pickPhotos(true);
    if (i === 2) pickFile();
  };
  return { files, setFiles, problem, setProblem, attach, remove: (i) => setFiles((cur) => cur.filter((_, j) => j !== i)), clear: () => setFiles([]) };
}

export function AttachTray({ files, onRemove, busy, style }) {
  if (!files.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tray, style]} contentContainerStyle={{ paddingRight: 8, paddingTop: 6 }}>
      {files.map((f, i) => (
        <View key={f.uri + i} style={[s.tile, busy && { opacity: 0.5 }]}>
          {f.image ? <Image source={{ uri: f.uri }} style={s.tileImg} /> : (
            <View style={s.tileDoc}><Icon name="doc" size={22} color={C.ink2} /><Text style={s.tileName} numberOfLines={2}>{f.name}</Text></View>
          )}
          {!busy ? (
            <Press onPress={() => onRemove(i)} style={s.tileX} hitSlop={8} accessibilityLabel={'Remove ' + f.name}>
              <Icon name="close" size={12} color="#fff" stroke={2.8} />
            </Press>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

/* The box at the bottom. Photos picked wait above it as thumbnails, each
   with a cross, until sent. files: allow photos and PDFs. top: anything
   above the box (Live chat / Email, Reply / Private note). */
export function Composer({ placeholder = 'Write a reply', onSend, files: allowFiles, maxFiles = 5, minLength = 0, top, note, disabled, testID }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [h, setH] = useState(40);
  const a = useAttach(maxFiles);
  const files = a.files;

  const send = async () => {
    const body = text.trim();
    if (busy || disabled) return;
    if (!body && !files.length) return;
    if (!files.length && minLength && body.length < minLength) { a.setProblem('A little more than that, so we can help.'); haptic.warning(); return; }
    setBusy(true); a.setProblem('');
    try {
      const ok = await onSend(body, files);
      if (ok !== false) { setText(''); a.clear(); setH(40); }
    } catch (e) { a.setProblem(e && e.message ? e.message : 'Could not send that. Try again.'); haptic.error(); }
    setBusy(false);
  };

  const canSend = !!(text.trim() || files.length) && !busy && !disabled;
  return (
    <View style={s.composer}>
      {top}
      <AttachTray files={files} onRemove={a.remove} busy={busy} />
      <View style={s.bar}>
        {allowFiles ? (
          <Press onPress={a.attach} style={s.attach} accessibilityLabel="Add a photo or file" disabled={busy}>
            <Icon name="clip" size={22} color={C.ink} />
          </Press>
        ) : null}
        <TextInput
          testID={testID}
          style={[s.input, { height: text ? Math.min(130, Math.max(40, h)) : 40 }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={C.ink3}
          multiline
          maxLength={4000}
          editable={!disabled}
          onContentSizeChange={(e) => setH(text ? e.nativeEvent.contentSize.height + 18 : 40)}
        />
        <Press onPress={send} disabled={!canSend} feel="medium" style={s.sendWrap} accessibilityLabel="Send">
          <LinearGradient {...OR_GRAD} style={s.send}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="send" size={20} color="#fff" stroke={2.2} />}
          </LinearGradient>
        </Press>
      </View>
      {a.problem || note ? <Text style={[s.note, a.problem && { color: C.bad }]}>{a.problem || note}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  msg: { maxWidth: '84%', marginVertical: 5 },
  msgMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  whoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginHorizontal: 4 },
  who: { fontSize: 12.5, fontWeight: '600', color: C.ink3 },
  whoTag: { marginLeft: 6, fontSize: 11, fontWeight: '700', color: C.or, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bodyMine: { backgroundColor: C.ink, borderBottomRightRadius: 6 },
  bodyTheirs: { backgroundColor: C.grey, borderBottomLeftRadius: 6 },
  bodyPrivate: { backgroundColor: C.privateBg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#f0e2c4' },
  bodyText: { fontSize: 16, lineHeight: 22, color: C.ink },
  link: { textDecorationLine: 'underline' },
  fileLink: { fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 10, overflow: 'hidden' },
  when: { marginTop: 4, marginHorizontal: 4, fontSize: 12, color: C.ink3 },
  system: { alignSelf: 'center', textAlign: 'center', marginVertical: 10, paddingHorizontal: 24, fontSize: 13.5, lineHeight: 19, color: C.ink3 },
  files: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -3 },
  file: { margin: 3 },
  fileImg: { width: 92, height: 92, borderRadius: 12, backgroundColor: C.lineSoft },
  fileDoc: { width: 92, height: 92, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.lineSoft, alignItems: 'center', justifyContent: 'center' },
  fileDocText: { marginTop: 4, fontSize: 12, fontWeight: '600', color: C.ink2 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  tray: { marginBottom: 10 },
  tile: { width: 72, height: 72, borderRadius: 14, marginRight: 8, backgroundColor: C.grey, overflow: 'visible' },
  tileImg: { width: 72, height: 72, borderRadius: 14, backgroundColor: C.lineSoft },
  tileDoc: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 6, borderWidth: 1, borderColor: C.lineSoft },
  tileName: { marginTop: 3, fontSize: 10.5, color: C.ink2, textAlign: 'center' },
  tileX: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  bar: { flexDirection: 'row', alignItems: 'flex-end' },
  attach: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: C.grey },
  input: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 10 : 8, fontSize: 16, color: C.ink, backgroundColor: '#fff' },
  sendWrap: { marginLeft: 8 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 8, marginHorizontal: 4, fontSize: 13.5, lineHeight: 18, color: C.ink2 }
});
