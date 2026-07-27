import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';

const SUPPORT_EMAIL = 'support@smartlocalai.in';
const logoSource = require('../assets/logo.png');

export default function SupportScreen() {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const emailSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=DrJiva%20Support`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fall through to a copyable alert when no mail app is available.
    }

    Alert.alert('Contact support', `Email us at ${SUPPORT_EMAIL}`);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoWrapper}>
            <Image
              accessibilityLabel="DrJiva"
              contentFit="contain"
              source={logoSource}
              style={styles.logo}
            />
          </View>
          <Text style={styles.title}>How can we help?</Text>
          <Text style={styles.subtitle}>
            We&apos;re here to help with your DrJiva experience.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.supportIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="mail-outline"
              size={24}
            />
          </View>
          <Text style={styles.cardTitle}>Email support</Text>
          <Text selectable style={styles.email}>
            {SUPPORT_EMAIL}
          </Text>
          <Text style={styles.cardBody}>
            Send us your question and our support team will get back to you.
          </Text>
          <PressableScale
            accessibilityLabel="Email DrJiva support"
            onPress={emailSupport}
            pressedScale={0.98}
            style={styles.emailButton}
          >
            <Ionicons color="#FFFFFF" name="send-outline" size={19} />
            <Text style={styles.emailButtonText}>Email Support</Text>
          </PressableScale>
        </View>

        <Text style={styles.sectionLabel}>About DrJiva</Text>
        <View style={styles.detailsCard}>
          <DetailRow
            icon="shield-checkmark-outline"
            label="Trusted patient care"
            value="Secure health companion"
          />
          <View style={styles.divider} />
          <DetailRow
            icon="phone-portrait-outline"
            label="App version"
            value={appVersion}
          />
        </View>

        <Text style={styles.footer}>
          DrJiva helps you manage medicines, health documents, and everyday
          care in one place.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons color={dashboardColors.textMuted} name={icon} size={20} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  headerSide: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  content: {
    paddingBottom: dashboardSpacing.xxl,
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: dashboardSpacing.xl,
    paddingTop: dashboardSpacing.gap,
  },
  logoWrapper: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.gap,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    width: 68,
  },
  logo: {
    height: 44,
    width: 44,
  },
  title: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    fontSize: 24,
  },
  subtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    padding: dashboardSpacing.xl,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  supportIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  cardTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.md,
  },
  email: {
    ...dashboardTypography.body,
    color: dashboardColors.primary,
    marginTop: dashboardSpacing.xs,
  },
  cardBody: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  emailButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    height: 52,
    justifyContent: 'center',
    marginTop: dashboardSpacing.gap,
  },
  emailButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  sectionLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginBottom: dashboardSpacing.sm,
    marginTop: dashboardSpacing.xl,
    textTransform: 'uppercase',
  },
  detailsCard: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    paddingHorizontal: dashboardSpacing.gap,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    paddingVertical: dashboardSpacing.md,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
  detailValue: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginTop: 2,
  },
  divider: {
    backgroundColor: dashboardColors.track,
    height: 1,
  },
  footer: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginTop: dashboardSpacing.xl,
    textAlign: 'center',
  },
});
