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
 *     { type: 'badge', count }       the number on the app icon
 *     { type: 'haptic', style }      'light' | 'medium' | 'success' | 'warning' | 'error'
 *     { type: 'share', message, url } the phone's share sheet
 *     { type: 'review' }             ask for an App Store / Play rating (the OS decides if it shows)
 *     { type: 'scan', id }           full-screen QR scanner; answers onScan({ id, data } | { id, error })
 *     { type: 'calendar', id, title, start, end, location, notes }
 *                                    the phone's own "add event" sheet; answers onCalendar({ id, saved })
 *   native -> web  window.ONE_NATIVE.<fn>(...) injected into the page
 *     onPushToken(token) / onPushDenied(reason)
 *     openLink(data)                 a notification was tapped; data.action / data.text
 *                                    when a button on it was used (Call, Email, Reply)
 *     refresh()                      a notification arrived, or app resumed
 *     onScan(result) / onCalendar(result)
 *
 * What this build can do is announced before the page loads, as
 * window.ONE_NATIVE_FEATURES, so the web app only offers what is there and
 * an older install simply never sees a button it cannot honour.
 *
 * Coming back to the app: iOS may have killed the WebView's page while the
 * app sat in the background, which leaves a white screen until a restart.
 * So on every return the page is asked to answer ('alive'); if the page
 * process is gone, or it answers that it is blank, it is reloaded. iOS and
 * Android both also say outright when the page process dies, and that
 * reloads it too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import * as Calendar from 'expo-calendar/legacy';
import * as Updates from 'expo-updates';
import { CameraView, Camera } from 'expo-camera';

const APP_URL = 'https://kanvas.one/app/';
const OUR_HOST = /(^|\.)kanvas\.one$/i;
const APP_VERSION = (Constants.expoConfig && Constants.expoConfig.version) || '1.0.0';
/* What this build can do, told to the page before it loads. */
const FEATURES = ['badge', 'haptic', 'share', 'review', 'scan', 'calendar', 'actions', 'links', 'updates'];

/* Buttons on a notification, by the category the server sends with it.
   Each opens the app, which then does the thing: a call or an email
   straight from here, a typed reply through the web app (it holds the
   login). */
async function setNotificationActions() {
  try {
    await Notifications.setNotificationCategoryAsync('enquiry', [
      { identifier: 'call', buttonTitle: 'Call', options: { opensAppToForeground: true } },
      { identifier: 'email', buttonTitle: 'Email', options: { opensAppToForeground: true } }
    ]);
    await Notifications.setNotificationCategoryAsync('chat', [
      { identifier: 'reply', buttonTitle: 'Reply', textInput: { submitButtonTitle: 'Send', placeholder: 'Your reply' }, options: { opensAppToForeground: true } }
    ]);
    await Notifications.setNotificationCategoryAsync('missed_call', [
      { identifier: 'call', buttonTitle: 'Call back', options: { opensAppToForeground: true } }
    ]);
  } catch (e) { /* buttons are a nicety; the tap still works */ }
}
setNotificationActions();

/* The wrapper itself updates over the air: a new bundle is fetched quietly
   and used from the next launch, never swapped in under someone's thumb. */
async function fetchWrapperUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const u = await Updates.checkForUpdateAsync();
    if (u.isAvailable) await Updates.fetchUpdateAsync();
  } catch (e) { /* offline, or nothing new */ }
}

