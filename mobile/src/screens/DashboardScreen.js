/* The Dashboard tab: the site's own dashboard (a club's registers, a
   salon's bookings; for Kane, the admin page), signed in, inside the app.
   The one web page among native screens, because it is the customer's own
   site. A notification can open it at a page (route.params.path). */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import HandoffWeb from '../components/HandoffWeb';
import { Button, Empty } from '../components/ui';
import { useApp } from '../state/app';
import { api } from '../lib/api';
import { openOutside } from '../lib/phone';

export default function DashboardScreen({ navigation, route }) {
  const { site } = useApp();
  const path = (route.params && route.params.path) || '/';
  const at = route.params && route.params.at;
  const [key, setKey] = useState(0);
  useLayoutEffect(() => { navigation.setOptions({ title: '' }); }, [navigation, site]);
  useEffect(() => { if (at) setKey((k) => k + 1); }, [at]);
  const getUrl = useCallback(async () => (await api({ action: 'dashboard', site_id: site.site_id, path })).url, [site, path]);

  if (!site || !site.dashboard_url) {
    return (
      <View style={s.center}>
        <Empty title={site ? site.name : 'Your dashboard'}
          text={!site ? 'We have not started your site yet. It appears here the moment we do.'
            : site.status === 'live' ? 'Your dashboard is being connected to the app. Until then it opens in your browser as usual.'
              : 'Your site is being built. Your dashboard appears here once it is live.'} />
        {site && site.status === 'live' && site.url ? <Button title="Open your site" onPress={() => openOutside(site.url)} style={{ alignSelf: 'center' }} /> : null}
      </View>
    );
  }
  return <HandoffWeb key={site.site_id} getUrl={getUrl} reloadKey={key} loadingText="Loading your dashboard…" />;
}

const s = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' } });
