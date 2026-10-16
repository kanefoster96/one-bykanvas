/* Push notifications: permission, this phone's token, the buttons on a
 * notification (Call, Email, Reply), and where a tapped one opens.
 *
 * The server keys device_tokens on the Expo push token and sends through
 * Expo's push service. A tap opens the record it is about, natively: a
 * chat opens its thread, a request its conversation, a new customer their
 * build checklist.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import { openOutside, haptic } from './phone';

const web = Platform.OS === 'web';
let lastToken = null;
let lastNote = '';
/* What registering said last, for the Account sheet. */
export function pushNote() { return lastNote; }
/* This phone's token, once registered: logging out removes it on the server. */
export function pushToken() { return lastToken; }

if (!web) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true })
  });
  (async () => {
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
  })();
}

/* Permission, then the token, then tell the server. Returns a sentence for
   the Account sheet. */
export async function registerPush() {
  const r = await register();
  lastNote = r.note;
  return r;
}
async function register() {
  if (web) return { token: null, note: 'Install the app on your phone to get notifications.' };
  if (!Device.isDevice) return { token: null, note: 'Notifications need a real phone.' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('one', { name: 'Kanvas One', importance: Notifications.AndroidImportance.MAX, sound: 'default' });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return { token: null, note: 'Notifications are off. Turn them on in your phone’s settings to hear about payments and messages.' };
    const projectId = (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId)
      || (Constants.easConfig && Constants.easConfig.projectId);
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const version = (Constants.expoConfig && Constants.expoConfig.version) || '1.1.0';
    await api({ action: 'device', token: t.data, platform: Platform.OS, app_version: version });
    lastToken = t.data;
    return { token: t.data, note: 'Notifications are on for this phone.' };
  } catch (err) {
    return { token: null, note: 'Could not register this phone: ' + (err && err.message ? err.message : 'try again later') };
  }
}

/* A notification's data, tidied: deep_link arrives as a JSON string. */
export function readLink(d) {
  d = d && typeof d === 'object' ? d : {};
  let link = d.deep_link;
  if (typeof link === 'string') { try { link = JSON.parse(link); } catch (e) { link = null; } }
  return { kind: d.kind, href: d.href, deep_link: link || null, action: d.action || null, text: d.text || null, phone: d.phone, email: d.email, site_id: d.site_id || null };
}

/* Where a tapped notification (or an Activity row) goes. `app` is the
   useApp() value; `nav` the navigation ref. */
export function openLink(nav, app, n) {
  if (!nav.isReady() || !app.me) return false;
  const link = n.deep_link || null;
  const go = (name, params) => nav.navigate(name, params);
  const tab = (name, params) => nav.navigate('Main', app.isOneClient ? undefined : { screen: name, params: { screen: name + 'Home', params } });
  const homeTab = app.isAdmin ? 'Build' : app.isOneClient ? 'Support' : app.isStarter ? 'Home' : (app.site && app.site.dashboard_url ? 'Dashboard' : 'Analytics');

  if (link && link.kind === 'support_chat') return go('SupportChat');
  if (link && link.kind === 'max_setup') return go('WebPage', { title: 'One setup', path: link.user ? '/onboarding.html?user=' + encodeURIComponent(link.user) : '/onboarding.html' });
  /* A chat is about one site: switch to it (Kane, or anyone with more than
     one) and send a typed reply to that site's conversation. */
  const chatSite = n.site_id || (app.site && app.site.site_id);
  if (link && link.kind === 'chat' && n.site_id && app.site && n.site_id !== app.site.site_id && app.sites.some((x) => x.site_id === n.site_id)) app.selectSite(n.site_id);
  if (link && link.kind === 'chat' && n.action === 'reply' && n.text && link.id && chatSite) {
    api({ action: 'chat_reply', site_id: chatSite, conversation_id: link.id, body: String(n.text).slice(0, 4000), via: 'chat' })
      .then(() => haptic.success()).catch(() => haptic.error());
    return go('Thread', { id: link.id, siteId: chatSite });
  }
  if (link && link.kind === 'chat') return go('Thread', { id: link.id, siteId: chatSite });
  if (link && link.kind === 'support' && link.id) return go(app.isAdmin ? 'AdminRequest' : 'Request', { id: link.id });
  let m = n.href && /^\/requests\.html#r\/(.+)$/.exec(n.href);
  if (m) return go('Request', { id: m[1] });
  m = n.href && /^\/admin\.html#r\/(.+)$/.exec(n.href);
  if (m) return go('AdminRequest', { id: m[1] });
  m = n.href && /^\/admin\.html#b\/([0-9a-f-]{36})(?:\/(site|app|ads))?$/i.exec(n.href);
  if (m) return go('BuildDetail', { id: m[1], job: m[2] || null });
  if (app.isStarter) {
    if ((link && (link.kind === 'enquiry' || link.kind === 'person')) || n.kind === 'enquiry' || n.kind === 'person') return tab('Messages', { openId: link && link.id });
    if (n.href && /^https:\/\//.test(n.href)) { tab('Home'); openOutside(n.href); return true; }
    return tab('Home');
  }
  if (link && link.path && app.site && app.site.dashboard_url) return tab('Dashboard', { path: link.path, at: Date.now() });
  if (n.href && /^https:\/\//.test(n.href)) { tab(homeTab); openOutside(n.href); return true; }
  return tab(homeTab);
}
