/* The account sheet: who is signed in, whether notifications are on for
   this phone, share the website, log out, the policies, and deleting the
   account (both app stores require it inside the app). */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Button, Note } from '../components/ui';
import Press from '../components/Press';
import { confirm } from '../components/chat';
import { useApp } from '../state/app';
import { api } from '../lib/api';
import { bus } from '../lib/bus';
import { pushNote, pushToken } from '../lib/push';
import { openOutside, share } from '../lib/phone';
import { C, R } from '../theme';

export default function AccountScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [push, setPush] = useState(pushNote());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: '' });
  const site = app.site;
  useEffect(() => bus.on('push', setPush), []);

  const logOut = async () => {
    setBusy(true);
    try { if (pushToken()) await api({ action: 'device_remove', token: pushToken() }); } catch (e) { /* the row expires on its own */ }
    await app.logOut();
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete your account?', body: 'Your login, your site’s records, requests and chats are removed for good, and any plan is cancelled. This cannot be undone.', ok: 'Delete', danger: true }))) return;
    if (!(await confirm({ title: 'Last check', body: 'Delete the account for ' + ((app.user && app.user.email) || 'this login') + '?', ok: 'Delete for good', danger: true }))) return;
    setNote({ text: 'Deleting…' });
    try { await api({ action: 'delete_account' }); await app.logOut(); }
    catch (e) { setNote({ text: e.message, bad: true }); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]}>
      <Text style={s.title}>Account</Text>
      <View style={s.card}>
        <Text style={s.email}>{(app.user && app.user.email) || ''}</Text>
        {site ? <Text style={s.site}>{site.name}</Text> : null}
        <Text style={s.push}>{push || 'Checking notifications…'}</Text>
      </View>
      {site && site.url ? <Button title="Share your website" kind="ghost" icon="share" onPress={() => share((site.name ? site.name + ': ' : '') + 'have a look at our website', site.url)} style={{ marginTop: 14 }} /> : null}
      <Button title="Log out" kind="dark" onPress={logOut} busy={busy} style={{ marginTop: 10 }} />
      <View style={s.legal}>
        <Text style={s.link} onPress={() => openOutside('https://kanvas.one/privacy')}>Privacy policy</Text>
        <Text style={s.dot}> · </Text>
        <Text style={s.link} onPress={() => openOutside('https://kanvas.one/terms')}>Terms</Text>
        <Text style={s.dot}> · </Text>
        <Text style={s.link} onPress={() => openOutside('mailto:support@kanvas.one')}>Contact support</Text>
      </View>
      {!app.isAdmin ? (
        <View style={s.foot}>
          <Press onPress={del} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}><Text style={s.del}>Delete my account</Text></Press>
          <Text style={s.footText}>Removes your login, your site’s records, requests and chats for good, and cancels any plan. Billing records stay with Stripe as the law requires.</Text>
          <Note {...note} />
        </View>
      ) : null}
      <Text style={s.version}>{'Kanvas One ' + ((Constants.expoConfig && Constants.expoConfig.version) || '')}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingTop: 26 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: C.ink },
  card: { marginTop: 16, backgroundColor: C.night, borderRadius: R.cardLg, padding: 18 },
  email: { fontSize: 17, fontWeight: '600', color: C.onNight },
  site: { marginTop: 3, fontSize: 14.5, color: C.onNight2 },
  push: { marginTop: 12, fontSize: 14, lineHeight: 19, color: C.orLight },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 22 },
  link: { fontSize: 14, color: C.ink2, textDecorationLine: 'underline' },
  dot: { fontSize: 14, color: C.ink3 },
  foot: { marginTop: 30, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  del: { fontSize: 15.5, fontWeight: '600', color: C.bad },
  footText: { marginTop: 4, fontSize: 13.5, lineHeight: 19, color: C.ink3 },
  version: { marginTop: 26, textAlign: 'center', fontSize: 12.5, color: C.ink3 }
});
