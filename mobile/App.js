/* Kanvas One, the phone app.
 *
 * A thin native shell around the web app at kanvas.one/app: a full-screen
 * WebView, push notifications through Expo, and a bridge between the two.
 * Everything the customer or the admin sees (log in, Analytics, Chat,
 * Support, Dashboard) is the web app itself, so a fix on the site is a fix
 * in the app the next time it opens.
 *
 * The bridge, both ways:
 *   web -> native  window.ReactNativeWebView.postMessage(JSON)
 *     { type: 'ready' }              the web app has booted; flush deep links
 *     { type: 'push:register' }      ask for permission, send the token back
 *     { type: 'open', url }          open a link outside the app
 *   native -> web  window.ONE_NATIVE.<fn>(...) injected into the page
 *     onPushToken(token) / onPushDenied(reason)
 *     openLink(data)                 a notification was tapped
 *     refresh()                      a notification arrived, or app resumed
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

const APP_URL = 'https://kanvas.one/app/';
const OUR_HOST = /(^|\.)kanvas\.one$/i;
const APP_VERSION = (Constants.expoConfig && Constants.expoConfig.version) || '1.0.0';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 250 });

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true })
});

/* Permission, then the Expo push token for this install. The server keys
   its device_tokens rows on this string and sends through Expo's push
   service, which carries it on to APNs / FCM. */
