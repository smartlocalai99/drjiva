import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { copy } from '../copy';
import { colors, fonts, layout, radii, spacing, typography } from '../theme';

const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;
const INVALID_FIRST_DIGIT_PATTERN = /^[0-5]/;

// This accommodates the longest supported raw paste (`+91 9188883459`).
// The controlled value is sanitized back to at most ten digits immediately.
const MAX_RAW_PHONE_LENGTH = 14;

const SHAKE_TIMING = {
  duration: 45,
  reduceMotion: ReduceMotion.System,
} as const;

export function sanitizePhone(rawValue: string): string {
  let digits = rawValue.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function isValidIndianPhone(value: string): boolean {
  return INDIAN_PHONE_PATTERN.test(value);
}

export interface PhoneInputProps {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  errorMessage?: string;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  testID?: string;
}

export function PhoneInput({
  accessibilityLabel,
  autoFocus = false,
  disabled = false,
  errorMessage,
  onChangeText,
  onSubmitEditing,
  testID,
  value,
}: PhoneInputProps) {
  const inputRef = useRef<TextInput>(null);
  const wasInvalidFirstDigit = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const shakeX = useSharedValue(0);

  const hasInvalidFirstDigit = INVALID_FIRST_DIGIT_PATTERN.test(value);
  const visibleError = errorMessage ?? (
    hasInvalidFirstDigit ? copy.invalidPhone : undefined
  );

  useEffect(() => {
    if (hasInvalidFirstDigit && !wasInvalidFirstDigit.current) {
      cancelAnimation(shakeX);
      shakeX.value = withSequence(
        ReduceMotion.System,
        withTiming(-7, SHAKE_TIMING),
        withTiming(7, SHAKE_TIMING),
        withTiming(-5, SHAKE_TIMING),
        withTiming(5, SHAKE_TIMING),
        withTiming(-3, SHAKE_TIMING),
        withTiming(3, SHAKE_TIMING),
        withTiming(0, SHAKE_TIMING),
      );
    }

    wasInvalidFirstDigit.current = hasInvalidFirstDigit;
  }, [hasInvalidFirstDigit, shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleChangeText = (rawValue: string) => {
    onChangeText(sanitizePhone(rawValue));
  };

  const handleClear = () => {
    onChangeText('');
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          visibleError && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
          shakeStyle,
        ]}
      >
        <Text accessibilityElementsHidden style={styles.flag}>
          🇮🇳
        </Text>
        <View accessibilityElementsHidden style={styles.divider} />
        <TextInput
          ref={inputRef}
          accessibilityHint={
            visibleError
              ? `Error: ${visibleError}`
              : 'Enter a ten digit Indian mobile number'
          }
          accessibilityLabel={
            accessibilityLabel ?? 'Mobile number'
          }
          accessibilityState={{ disabled }}
          autoComplete="tel"
          autoFocus={autoFocus}
          cursorColor={colors.primary}
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={MAX_RAW_PHONE_LENGTH}
          onBlur={() => setIsFocused(false)}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onSubmitEditing={onSubmitEditing}
          selectionColor={colors.primary}
          style={styles.input}
          testID={testID}
          textContentType="telephoneNumber"
          value={value}
        />
        {value.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear mobile number"
            accessibilityRole="button"
            disabled={disabled}
            hitSlop={spacing.md}
            onPress={handleClear}
            style={styles.clearButton}
          >
            <Text accessibilityElementsHidden style={styles.clearButtonLabel}>
              ×
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
      <View style={styles.helperSlot}>
        <Text
          accessibilityElementsHidden={!visibleError}
          accessibilityLiveRegion="polite"
          accessibilityRole={visibleError ? 'alert' : undefined}
          importantForAccessibility={
            visibleError ? 'yes' : 'no-hide-descendants'
          }
          style={[styles.helper, !visibleError && styles.helperHidden]}
        >
          {visibleError ?? '\u00A0'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1.5,
    flexDirection: 'row',
    height: layout.inputHeight,
    paddingHorizontal: spacing.lg,
  },
  inputContainerFocused: {
    borderColor: colors.borderFocus,
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: colors.borderFocus,
        shadowOffset: {
          height: 2,
          width: 0,
        },
        shadowOpacity: 0.16,
        shadowRadius: 7,
      },
      web: {
        boxShadow: `0 2px 7px ${colors.focusShadow}`,
      },
    }),
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  inputContainerDisabled: {
    opacity: 0.45,
  },
  flag: {
    fontSize: 20,
    lineHeight: 26,
  },
  divider: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    height: spacing.xl,
    marginHorizontal: spacing.md,
    width: 1,
  },
  input: {
    ...typography.input,
    color: colors.text,
    flex: 1,
    height: '100%',
    padding: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: colors.tileTint,
    borderRadius: radii.round,
    height: 28,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 28,
  },
  clearButtonLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 21,
    lineHeight: 23,
    textAlign: 'center',
  },
  helperSlot: {
    height: typography.helper.lineHeight + spacing.xs,
    paddingTop: spacing.xs,
    pointerEvents: 'none',
  },
  helper: {
    ...typography.helper,
    color: colors.error,
    paddingHorizontal: spacing.xs,
  },
  helperHidden: {
    opacity: 0,
  },
});
