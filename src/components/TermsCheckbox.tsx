import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  openLegalPage,
  PRIVACY_POLICY_URL,
  TERMS_AND_CONDITIONS_URL,
} from '../lib/legal-links';
import { colors, fonts, spacing } from '../theme';

function openLegalLink(url: string) {
  void openLegalPage(url).catch(() => {
    Alert.alert(
      'Unable to open link',
      'Please check your internet connection and try again.',
    );
  });
}

export function TermsCheckbox({
  accepted,
  onToggle,
}: {
  accepted: boolean;
  onToggle: (nextAccepted: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: accepted }}
      hitSlop={spacing.sm}
      onPress={() => onToggle(!accepted)}
      style={styles.row}
      testID="terms-checkbox"
    >
      <View style={[styles.box, accepted && styles.boxChecked]}>
        {accepted ? (
          <Ionicons color="#FFFFFF" name="checkmark" size={14} />
        ) : null}
      </View>
      <Text style={styles.label}>
        I agree to the{' '}
        <Text
          onPress={() => openLegalLink(TERMS_AND_CONDITIONS_URL)}
          style={styles.link}
        >
          Terms of Use
        </Text>{' '}
        and{' '}
        <Text
          onPress={() => openLegalLink(PRIVACY_POLICY_URL)}
          style={styles.link}
        >
          Privacy Policy
        </Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
    width: 22,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.bold,
    textDecorationLine: 'underline',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
