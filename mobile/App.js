/* Kanvas One, the phone app.
 *
 * Native screens for everything a business does from their phone: Build
 * and requests (Kane), Analytics, Chat and contacts, Messages, Support and
 * the chat with Kane. Only the Dashboard tab is a web page, because it is
 * the customer's own site's dashboard. The screens call the same API as
 * kanvas.one/app, so the website and the app always agree.
 *
 * This file: the login, loading the account, push notifications (and where
 * a tapped one opens), and the app coming back to the front. The layout is
 * in src/navigation.js, the screens in src/screens.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { AppProvider, useApp } from './src/state/app';
import { MainNavigator } from './src/navigation';
import { nav } from './src/navRef';
import LoginScreen from './src/screens/LoginScreen';
import { Button } from './src/components/ui';
import { openLink, readLink, registerPush } from './src/lib/push';
import { bus } from './src/lib/bus';
import { noteDayOpened, openOutside } from './src/lib/phone';
import { C } from './src/theme';

const web = Platform.OS === 'web';
if (!web) {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  SplashScreen.setOptions({ fade: true, duration: 250 });
}
const hideSplash = () => { if (!web) SplashScreen.hideAsync().catch(() => {}); };

/* The app updates itself over the air: a new bundle is fetched quietly and
   used from the next launch, never swapped in under someone's thumb. */
async function fetchUpdate() {
  if (__DEV__ || web || !Updates.isEnabled) return;
  try { const u = await Updates.checkForUpdateAsync(); if (u.isAvailable) await Updates.fetchUpdateAsync(); } catch (e) { /* offline */ }
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#ffffff', primary: C.or, card: '#ffffff', text: C.ink, border: C.line } };

function Logo() {
  return <Text style={s.logo}>one<Text style={{ color: C.or }}>.</Text></Text>;
}

function Signed() {
  const app = useApp();
  const pending = useRef(null);
  const [ready, setReady] = useState(false);
  const appRef = useRef(app);
  appRef.current = app;

  const open = useCallback((data) => {
    if (!ready || !nav.isReady()) { pending.current = data; return; }
    openLink(nav, appRef.current, data);
  }, [ready]);

  /* Notifications: a tap opens what it is about; one arriving refreshes
     what is on screen. A button pressed on the notification the app was
     launched with more than two minutes ago is history, never redone. */
  useEffect(() => {
    if (web) return undefined;
    const respond = (r, fromLaunch) => {
      const content = r && r.notification && r.notification.request && r.notification.request.content;
      const data = Object.assign({}, content && content.data);
      const at = r && r.notification && r.notification.date;
      const stale = fromLaunch && (!at || Date.now() - at > 120000);
      const action = !stale && r && r.actionIdentifier && r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ? r.actionIdentifier : null;
      if (action) { data.action = action; if (r.userText) data.text = String(r.userText); }
      if (action === 'call' && data.phone) openOutside('tel:' + String(data.phone).replace(/[^\d+]/g, ''));
      if (action === 'email' && data.email) openOutside('mailto:' + data.email);
      if (fromLaunch && stale) return; // opened the app long ago; do not re-route every launch
      open(readLink(data));
    };
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => respond(r, false));
    const arrived = Notifications.addNotificationReceivedListener(() => { bus.emit('refresh'); appRef.current.refreshMe(); });
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r && r.notification) respond(r, true); }).catch(() => {});
    return () => { tapped.remove(); arrived.remove(); };
  }, [open]);

  useEffect(() => {
    const st = AppState.addEventListener('change', (v) => {
      if (v === 'active') { appRef.current.refreshMe(); bus.emit('refresh'); fetchUpdate(); }
    });
    fetchUpdate();
    noteDayOpened();
    return () => st.remove();
  }, []);

  /* Asked for once the account has loaded, not at launch: by then the
     person has seen what the app is for, which is what the stores want. */
  useEffect(() => {
    if (!app.me) return;
    registerPush().then((r) => bus.emit('push', r.note));
  }, [app.me ? app.me.user.id : null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (app.bootError && !app.me) {
    return (
      <View style={s.center}>
        <Logo />
        <Text style={s.errTitle}>Could not load your account</Text>
        <Text style={s.errText}>{app.bootError}</Text>
        <Button title="Try again" onPress={app.loadMe} style={{ marginTop: 22, alignSelf: 'center' }} />
        <Button title="Log out" kind="ghost" onPress={app.logOut} style={{ marginTop: 10, alignSelf: 'center' }} />
      </View>
    );
  }
  if (!app.me) {
    return <View style={s.center}><Logo /><ActivityIndicator color={C.ink} style={{ marginTop: 18 }} /></View>;
  }
  return (
    <NavigationContainer ref={nav} theme={theme} onReady={() => {
      hideSplash();
      setReady(true);
      if (pending.current) { const d = pending.current; pending.current = null; setTimeout(() => openLink(nav, appRef.current, d), 300); }
    }}>
      <MainNavigator key={app.user.id} />
    </NavigationContainer>
  );
}

function Root() {
  const { session } = useApp();
  useEffect(() => { if (session === null) hideSplash(); }, [session]);
  if (session === undefined) return <View style={s.center}><Logo /></View>;
  if (!session) return <LoginScreen />;
  return <Signed />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 34, fontWeight: '700', letterSpacing: -1.4, color: C.ink },
  errTitle: { marginTop: 26, fontSize: 20, fontWeight: '600', color: C.ink, textAlign: 'center' },
  errText: { marginTop: 6, fontSize: 15, color: C.ink2, textAlign: 'center' }
});
