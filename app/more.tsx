import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { VerifiedBadge } from '../src/components/VerifiedBadge';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { getTabRoute } from '../src/lib/dashboardNav';
import { clearDashboardPreload } from '../src/lib/dashboardPreload';
import { useLanguage } from '../src/lib/i18n';
import { getAccountMenuItems } from '../src/lib/moreMenu';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';
import {
  clearSessionPhone,
  getCachedAvatarUrl,
  getCachedPatientName,
  saveCachedAvatarUrl,
  saveCachedPatientName,
} from '../src/lib/session';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export default function MoreScreen() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);

  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<NavTabKey>('more');
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadPatient = async () => {
      const [cachedName, cachedAvatarUrl] = await Promise.all([
        getCachedPatientName(phone).catch(() => null),
        getCachedAvatarUrl(phone).catch(() => null),
      ]);
      if (!cancelled) {
        if (cachedName) {
          setName(cachedName);
        }
        if (cachedAvatarUrl) {
          setAvatarUrl(cachedAvatarUrl);
        }
        setIsLoading(false);
      }

      try {
        const patient = await getPatientByPhone(phone);
        if (!cancelled && patient) {
          setName(patient.name);
          setAvatarUrl(patient.avatarUrl);
          void saveCachedPatientName(phone, patient.name).catch(
            () => undefined,
          );
          void saveCachedAvatarUrl(phone, patient.avatarUrl).catch(
            () => undefined,
          );
        }
      } catch {
        // Keep the cached value while the background refresh is unavailable.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPatient();

    return () => {
      cancelled = true;
    };
  }, [phone]);

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const scrollBottomPadding =
    navBottomOffset + dashboardLayout.bottomNavHeight + 24;

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) {
      return;
    }

    const route = getTabRoute(tab);
    if (!route) {
      return;
    }

    setActiveTab(tab);
    router.replace({ params: { phone }, pathname: route });
  };

  const handleOpenProfile = () => {
    router.push({ params: { phone }, pathname: '/profile' });
  };

  const handleOpenSupport = () => {
    router.push({ params: { phone }, pathname: '/support' });
  };

  const comingSoon = (title: string) => Alert.alert(title, t('comingSoon'));

  const handleLogout = () => {
    Alert.alert(t('logOut'), t('logOutConfirm'), [
      { style: 'cancel', text: t('cancel') },
      {
        onPress: () => {
          clearDashboardPreload();
          void clearSessionPhone().catch(() => undefined);
          router.replace('/');
        },
        style: 'destructive',
        text: t('logOut'),
      },
    ]);
  };

  const handleChangeLanguage = () => {
    Alert.alert(t('language'), undefined, [
      { onPress: () => setLanguage('en'), text: 'English' },
      { onPress: () => setLanguage('te'), text: 'తెలుగు (Telugu)' },
      { style: 'cancel', text: t('cancel') },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header} />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: scrollBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarCard}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image
                  contentFit="cover"
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitials}>
                  {getInitials(name || '?')}
                </Text>
              )}
            </View>
            <Text style={styles.avatarName}>{name || 'Your name'}</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.phoneText}>+91 {phone}</Text>
              <VerifiedBadge />
            </View>
          </View>

          <Section label={t('account')}>
            {getAccountMenuItems().map((item, index) => (
              <View key={item.key}>
                {index > 0 ? <Divider /> : null}
                {item.key === 'profile' ? (
                  <Row
                    icon="person-circle-outline"
                    label={t('manageProfile')}
                    onPress={handleOpenProfile}
                  />
                ) : null}
                {item.key === 'notificationTimings' ? (
                  <Row
                    icon="time-outline"
                    label={t('notificationTimings')}
                    onPress={() =>
                      router.push({
                        params: { phone },
                        pathname: '/notification-timings',
                      })
                    }
                  />
                ) : null}
                {item.key === 'savedAddresses' ? (
                  <Row
                    icon="location-outline"
                    label={t('deliveryAddresses')}
                    onPress={() =>
                      router.push({
                        params: { phone },
                        pathname: '/saved-addresses',
                      })
                    }
                  />
                ) : null}
                {item.key === 'reminders' ? (
                  <Row
                    icon="alarm-outline"
                    label={t('reminders')}
                    onPress={() =>
                      router.push({
                        params: { phone },
                        pathname: '/reminders',
                      })
                    }
                  />
                ) : null}
                {item.key === 'language' ? (
                  <Row
                    icon="language-outline"
                    label={t('language')}
                    onPress={handleChangeLanguage}
                    value={language === 'te' ? 'తెలుగు' : 'English'}
                  />
                ) : null}
              </View>
            ))}
          </Section>

          <Section label={t('preferences')}>
            <Row
              icon="reader-outline"
              label={t('aboutUs')}
              onPress={() =>
                Alert.alert(
                  'About DrJiva',
                  `Version ${Constants.expoConfig?.version ?? '1.0.0'}`,
                )
              }
            />
          </Section>

          <Section label={t('support')}>
            <Row
              icon="headset-outline"
              label="Support"
              onPress={handleOpenSupport}
            />
            <Divider />
            <Row
              icon="log-out-outline"
              iconColor={dashboardColors.error}
              label={t('logOut')}
              labelColor={dashboardColors.error}
              onPress={handleLogout}
              showChevron={false}
            />
          </Section>
        </ScrollView>
      )}

      <BottomNav
        activeTab={activeTab}
        bottomOffset={navBottomOffset}
        onSelectTab={handleSelectTab}
      />
    </SafeAreaView>
  );
}

function Section({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  iconColor,
  label,
  labelColor,
  onPress,
  showChevron = true,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  labelColor?: string;
  onPress: () => void;
  showChevron?: boolean;
  value?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Ionicons color={iconColor ?? dashboardColors.text} name={icon} size={20} />
      <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
      <View style={styles.rowSpacer} />
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {showChevron ? (
        <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={18} />
      ) : null}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  avatarCard: {
    alignItems: 'center',
    marginBottom: dashboardSpacing.xl,
    marginTop: dashboardSpacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.sm,
    overflow: 'hidden',
    width: 80,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
  },
  avatarName: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  phoneRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  phoneText: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  sectionLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginBottom: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    paddingHorizontal: dashboardSpacing.gap,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    paddingVertical: 14,
  },
  rowLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 15,
  },
  rowSpacer: {
    flex: 1,
  },
  rowValue: {
    ...dashboardTypography.body,
    color: dashboardColors.textFaint,
    fontSize: 14,
    marginRight: 4,
  },
  divider: {
    backgroundColor: dashboardColors.track,
    height: 1,
  },
});
