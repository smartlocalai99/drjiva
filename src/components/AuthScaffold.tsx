import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout, radii, spacing } from '../theme';
import { PillMarquee } from './PillMarquee';

type AuthScaffoldProps = {
  children: ReactNode;
  onBack?: () => void;
};

export function AuthScaffold({ children, onBack }: AuthScaffoldProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.screen}>
        <PillMarquee />

        {onBack ? (
          <Pressable
            accessibilityHint="Returns to mobile number entry"
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={spacing.sm}
            onPress={onBack}
            style={styles.backButton}
            testID="otp-back-button"
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardArea}
        >
          <View style={styles.content}>{children}</View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  keyboardArea: {
    flexShrink: 1,
    justifyContent: 'flex-end',
    minHeight: 0,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
    paddingHorizontal: layout.contentPadding,
    width: '100%',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radii.round,
    borderWidth: 1,
    height: layout.backButtonSize,
    justifyContent: 'center',
    left: spacing.lg,
    position: 'absolute',
    top: spacing.sm,
    width: layout.backButtonSize,
    zIndex: 10,
  },
  backIcon: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 23,
    lineHeight: 25,
  },
});
