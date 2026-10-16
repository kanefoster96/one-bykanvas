/* How the app is laid out.
 *
 * Tabs along the bottom, which depend on who is signed in:
 *   Kane (admin)   Build · Analytics · Chat · Dashboard
 *   Business       Dashboard (when connected) · Analytics · Chat · Support
 *   Starter        Home · Messages · Support
 *   One client     Support only, no tab bar
 * Each tab has its own large iOS title. Anything opened from a list (a
 * request, a chat, a build, a contact) is pushed over the tabs, full
 * screen, and swipes back from the left edge like any iPhone app. The
 * bell and the account open as sheets that swipe down.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './components/Icon';
import Press from './components/Press';
import { Badge } from './components/ui';
import { C } from './theme';
import { brandFor } from './lib/brand';
import { useNavigation } from '@react-navigation/native';
import { initials } from './lib/format';
import { useApp } from './state/app';
import { haptic } from './lib/phone';
import { choose } from './components/chat';
import { useEffect, useState } from 'react';
import { loadChats, startLive, stopLive, useChats } from './state/chat';
import { bus } from './lib/bus';
import { api } from './lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BuildScreen from './screens/admin/BuildScreen';
import BuildDetailScreen from './screens/admin/BuildDetailScreen';
import AdminRequestScreen from './screens/admin/AdminRequestScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import InboxScreen from './screens/chat/InboxScreen';
import ThreadScreen from './screens/chat/ThreadScreen';
import ContactScreen from './screens/chat/ContactScreen';
import OnlineScreen from './screens/chat/OnlineScreen';
import MessagesScreen from './screens/MessagesScreen';
import SupportScreen from './screens/support/SupportScreen';
import RequestScreen from './screens/support/RequestScreen';
import NewRequestScreen from './screens/support/NewRequestScreen';
import SupportChatScreen from './screens/support/SupportChatScreen';
import DashboardScreen from './screens/DashboardScreen';
import WebPageScreen from './screens/WebPageScreen';
import ActivityScreen from './screens/ActivityScreen';
import AccountScreen from './screens/AccountScreen';
import ProfileScreen from './screens/ProfileScreen';

export { nav } from './navRef';

const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const TabStack = createNativeStackNavigator();

/* The look of every header: white, no line, black back arrow without a
   word next to it, large titles on the lists. */
export const stackLook = {
  headerTintColor: C.ink,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#fff' },
  headerTitleStyle: { fontWeight: '600', color: C.ink, fontSize: 17 },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: '#fff' },
  headerLargeTitleShadowVisible: false,
  headerLargeTitleStyle: { color: C.ink, fontWeight: '700' }
};

/* The bell and the account, top right on every tab. */
function HeadButtons({ navigation }) {
  const { me } = useApp();
  const unread = (me && me.unread && me.unread.notifications) || 0;
  return (
    <View style={s.headBtns}>
      <Press onPress={() => navigation.navigate('Activity')} style={s.headBtn} accessibilityLabel="Activity" hitSlop={6}>
        <Icon name="bell" size={24} color={C.ink} />
        {unread ? <View style={s.bellDot} /> : null}
      </Press>
      <Press onPress={() => navigation.navigate('Account')} style={s.headBtn} accessibilityLabel="Account" hitSlop={6}>
        <Icon name="user" size={24} color={C.ink} />
      </Press>
    </View>
  );
}

/* Top left on every tab: their logo in a circle and the business name in
   bold black. No page title: the tab bar already says which page this is.
   A customer taps it to change their name or logo (Kane gets the change
   as a request, for the website); Kane taps it to switch site. */
function Brand() {
  const app = useApp();
  const navigation = useNavigation();
  const [broken, setBroken] = useState(null);
  const { sites, isAdmin, selectSite } = app;
  const brand = brandFor(app);
  if (!brand.name && !app.site) return <Text style={s.brandName}>one<Text style={{ color: C.or }}>.</Text></Text>;
  const many = isAdmin && sites.length > 1;
  const tap = async () => {
    if (!isAdmin) { navigation.navigate('Profile'); return; }
    if (!many) return;
    const i = await choose('Which site?', sites.map((x) => x.name || x.url || 'Site'));
    if (i >= 0) { haptic.select(); selectSite(sites[i].site_id); }
  };
  return (
    <Press onPress={tap} feel={!isAdmin || many ? 'light' : null} scale={!isAdmin || many ? 0.96 : 1} style={s.brand}
      accessibilityLabel={isAdmin ? (many ? 'Change site' : brand.name) : 'Your business name and logo'} testID="brand">
      {brand.logo && broken !== brand.logo ? (
        <Image source={{ uri: brand.logo }} style={s.logo} onError={() => setBroken(brand.logo)} />
      ) : (
        <View style={[s.logo, s.logoNone]}><Text style={s.logoText}>{initials(brand.name)}</Text></View>
      )}
      <Text style={s.brandName} numberOfLines={1}>{brand.name || 'Your business'}</Text>
      {many ? <Icon name="down" size={16} color={C.ink} stroke={2.4} /> : null}
    </Press>
  );
}

