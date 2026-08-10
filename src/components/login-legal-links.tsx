import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { copy } from '../copy';
import {
  openLegalPage,
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
  TERMS_AND_CONDITIONS_URL,
} from '../lib/legal-links';
import { colors, fonts, spacing, typography } from '../theme';

type LegalLinkProps = {
  label: string;
  url: string;
};

function LegalLink({ label, url }: LegalLinkProps) {
  const handlePress = () => {
    void openLegalPage(url).catch(() => {
      Alert.alert(
        'Unable to open link',
        'Please check your internet connection and try again.',
      );
    });
  };

  return (
    <Pressable
      accessibilityHint={`Opens the Dr Jiva ${label} page`}
      accessibilityLabel={label}
      accessibilityRole="link"
      hitSlop={spacing.sm}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.linkButton,
        pressed ? styles.linkButtonPressed : null,
      ]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function LoginLegalLinks() {
  return (
    <View accessibilityLabel="Legal information and support" style={styles.container}>
      <Text style={styles.legalText}>{copy.legal}</Text>
      <View style={styles.links}>
        <LegalLink label="Terms & Conditions" url={TERMS_AND_CONDITIONS_URL} />
        <LegalLink label="Privacy Policy" url={PRIVACY_POLICY_URL} />
        <LegalLink label="Support" url={SUPPORT_URL} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 72,
    paddingHorizontal: spacing.xs,
    width: '100%',
  },
  legalText: {
    ...typography.helper,
    color: colors.textMuted,
    maxWidth: 340,
    textAlign: 'center',
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  linkButton: {
    justifyContent: 'center',
    minHeight: 32,
  },
  linkButtonPressed: {
    opacity: 0.55,
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
});