/* A kanvas.one/app link (an email, a text) opens here, in the app. */
function appLink(url) {
  return /^https:\/\/(www\.)?kanvas\.one\/app(\/|\?|#|$)/i.test(String(url || '')) ? String(url) : null;
}

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
  const aliveAt = useRef(0);
  const aliveTimer = useRef(null);
  const [startUrl, setStartUrl] = useState(APP_URL);
  const [scan, setScan] = useState(null);       // { id } while the scanner is open
  const scanned = useRef(false);

  const inject = useCallback((js) => {
    if (web.current) web.current.injectJavaScript(js + '; true;');
  }, []);

  const call = useCallback((fn, arg) => {
    inject('window.ONE_NATIVE && typeof ONE_NATIVE.' + fn + ' === "function" && ONE_NATIVE.' + fn + '(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')');
  }, [inject]);

  /* The page is gone or blank: load it again, behind the splash. */
  const reloadPage = useCallback(() => {
    ready.current = false;
    setFailed(null);
    setLoading(true);
    if (web.current) web.current.reload();
  }, []);

  /* Back in the app: is the page still there? A page whose process iOS
     killed cannot answer, so no answer within a few seconds means reload. */
  const checkAlive = useCallback(() => {
    if (!ready.current) return;
    const asked = Date.now();
    clearTimeout(aliveTimer.current);
    inject("window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'alive', blank: !(document.body && document.body.children.length && (document.body.innerText || '').trim()) }))");
    aliveTimer.current = setTimeout(() => { if (aliveAt.current < asked) reloadPage(); }, 3500);
  }, [inject, reloadPage]);

  /* A tapped notification: hand its data to the web app, or hold it until
     the web app says it is ready (a cold start). */
  const openLink = useCallback((data) => {
    if (!data) return;
    if (ready.current) call('openLink', data); else pendingLink.current = data;
  }, [call]);

  useEffect(() => {
    /* fromLaunch: the response the app was opened with, which the phone
       keeps handing back on later launches too. A button pressed on it more
       than two minutes ago is history: never dial, email or send it again. */
    const respond = (r, fromLaunch) => {
      const data = Object.assign({}, r && r.notification && r.notification.request && r.notification.request.content && r.notification.request.content.data);
      const at = r && r.notification && r.notification.date;
      const stale = fromLaunch && (!at || Date.now() - at > 120000);
      const action = !stale && r && r.actionIdentifier && r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ? r.actionIdentifier : null;
      if (action) { data.action = action; if (r.userText) data.text = String(r.userText); }
      // Call and Email go straight to the phone; the app still opens on the record.
      if (action === 'call' && data.phone) openOutside('tel:' + String(data.phone).replace(/[^\d+]/g, ''));
      if (action === 'email' && data.email) openOutside('mailto:' + data.email);
      openLink(data);
    };
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => respond(r, false));
    const arrived = Notifications.addNotificationReceivedListener(() => { if (ready.current) call('refresh'); });
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r && r.notification) respond(r, true);
    }).catch(() => {});
    // Opened from a kanvas.one/app link: start there. Already open: go there.
    Linking.getInitialURL().then((u) => { const a = appLink(u); if (a) setStartUrl(a); }).catch(() => {});
    const linked = Linking.addEventListener('url', (ev) => {
      const a = appLink(ev && ev.url);
      if (a) inject('window.location.href = ' + JSON.stringify(a));
    });
    fetchWrapperUpdate();
    const state = AppState.addEventListener('change', (s) => {
      // The page sets the icon's number itself (the badge message) once it has asked what is unread.
      if (s === 'active') { checkAlive(); if (ready.current) call('refresh'); fetchWrapperUpdate(); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (web.current) { web.current.goBack(); return true; }
      return false;
    });
    return () => { tapped.remove(); arrived.remove(); state.remove(); back.remove(); linked.remove(); clearTimeout(aliveTimer.current); };
  }, [call, inject, openLink, checkAlive]);

  const onMessage = useCallback(async (e) => {
    let msg = null;
    try { msg = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'alive') {
      if (msg.blank) reloadPage(); else aliveAt.current = Date.now();
    } else if (msg.type === 'ready') {
      ready.current = true;
      SplashScreen.hideAsync().catch(() => {});
      setLoading(false);
      if (pendingLink.current) { const l = pendingLink.current; pendingLink.current = null; call('openLink', l); }
    } else if (msg.type === 'push:register') {
      const r = await registerForPush();
      if (r.token) call('onPushToken', r.token); else call('onPushDenied', r.error);
    } else if (msg.type === 'open' && msg.url) {
      openOutside(String(msg.url));
    } else if (msg.type === 'badge') {
      Notifications.setBadgeCountAsync(Math.max(0, Number(msg.count) || 0)).catch(() => {});
    } else if (msg.type === 'haptic') {
      const st = String(msg.style || 'light');
      if (st === 'success' || st === 'warning' || st === 'error') {
        Haptics.notificationAsync(st === 'success' ? Haptics.NotificationFeedbackType.Success : st === 'warning' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        Haptics.impactAsync(st === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } else if (msg.type === 'share') {
      const message = String(msg.message || ''), url = msg.url ? String(msg.url) : '';
      // iOS shows url as its own item; Android only reads message, so it carries the link too.
      Share.share(Platform.OS === 'ios' ? { message, url: url || undefined } : { message: [message, url].filter(Boolean).join(' ') }).catch(() => {});
    } else if (msg.type === 'review') {
      try { if (await StoreReview.isAvailableAsync() && await StoreReview.hasAction()) await StoreReview.requestReview(); } catch (err) { /* the OS said no */ }
    } else if (msg.type === 'scan') {
      const id = msg.id || null;
      let perm = null;
      try { perm = await Camera.requestCameraPermissionsAsync(); } catch (err) { perm = null; }
      if (!perm || !perm.granted) { call('onScan', { id, error: 'denied' }); return; }
      scanned.current = false;
      setScan({ id });
    } else if (msg.type === 'calendar') {
      const id = msg.id || null;
      const start = new Date(msg.start), end = msg.end ? new Date(msg.end) : new Date(start.getTime() + 60 * 60000);
      if (isNaN(start)) { call('onCalendar', { id, saved: false, error: 'bad date' }); return; }
      try {
        const res = await Calendar.createEventInCalendarAsync({ title: String(msg.title || 'Booking'), startDate: start, endDate: end, location: msg.location ? String(msg.location) : undefined, notes: msg.notes ? String(msg.notes) : undefined });
        call('onCalendar', { id, saved: !!(res && res.action === 'saved') });
      } catch (err) { call('onCalendar', { id, saved: false, error: String(err && err.message || err) }); }
    }
  }, [call, reloadPage]);

  const onScanned = useCallback((r) => {
    if (scanned.current || !scan) return;
    scanned.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    call('onScan', { id: scan.id, data: String(r && r.data || '') });
    setScan(null);
  }, [call, scan]);
  const closeScan = useCallback(() => { if (scan) call('onScan', { id: scan.id, error: 'cancelled' }); setScan(null); }, [call, scan]);

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
          <Text style={styles.logo}>one<Text style={styles.logoDot}>.</Text></Text>
          <Text style={styles.offlineTitle}>Can&rsquo;t reach kanvas.one</Text>
          <Text style={styles.offlineText}>Check you&rsquo;re online and try again.</Text>
          <Pressable onPress={retry} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} accessibilityRole="button">
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: startUrl }}
        style={[styles.web, failed && styles.hidden]}
        originWhitelist={['https://*', 'http://*', 'about:*']}
        injectedJavaScriptBeforeContentLoaded={
          'window.ONE_NATIVE_PLATFORM=' + JSON.stringify(Platform.OS) + ';window.ONE_APP_VERSION=' + JSON.stringify(APP_VERSION) + ';window.ONE_NATIVE_FEATURES=' + JSON.stringify(FEATURES) + ';true;'
        }
        onMessage={onMessage}
        onShouldStartLoadWithRequest={shouldStart}
        onOpenWindow={(e) => { const u = e && e.nativeEvent && e.nativeEvent.targetUrl; if (u) openOutside(String(u)); }}
        setSupportMultipleWindows={false}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onContentProcessDidTerminate={reloadPage}
        onRenderProcessGone={reloadPage}
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
      <Modal visible={!!scan} animationType="slide" onRequestClose={closeScan} statusBarTranslucent>
        <View style={styles.scanRoot}>
          {scan ? (
            <CameraView style={styles.scanCam} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
          ) : null}
          <View style={[styles.scanTop, { paddingTop: insets.top + 14 }]} pointerEvents="box-none">
            <Text style={styles.scanTitle}>Scan a QR code</Text>
            <Text style={styles.scanHint}>Hold the code inside the square.</Text>
          </View>
          <View style={styles.scanFrame} pointerEvents="none" />
          <View style={[styles.scanBottom, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable onPress={closeScan} style={({ pressed }) => [styles.scanClose, pressed && styles.btnPressed]} accessibilityRole="button">
              <Text style={styles.scanCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {loading && !failed ? (
        <View style={styles.loading} pointerEvents="none">
          <Text style={styles.logo}>one<Text style={styles.logoDot}>.</Text></Text>
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
  logoDot: { color: '#c93e09' },
  offlineTitle: { marginTop: 26, fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: '#1d1d1f' },
  offlineText: { marginTop: 6, fontSize: 15, color: '#6e6e73', textAlign: 'center' },
  btn: { marginTop: 22, backgroundColor: '#1d1d1f', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 980 },
  btnPressed: { opacity: 0.75 },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  scanRoot: { flex: 1, backgroundColor: '#08080a' },
  scanCam: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  scanTop: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', paddingHorizontal: 24 },
  scanTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  scanHint: { color: 'rgba(245,245,242,0.75)', fontSize: 15, marginTop: 6 },
  scanFrame: { position: 'absolute', alignSelf: 'center', top: '30%', width: 250, height: 250, borderRadius: 28, borderWidth: 4, borderColor: '#ff4f12' },
  scanBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  scanClose: { backgroundColor: '#ffffff', paddingVertical: 14, paddingHorizontal: 34, borderRadius: 980 },
  scanCloseText: { color: '#08080a', fontSize: 16, fontWeight: '700' }
});
