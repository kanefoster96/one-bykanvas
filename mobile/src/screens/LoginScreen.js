/* Log in with the Kanvas One email and password. Forgotten passwords are
   asked for here too: the reset link goes to their email, and opening it
   is what lets them choose a new one (on kanvas.one). */
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
  const [resetting, setResetting] = useState(false);
  const [sent, setSent] = useState('');
  const pwRef = useRef(null);

  const sendReset = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setNote('That does not look like an email address.'); haptic.warning(); return; }
    setBusy(true); setNote('');
    const res = await db.auth.resetPasswordForEmail(e, { redirectTo: 'https://kanvas.one/reset.html' }).catch((err) => ({ error: err }));
    setBusy(false);
    if (res.error) { setNote(friendlyError(res.error)); haptic.error(); return; }
    haptic.success();
    // Never says whether the address has an account (that would let anyone test addresses).
    setSent('If ' + e + ' has an account, a reset link is on its way. Open it on this phone or any other; it works once and expires in 24 hours.');
  };
  const mode = (next) => { setResetting(next); setNote(''); setSent(''); };

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
            <Text style={s.h1}>{resetting ? 'Reset your password' : 'Log in'}</Text>
            <Text style={s.hint}>{resetting ? 'We’ll email you a link to choose a new one.' : 'The same email and password as your Kanvas One account.'}</Text>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
              textContentType="username" returnKeyType={resetting ? 'send' : 'next'} onSubmitEditing={() => (resetting ? sendReset() : pwRef.current && pwRef.current.focus())} style={{ marginTop: 28 }} testID="loginEmail" />
            {resetting ? (
              <>
                {sent ? <Text style={s.sent}>{sent}</Text> : <Button title="Email me a reset link" onPress={sendReset} busy={busy} style={{ marginTop: 24 }} testID="resetBtn" />}
                <Note text={note} bad />
                <Press onPress={() => mode(false)} style={s.link}><Text style={s.linkText}>Back to log in</Text></Press>
              </>
            ) : (
              <>
                <Field label="Password" ref={pwRef} value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password"
                  textContentType="password" returnKeyType="go" onSubmitEditing={go} style={{ marginTop: 16 }} testID="loginPassword" />
                <Button title="Log in" onPress={go} busy={busy} style={{ marginTop: 24 }} testID="loginBtn" />
                <Note text={note} bad />
                <Press onPress={() => mode(true)} style={s.link} testID="forgotLink"><Text style={s.linkText}>Forgotten your password?</Text></Press>
              </>
            )}
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
  sent: { marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: C.grey, fontSize: 15, lineHeight: 21, color: C.ink },
  link: { marginTop: 22, alignSelf: 'center', padding: 6 },
  linkText: { fontSize: 15, color: C.ink, fontWeight: '500', textDecorationLine: 'underline' },
  legal: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 14 },
  legalText: { fontSize: 13.5, color: C.ink3 }
});
