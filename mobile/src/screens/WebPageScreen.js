/* One of our own pages, inside the app and signed in: the One setup
   form, or the admin's customer pages and All sites. Only pages the
   server allows open (api/app.js 'page'). */
import { useCallback, useLayoutEffect } from 'react';
import HandoffWeb from '../components/HandoffWeb';
import { api } from '../lib/api';

export default function WebPageScreen({ route, navigation }) {
  const { path, title } = route.params;
  useLayoutEffect(() => { navigation.setOptions({ title: title || '' }); }, [navigation, title]);
  const getUrl = useCallback(async () => (await api({ action: 'page', path })).url, [path]);
  return <HandoffWeb getUrl={getUrl} />;
}
