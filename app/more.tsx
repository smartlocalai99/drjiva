import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { ProfileAvatarFallback } from '../src/components/ProfileAvatarFallback';
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
import {
  getAccountDeletionEmailUrl,
  openLegalPage,
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
  TERMS_AND_CONDITIONS_URL,
} from '../src/lib/legal-links';
import { getAccountMenuItems } from '../src/lib/moreMenu';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';
import {
  clearSessionPhone,
  getCachedAvatarUrl,
  getCachedPatientName,
  saveCachedAvatarUrl,
  saveCachedPatientName,
  subscribeCachedAvatarUrl,
} from '../src/lib/session';

export default function MoreScreen() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);

  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!phone) {
      return undefined;
    }
    return subscribeCachedAvatarUrl(phone, setAvatarUrl);
  }, [phone]);

  useFocusEffect(
    useCallback(() => {
      if (!phone) {
        setIsLoading(false);
        return undefined;
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
          setAvatarUrl(cachedAvatarUrl);
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
    }, [phone]),
  );

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const scrollBottomPadding =
    navBottomOffset + dashboardLayout.bottomNavHeight + 24;

  const handleSelectTab = (tab: NavTabKey) => {
    const route = getTabRoute(tab);
    if (!route) {
      return;
    }

    router.replace({ params: { phone }, pathname: route });
  };

  const handleOpenProfile = () => {
    router.push({ params: { phone }, pathname: '/profile' });
  };

  const handleOpenSupport = () => {
    router.push({ params: { phone }, pathname: '/support' });
  };

  const handleOpenLegalPage = (url: string) => {
    void openLegalPage(url).catch(() => {
      Alert.alert(
        'Unable to open link',
        'Please check your internet connection and try again.',
      );
    });
  };

  const handleRequestAccountDeletion = () => {
    Alert.alert(
      'Request account deletion?',
      'Your email app will open with a prepared request. Support will verify account ownership before permanently deleting your account and associated data.',
      [
        { style: 'cancel', text: t('cancel') },
        {
          onPress: () => {
            void Linking.openURL(getAccountDeletionEmailUrl(phone)).catch(() => {
              Alert.alert(
                'Contact support',
                'Email support@smartlocalai.in with the subject “Delete my Dr Jiva account”.',
              );
            });
          },
          style: 'destructive',
          text: 'Continue',
        },
      ],
    );
  };

  const comingSoon = (title: string) => Alert.alert(title, t('comingSoon'));

  const handleLogout = () => {
    Alert.alert(t('logOut'), t('logOutConfirm'), [
      { style: 'cancel', text: t('cancel') },
      {
        onPress: () => {
          clearDashboardPreload();
          void clearSessionPhone()
            .catch(() => undefined)
            .finally(() => router.replace('/'));
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
              {avatarUrl && !avatarFailed ? (
                <Image
                  contentFit="cover"
                  onError={() => setAvatarFailed(true)}
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <ProfileAvatarFallback size={68} />
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

          <Section label="Legal & Support">
            <Row
              icon="document-text-outline"
              isLink
              label="Terms & Conditions"
              onPress={() => handleOpenLegalPage(TERMS_AND_CONDITIONS_URL)}
            />
            <Divider />
            <Row
              icon="shield-checkmark-outline"
              isLink
              label="Privacy Policy"
              onPress={() => handleOpenLegalPage(PRIVACY_POLICY_URL)}
            />
            <Divider />
            <Row
              icon="headset-outline"
              label="Help & Support"
              onPress={handleOpenSupport}
            />
            <Divider />
            <Row
              icon="globe-outline"
              isLink
              label="Online Help Center"
              onPress={() => handleOpenLegalPage(SUPPORT_URL)}
            />
            <Divider />
            <Row
              icon="trash-outline"
              label="Request account deletion"
              labelColor={dashboardColors.error}
              onPress={handleRequestAccountDeletion}
            />
          </Section>

          <Section label="Session">
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
        activeTab={null}
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
  isLink = false,
  label,
  labelColor,
  onPress,
  showChevron = true,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  isLink?: boolean;
  label: string;
  labelColor?: string;
  onPress: () => void;
  showChevron?: boolean;
  value?: string;
}) {
  return (
    <Pressable
      accessibilityRole={isLink ? 'link' : 'button'}
      onPress={onPress}
      style={styles.row}
    >
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
    backgroundColor: dashboardColors.card,
    borderColor: '#CBD5E1',
    borderRadius: 40,
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.sm,
    padding: 4,
    width: 80,
  },
  avatarImage: {
    borderRadius: 34,
    height: 68,
    width: 68,
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
