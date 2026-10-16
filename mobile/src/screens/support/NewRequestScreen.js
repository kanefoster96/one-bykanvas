/* A new request: add a feature (pick one from the catalogue, then the one
 * thing we need to set it up) or change something on the site. Photos can
 * go with it. Starter in the app asks for changes only: App Store rules
 * allow no call to buy outside the app, and features are part of Business.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button, Note, Segmented, animateNext, FadeIn } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { AttachTray, useAttach } from '../../components/chat';
import { useApp } from '../../state/app';
import { requests as post, uploadFiles } from '../../lib/api';
import { myPlan } from '../../lib/requests';
import { CATALOGUE } from '../../lib/shared.generated';
import { haptic } from '../../lib/phone';
import { C, H, R } from '../../theme';

export default function NewRequestScreen({ navigation, route }) {
  const { user } = useApp();
  const [plan, setPlan] = useState(null);
  const [mode, setMode] = useState((route.params && route.params.mode) || 'feature');
  const [picked, setPicked] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: '' });
  const a = useAttach(5);
  const headerH = useHeaderHeight();

  useEffect(() => { myPlan(user.id).then((p) => { setPlan(p); if (p === 'starter') setMode('edit'); }).catch(() => {}); }, [user.id]);
  const starter = plan === 'starter';
  const showForm = mode === 'edit' || picked;

  const send = async () => {
    const words = body.trim();
    if (words.length < 10) { setNote({ text: 'A sentence is plenty, but tell us a little more than that.', bad: true }); haptic.warning(); return; }
    setBusy(true);
    try {
      let paths = [];
      if (a.files.length) { setNote({ text: 'Uploading photos…' }); paths = await uploadFiles(user.id, a.files); }
      setNote({ text: 'Sending…' });
      const data = await post({ action: 'create', kind: mode === 'feature' ? 'feature' : 'edit', title: picked && picked.key !== 'other' ? picked.title : '', body: words, attachmentPaths: paths });
      haptic.success();
     
      navigation.replace('Request', { id: data.request.id });
    } catch (e) { setNote({ text: e.message, bad: true }); haptic.error(); setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? headerH : 0}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!starter ? (
          <Segmented stretch value={mode} onChange={(v) => { animateNext(); setMode(v); setPicked(null); }} options={[{ value: 'feature', label: 'Add a feature' }, { value: 'edit', label: 'Change something' }]} />
        ) : null}
        {starter ? <Text style={s.starterNote}>Starter includes unlimited edits to what’s already on your site: photos, words, prices, opening hours and links.</Text> : null}

        {mode === 'feature' && !picked ? (
          <View style={{ marginTop: 14 }}>
            {CATALOGUE.map((item, i) => (
              <FadeIn key={item.key} delay={Math.min(i, 8) * 25}>
                <Press onPress={() => { animateNext(); setPicked(item); }} style={s.cat} scale={0.985}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.catTitle}>{item.title}</Text>
                    <Text style={s.catLine}>{item.line}</Text>
                  </View>
                  <Icon name="chevron" size={18} color={C.ink3} />
                </Press>
              </FadeIn>
            ))}
          </View>
        ) : null}

        {showForm ? (
          <FadeIn style={{ marginTop: 18 }}>
            {picked ? (
              <View style={s.picked}>
                <Text style={s.pickedTitle}>{picked.key === 'other' ? 'Something else' : picked.title}</Text>
                <Text style={s.change} onPress={() => { animateNext(); setPicked(null); }}>Change</Text>
              </View>
            ) : null}
            <Text style={s.label}>{mode === 'edit' ? 'What would you like changed?' : picked.key === 'other' ? 'What would you like?' : 'Tell us the one thing we need to set it up'}</Text>
            <TextInput value={body} onChangeText={setBody} multiline maxLength={4000} autoFocus
              placeholder={mode === 'edit' ? 'Swap the photo on the homepage for the new shopfront one.' : picked.eg} placeholderTextColor={C.ink3} style={s.field} testID="newBody" />
            <AttachTray files={a.files} onRemove={a.remove} busy={busy} style={{ marginTop: 12 }} />
            <Note text={a.problem} bad />
            <View style={s.sendRow}>
              <Button title="Add photos" kind="ghost" icon="photo" onPress={a.attach} disabled={busy} style={{ flex: 1, marginRight: 10 }} />
              <Button title="Send request" onPress={send} busy={busy} style={{ flex: 1 }} testID="sendRequest" />
            </View>
            <Note {...note} />
          </FadeIn>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  starterNote: { fontSize: 15, lineHeight: 21, color: C.ink2, backgroundColor: C.grey, borderRadius: R.card, padding: 14 },
  cat: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  catTitle: { fontSize: 16.5, fontWeight: '600', color: C.ink },
  catLine: { marginTop: 3, fontSize: 14, lineHeight: 19, color: C.ink2, marginRight: 8 },
  picked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.night, borderRadius: R.card, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  pickedTitle: { fontSize: 17, fontWeight: '600', color: C.onNight },
  change: { fontSize: 15, fontWeight: '600', color: C.orLight },
  label: { fontSize: 15.5, fontWeight: '600', color: C.ink, marginBottom: 8 },
  field: { minHeight: 140, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, fontSize: 16.5, lineHeight: 22, color: C.ink, textAlignVertical: 'top' },
  sendRow: { flexDirection: 'row', marginTop: 16, minHeight: H.btn }
});
