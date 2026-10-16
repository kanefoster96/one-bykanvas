/* Log in with the Kanvas One email and password. */
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, FadeIn, Note } from '../components/ui';
import Press from '../components/Press';
import { db, friendlyError } from '../lib/supabase';
import { haptic, openOutside } from '../lib/phone';
import { C } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const pwRef = useRef(null);

  const go = async () => {
    const e = email.trim();
    if (!e || !pw) { setNote('Email and password, please.'); haptic.warning(); return; }
    setBusy(true); setNote('');
    const res = await db.auth.signInWithPassword({ email: e, password: pw }).catch((err) => ({ error: err }));
    if (res.error) { setNote(friendlyError(res.error)); haptic.error(); setBusy(false); return; }
    haptic.success();
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <Text style={s.logo}>one<Text style={{ color: C.or }}>.</Text></Text>
            <Text style={s.h1}>Log in</Text>
            <Text style={s.hint}>The same email and password as your Kanvas One account.</Text>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
              textContentType="username" returnKeyType="next" onSubmitEditing={() => pwRef.current && pwRef.current.focus()} style={{ marginTop: 28 }} testID="loginEmail" />
            <Field label="Password" ref={pwRef} value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password"
              textContentType="password" returnKeyType="go" onSubmitEditing={go} style={{ marginTop: 16 }} testID="loginPassword" />
            <Button title="Log in" onPress={go} busy={busy} style={{ marginTop: 24 }} testID="loginBtn" />
            <Note text={note} bad />
            <Press onPress={() => openOutside('https://kanvas.one/reset.html')} style={s.link}><Text style={s.linkText}>Forgotten your password?</Text></Press>
          </FadeIn>
        </ScrollView>
        <View style={s.legal}>
          <Text style={s.legalText} onPress={() => openOutside('https://kanvas.one/privacy')}>Privacy policy</Text>
          <Text style={s.legalText}> · </Text>
          <Text style={s.legalText} onPress={() => openOutside('https://kanvas.one/terms')}>Terms</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  body: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 40, fontWeight: '700', letterSpacing: -1.6, color: C.ink },
  h1: { marginTop: 30, fontSize: 30, fontWeight: '700', letterSpacing: -0.7, color: C.ink },
  hint: { marginTop: 6, fontSize: 15.5, lineHeight: 21, color: C.ink2 },
  link: { marginTop: 22, alignSelf: 'center', padding: 6 },
  linkText: { fontSize: 15, color: C.ink, fontWeight: '500', textDecorationLine: 'underline' },
  legal: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 14 },
  legalText: { fontSize: 13.5, color: C.ink3 }
});
