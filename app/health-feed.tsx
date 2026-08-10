import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  BottomNav,
  type NavTabKey,
} from '../src/components/dashboard/BottomNav';
import {
  dashboardColors,
  dashboardLayout,
} from '../src/dashboardTheme';
import { getTabRoute } from '../src/lib/dashboardNav';
import { normalizeRoutePhone } from '../src/lib/routePhone';

export default function HealthFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);
  const insets = useSafeAreaInsets();

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === 'healthFeed') {
      return;
    }

    const route = getTabRoute(tab);
    if (!route) {
      return;
    }

    router.replace({ params: { phone }, pathname: route });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <BottomNav
        activeTab="healthFeed"
        bottomOffset={insets.bottom + dashboardLayout.navBottomGap}
        onSelectTab={handleSelectTab}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
});