async function registerForPush() {
  if (!Device.isDevice) return { error: 'simulator' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('one', { name: 'Kanvas One', importance: Notifications.AndroidImportance.MAX, sound: 'default' });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return { error: 'denied' };
  const projectId = (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId)
    || (Constants.easConfig && Constants.easConfig.projectId);
  try {
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return { token: t.data };
  } catch (err) {
    return { error: 'failed', message: String(err && err.message || err) };
  }
}

function hostOf(url) {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(String(url || ''));
  return m ? m[1] : '';
}

/* Links that leave the app open in the system browser (an in-app Safari
   sheet on iOS), not inside the WebView, so the app never turns into a
   browser with no way back. tel:, mailto: and sms: go to the phone. */
async function openOutside(url) {
  if (/^(tel|mailto|sms|whatsapp):/i.test(url)) { try { await Linking.openURL(url); } catch (e) { /* nothing to open it */ } return; }
  if (/^https?:/i.test(url)) { try { await WebBrowser.openBrowserAsync(url); } catch (e) { try { await Linking.openURL(url); } catch (e2) { /* ignore */ } } }
}

function Shell() {
  const insets = useSafeAreaInsets();
  const web = useRef(null);
  const ready = useRef(false);
  const pendingLink = useRef(null);
  const [failed, setFailed] = useState(null);
  const [loading, setLoading] = useState(true);

  const inject = useCallback((js) => {
    if (web.current) web.current.injectJavaScript(js + '; true;');
  }, []);

  const call = useCallback((fn, arg) => {
    inject('window.ONE_NATIVE && typeof ONE_NATIVE.' + fn + ' === "function" && ONE_NATIVE.' + fn + '(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')');
  }, [inject]);

  /* A tapped notification: hand its data to the web app, or hold it until
     the web app says it is ready (a cold start). */
  const openLink = useCallback((data) => {
    if (!data) return;
    if (ready.current) call('openLink', data); else pendingLink.current = data;
  }, [call]);

  useEffect(() => {
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      openLink(r && r.notification && r.notification.request && r.notification.request.content && r.notification.request.content.data);
    });
    const arrived = Notifications.addNotificationReceivedListener(() => { if (ready.current) call('refresh'); });
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r && r.notification) openLink(r.notification.request.content.data);
    }).catch(() => {});
    const state = AppState.addEventListener('change', (s) => {
      if (s === 'active') { Notifications.setBadgeCountAsync(0).catch(() => {}); if (ready.current) call('refresh'); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (web.current) { web.current.goBack(); return true; }
      return false;
    });
    return () => { tapped.remove(); arrived.remove(); state.remove(); back.remove(); };
  }, [call, openLink]);

  const onMessage = useCallback(async (e) => {
    let msg = null;
    try { msg = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'ready') {
      ready.current = true;
      SplashScreen.hideAsync().catch(() => {});
      setLoading(false);
      if (pendingLink.current) { const l = pendingLink.current; pendingLink.current = null; call('openLink', l); }
    } else if (msg.type === 'push:register') {
      const r = await registerForPush();
      if (r.token) call('onPushToken', r.token); else call('onPushDenied', r.error);
    } else if (msg.type === 'open' && msg.url) {
      openOutside(String(msg.url));
    }
  }, [call]);

  /* Which navigations stay inside the app. Our own host: yes. A frame
     inside the page (the customer's dashboard): yes. Anything else that
     would take over the whole WebView: open it outside instead. */
  const shouldStart = useCallback((req) => {
    const url = String(req.url || '');
    if (/^(tel|mailto|sms|whatsapp):/i.test(url)) { openOutside(url); return false; }
    if (/^about:/i.test(url)) return true;
    if (!/^https?:/i.test(url)) return false;
    if (OUR_HOST.test(hostOf(url))) return true;
    if (req.isTopFrame === false) return true;
    if (Platform.OS === 'android' && req.isTopFrame === undefined && req.navigationType !== 'click') return true;
    openOutside(url);
    return false;
  }, []);

  const onLoadEnd = useCallback(() => {
    // The web app posts 'ready' once it has booted and fetched the account,
    // and the native splash stays up until then, so there is one splash,
    // not two. This is only the fallback for a page that never says so.
    setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); setLoading(false); }, 8000);
  }, []);

  const onError = useCallback((e) => {
    const d = e && e.nativeEvent;
    setFailed((d && d.description) || 'No connection.');
    SplashScreen.hideAsync().catch(() => {});
    setLoading(false);
  }, []);

  const retry = useCallback(() => { setFailed(null); setLoading(true); ready.current = false; if (web.current) web.current.reload(); }, []);

  // iOS lets the page read the safe areas itself (env(safe-area-inset-*)),
  // and the web app is built for that. Android does not, so pad it here.
  const pad = Platform.OS === 'android' ? { paddingTop: insets.top, paddingBottom: insets.bottom } : null;

  return (
    <View style={[styles.root, pad]}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      {failed ? (
        <View style={styles.offline}>
          <Text style={styles.logo}>one.</Text>
          <Text style={styles.offlineTitle}>Can&rsquo;t reach kanvas.one</Text>
          <Text style={styles.offlineText}>Check you&rsquo;re online and try again.</Text>
          <Pressable onPress={retry} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} accessibilityRole="button">
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: APP_URL }}
        style={[styles.web, failed && styles.hidden]}
        originWhitelist={['https://*', 'http://*', 'about:*']}
        injectedJavaScriptBeforeContentLoaded={
          'window.ONE_NATIVE_PLATFORM=' + JSON.stringify(Platform.OS) + ';window.ONE_APP_VERSION=' + JSON.stringify(APP_VERSION) + ';true;'
        }
        onMessage={onMessage}
        onShouldStartLoadWithRequest={shouldStart}
        onOpenWindow={(e) => { const u = e && e.nativeEvent && e.nativeEvent.targetUrl; if (u) openOutside(String(u)); }}
        setSupportMultipleWindows={false}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={(e) => { const s = e && e.nativeEvent && e.nativeEvent.statusCode; const top = e && e.nativeEvent && e.nativeEvent.url; if (s >= 500 && top && top.indexOf(APP_URL) === 0) onError({ nativeEvent: { description: 'kanvas.one is not responding (' + s + ').' } }); }}
        applicationNameForUserAgent={'KanvasOne/' + APP_VERSION}
        contentInsetAdjustmentBehavior="never"
        allowsBackForwardNavigationGestures={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        keyboardDisplayRequiresUserAction={false}
        pullToRefreshEnabled={false}
        bounces={false}
        overScrollMode="never"
        textZoom={100}
        allowsLinkPreview={false}
        startInLoadingState={false}
        cacheEnabled
      />
      {loading && !failed ? (
        <View style={styles.loading} pointerEvents="none">
          <Text style={styles.logo}>one.</Text>
          <ActivityIndicator color="#1d1d1f" style={styles.spinner} />
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  web: { flex: 1, backgroundColor: '#ffffff' },
  hidden: { flex: 0, height: 0, opacity: 0 },
  loading: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  spinner: { marginTop: 18 },
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#ffffff' },
  logo: { fontSize: 34, fontWeight: '700', letterSpacing: -1.4, color: '#1d1d1f' },
  offlineTitle: { marginTop: 26, fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: '#1d1d1f' },
  offlineText: { marginTop: 6, fontSize: 15, color: '#6e6e73', textAlign: 'center' },
  btn: { marginTop: 22, backgroundColor: '#1d1d1f', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 980 },
  btnPressed: { opacity: 0.75 },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' }
});