function tabStack(name, Component, title, opts) {
  function Stack() {
    return (
      <TabStack.Navigator screenOptions={stackLook}>
        <TabStack.Screen name={name + 'Home'} component={Component}
          options={({ navigation }) => Object.assign({
            title,
            headerTitle: () => null,
            headerLeft: () => <Brand />,
            headerRight: () => <HeadButtons navigation={navigation} />
          }, opts)} />
      </TabStack.Navigator>
    );
  }
  Stack.displayName = name + 'Stack';
  return Stack;
}

const BuildStack = tabStack('Build', BuildScreen, 'Build');
const AnalyticsStack = tabStack('Analytics', AnalyticsScreen, 'Analytics');
const HomeStack = tabStack('Home', AnalyticsScreen, 'Home');
const ChatStack = tabStack('Chat', InboxScreen, 'Chat');
const MessagesStack = tabStack('Messages', MessagesScreen, 'Messages');
const SupportStack = tabStack('Support', SupportScreen, 'Support');
const DashboardStack = tabStack('Dashboard', DashboardScreen, 'Dashboard');

const TAB_ICON = { Build: 'build', Analytics: 'chart', Home: 'home', Chat: 'chat', Contacts: 'contacts', Messages: 'mail', Support: 'support', Dashboard: 'grid' };

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const o = descriptors[route.key].options;
        const label = o.tabBarLabel || route.name;
        const go = () => {
          const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!on && !ev.defaultPrevented) { haptic.select(); navigation.navigate(route.name); }
        };
        return (
          <Press key={route.key} onPress={go} feel={null} scale={0.92} style={s.tab} accessibilityRole="tab" accessibilityLabel={label} testID={'tab-' + route.name}>
            <View>
              <Icon name={TAB_ICON[o.tabIcon || route.name] || 'grid'} size={25} color={on ? C.or : C.ink3} stroke={on ? 2 : 1.8} />
              <Badge n={o.tabBarBadge} style={s.tabBadge} />
            </View>
            <Text style={[s.tabLabel, on && { color: C.or, fontWeight: '600' }]}>{label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/* Live chat runs while the app is open, whatever tab is showing, so the
   Chat tab's number is right and a thread on screen gets new messages
   the moment they are sent. */
function ChatLive() {
  const { site, hasChat, setCounts } = useApp();
  const chats = useChats();
  const id = site && hasChat ? site.site_id : null;
  useEffect(() => {
    if (!id) return undefined;
    startLive(id);
    loadChats(id);
    const t = setInterval(() => loadChats(id), 30000);
    const off = bus.on('refresh', () => loadChats(id));
    return () => { clearInterval(t); off(); stopLive(); };
  }, [id]);
  useEffect(() => { setCounts({ chat: chats.convs.filter((c) => c.unread).length }); }, [chats.convs, setCounts]);
  return null;
}

/* Starter's Messages number: new contact-form messages since the tab was
   last opened on this phone, checked every minute and on a notification. */
function StarterLive() {
  const { site, isStarter, setCounts } = useApp();
  const id = isStarter && site ? site.site_id : null;
  useEffect(() => {
    if (!id) return undefined;
    const check = async () => {
      try {
        const res = await api({ action: 'enquiries', site_id: id });
        const seen = Number(await AsyncStorage.getItem('oa-msgs-seen:' + id)) || Date.now() - 7 * 864e5;
        setCounts({ messages: (res.enquiries || []).filter((m) => new Date(m.created_at).getTime() > seen).length });
      } catch (e) { /* the next check */ }
    };
    check();
    const t = setInterval(check, 60000);
    const off = bus.on('refresh', check);
    return () => { clearInterval(t); off(); };
  }, [id, setCounts]);
  return null;
}

function MainTabs() {
  const app = useApp();
  const { isAdmin, isStarter, site, hasChat, contactsAllowed, counts, me } = app;
  const support = ((me && me.unread && me.unread.requests) || 0) + ((me && me.unread && me.unread.support) || 0);
  const chatTab = hasChat || contactsAllowed;
  const screens = [];
  if (isAdmin) {
    screens.push(<Tabs.Screen key="Build" name="Build" component={BuildStack} options={{ tabBarBadge: counts.build }} />);
    screens.push(<Tabs.Screen key="Analytics" name="Analytics" component={AnalyticsStack} />);
    if (chatTab) screens.push(<Tabs.Screen key="Chat" name="Chat" component={ChatStack} options={{ tabBarBadge: counts.chat, tabBarLabel: hasChat ? 'Chat' : 'Contacts', tabIcon: hasChat ? 'Chat' : 'Contacts' }} />);
    screens.push(<Tabs.Screen key="Dashboard" name="Dashboard" component={DashboardStack} />);
  } else if (isStarter) {
    screens.push(<Tabs.Screen key="Home" name="Home" component={HomeStack} />);
    screens.push(<Tabs.Screen key="Messages" name="Messages" component={MessagesStack} options={{ tabBarBadge: counts.messages }} />);
    screens.push(<Tabs.Screen key="Support" name="Support" component={SupportStack} options={{ tabBarBadge: support }} />);
  } else {
    if (site && site.dashboard_url) screens.push(<Tabs.Screen key="Dashboard" name="Dashboard" component={DashboardStack} />);
    screens.push(<Tabs.Screen key="Analytics" name="Analytics" component={AnalyticsStack} />);
    if (chatTab) screens.push(<Tabs.Screen key="Chat" name="Chat" component={ChatStack} options={{ tabBarBadge: counts.chat, tabBarLabel: hasChat ? 'Chat' : 'Contacts', tabIcon: hasChat ? 'Chat' : 'Contacts' }} />);
    screens.push(<Tabs.Screen key="Support" name="Support" component={SupportStack} options={{ tabBarBadge: support }} />);
  }
  return (
    <>
      <ChatLive />
      <StarterLive />
      <Tabs.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, lazy: true }}>
        {screens}
      </Tabs.Navigator>
    </>
  );
}

