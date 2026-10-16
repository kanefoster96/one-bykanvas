/* Their business: the logo and the name the app shows at the top. Tap
 * the logo to pick a new one (cropped square, shown as a circle), change
 * the name, Save. It saves to their account straight away and sends Kane
 * a request with the new logo attached, so the website changes too. */
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Button, Field, Note } from '../components/ui';
import Press from '../components/Press';
import Icon from '../components/Icon';
import { useApp } from '../state/app';
import { db } from '../lib/supabase';
import { requests as post, uploadFiles, uploadOne } from '../lib/api';
import { brandFor } from '../lib/brand';
import { haptic } from '../lib/phone';
import { initials } from '../lib/format';
import { C } from '../theme';

export default function ProfileScreen({ navigation }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const brand = brandFor(app);
  const [name, setName] = useState(brand.name);
  const [pick, setPick] = useState(null); // a new logo, picked but not saved
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: '' });

  const choose = async () => {
    setNote({ text: '' });
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, exif: false });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const a = res.assets[0];
      haptic.light();
      setPick({ uri: a.uri, file: a.file, type: a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg', name: a.mimeType === 'image/png' ? 'logo.png' : 'logo.jpg', size: a.fileSize });
    } catch (e) { setNote({ text: 'Could not open your photos.', bad: true }); }
  };

  const nameChanged = name.trim() && name.trim() !== brand.name;
  const save = async () => {
    if (!nameChanged && !pick) { navigation.goBack(); return; }
    if (!name.trim()) { setNote({ text: 'Your business needs a name.', bad: true }); return; }
    if (pick && pick.size && pick.size > 2 * 1024 * 1024) { setNote({ text: 'That picture is too big. Try a smaller one (under 2 MB).', bad: true }); return; }
    setBusy(true); setNote({ text: 'Saving…' });
    try {
      const uid = app.user.id;
      const row = {};
      if (pick) {
        const path = uid + '/logo.' + (pick.type === 'image/png' ? 'png' : 'jpg');
        await uploadOne('avatars', path, pick);
        if (brand.path && brand.path !== path && brand.path.indexOf(uid + '/') === 0) await db.storage.from('avatars').remove([brand.path]).catch(() => {});
        row.avatar_path = path;
      }
      if (nameChanged) row.business_name = name.trim();
      const up = await db.from('profiles').update(row).eq('id', uid);
      if (up.error) throw up.error;
      app.patchUser(Object.assign({}, row.business_name ? { business_name: row.business_name } : {}, row.avatar_path ? { logo_path: row.avatar_path } : {}));
      if (pick) app.bumpLogo();

      /* Kane updates the website from this: what changed, the logo attached. */
      const bits = [];
      if (nameChanged) bits.push('Please change my business name on the website to "' + name.trim() + '" (it was "' + brand.name + '").');
      if (pick) bits.push('Please use my new logo on the website. It is attached.');
      const files = pick ? await uploadFiles(uid, [pick]) : [];
      await post({ action: 'create', kind: 'edit', title: nameChanged && pick ? 'New business name and logo' : nameChanged ? 'New business name' : 'New logo', body: bits.join('\n\n'), attachmentPaths: files });

      haptic.success();
      setNote({ text: 'Saved. Kane has it and will update your website too.', ok: true });
      setTimeout(() => navigation.goBack(), 1200);
    } catch (e) { setNote({ text: e.message || 'Could not save that. Try again.', bad: true }); haptic.error(); setBusy(false); }
  };

  const shown = pick ? pick.uri : brand.logo;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Your business</Text>
        <Press onPress={choose} style={s.logoWrap} scale={0.95} accessibilityLabel="Change your logo" testID="pickLogo">
          {shown ? <Image source={{ uri: shown }} style={s.logo} /> : (
            <View style={[s.logo, s.logoNone]}><Text style={s.logoText}>{initials(name || brand.name)}</Text></View>
          )}
          <View style={s.cam}><Icon name="photo" size={16} color="#fff" stroke={2} /></View>
        </Press>
        <Text style={s.change} onPress={choose}>{shown ? 'Change logo' : 'Add your logo'}</Text>
        <Field label="Business name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" style={{ marginTop: 24 }} testID="bizName" />
        <Text style={s.hint}>This is the name and logo at the top of your app. Saving sends Kane the change too, so your website is updated to match.</Text>
        <Button title="Save" onPress={save} busy={busy} style={{ marginTop: 20 }} testID="saveProfile" />
        <Note {...note} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingTop: 26 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: C.ink },
  logoWrap: { alignSelf: 'center', marginTop: 26 },
  logo: { width: 112, height: 112, borderRadius: 56, backgroundColor: C.grey },
  logoNone: { backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '700' },
  cam: { position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: C.or, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  change: { alignSelf: 'center', marginTop: 12, fontSize: 15.5, fontWeight: '600', color: C.or },
  hint: { marginTop: 10, fontSize: 14, lineHeight: 19, color: C.ink2 }
});
