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
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './components/Icon';
import Press from './components/Press';
import { Badge } from './components/ui';
import { C } from './theme';
import { useApp } from './state/app';
import { haptic } from './lib/phone';
import { choose } from './components/chat';
import { useEffect } from 'react';
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

/* Which site the tabs are about, top left, when there is more than one. */
function SitePicker() {
  const { sites, site, selectSite } = useApp();
  if (!site) return null;
  const many = sites.length > 1;
  const pick = async () => {
    const i = await choose('Which site?', sites.map((x) => x.name || x.url || 'Site'));
    if (i >= 0) { haptic.select(); selectSite(sites[i].site_id); }
  };
  return (
    <Press onPress={many ? pick : undefined} feel={many ? 'light' : null} disabled={false} style={s.site} accessibilityLabel={many ? 'Change site' : undefined}>
      <Text style={s.siteText} numberOfLines={1}>{site.name || 'Your site'}</Text>
      {many ? <Icon name="down" size={15} color={C.ink2} stroke={2.2} /> : null}
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
            headerLargeTitle: Platform.OS === 'ios',
            headerLeft: () => <SitePicker />,
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
const DashboardStack = tabStack('Dashboard', DashboardScreen, 'Dashboard', { headerLargeTitle: false, title: '' });

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
      </Root.Group>
    </Root.Navigator>
  );
}

const s = StyleSheet.create({
  headBtns: { flexDirection: 'row', alignItems: 'center' },
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  bellDot: { position: 'absolute', top: 7, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.or2, borderWidth: 1.5, borderColor: '#fff' },
  site: { flexDirection: 'row', alignItems: 'center', maxWidth: 200, paddingVertical: 6 },
  siteText: { fontSize: 15, fontWeight: '600', color: C.ink2, marginRight: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { marginTop: 3, fontSize: 11, fontWeight: '500', color: C.ink3 },
  tabBadge: { position: 'absolute', top: -5, right: -11 }
});