export function MainNavigator() {
  const { isOneClient } = useApp();
  return (
    <Root.Navigator screenOptions={stackLook}>
      {isOneClient
        ? <Root.Screen name="Main" component={SupportStack} options={{ headerShown: false }} />
        : <Root.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />}
      <Root.Screen name="AdminRequest" component={AdminRequestScreen} options={{ title: '' }} />
      <Root.Screen name="BuildDetail" component={BuildDetailScreen} options={{ title: '' }} />
      <Root.Screen name="Thread" component={ThreadScreen} options={{ title: '' }} />
      <Root.Screen name="Contact" component={ContactScreen} options={{ title: '' }} />
      <Root.Screen name="Request" component={RequestScreen} options={{ title: '' }} />
      <Root.Screen name="NewRequest" component={NewRequestScreen} options={{ title: 'New request' }} />
      <Root.Screen name="SupportChat" component={SupportChatScreen} options={{ title: 'Chat with Kane' }} />
      <Root.Screen name="WebPage" component={WebPageScreen} options={{ title: '' }} />
      <Root.Group screenOptions={{ presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal', headerShown: false, sheetGrabberVisible: true, sheetCornerRadius: 24 }}>
        <Root.Screen name="Activity" component={ActivityScreen} options={{ sheetAllowedDetents: [0.6, 1] }} />
        <Root.Screen name="Account" component={AccountScreen} options={{ sheetAllowedDetents: [0.75, 1] }} />
        <Root.Screen name="Online" component={OnlineScreen} options={{ sheetAllowedDetents: [0.55, 1] }} />
        <Root.Screen name="Profile" component={ProfileScreen} options={{ sheetAllowedDetents: [0.85, 1] }} />
      </Root.Group>
    </Root.Navigator>
  );
}

const s = StyleSheet.create({
  headBtns: { flexDirection: 'row', alignItems: 'center' },
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  bellDot: { position: 'absolute', top: 7, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.or2, borderWidth: 1.5, borderColor: '#fff' },
  brand: { flexDirection: 'row', alignItems: 'center', maxWidth: 260, paddingVertical: 4 },
  logo: { width: 34, height: 34, borderRadius: 17, marginRight: 10, backgroundColor: C.grey },
  logoNone: { backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  brandName: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: C.ink, marginRight: 4, flexShrink: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { marginTop: 3, fontSize: 11, fontWeight: '500', color: C.ink3 },
  tabBadge: { position: 'absolute', top: -5, right: -11 }
});
