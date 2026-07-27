import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radii, spacing, typography } from '../theme';

export const OTP_LENGTH = 4;

export type OtpInputHandle = {
  focus: () => void;
};

type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onComplete: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  shakeTrigger?: number;
};

type OtpBoxProps = {
  digit: string | undefined;
  size: number;
  active: boolean;
  error: boolean;
};

const BlinkingCaret = memo(function BlinkingCaret() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.caret, animatedStyle]} />;
});

const OtpBox = memo(function OtpBox({
  digit,
  size,
  active,
  error,
}: OtpBoxProps) {
  const sizeStyle = useMemo(
    () => ({
      height: size,
      width: size,
    }),
    [size],
  );

  return (
    <View
      style={[
        styles.box,
        sizeStyle,
        digit ? styles.boxFilled : null,
        active ? styles.boxActive : null,
        error ? styles.boxError : null,
      ]}
    >
      {digit ? <Text style={styles.digit}>{digit}</Text> : null}
      {active && !digit ? <BlinkingCaret /> : null}
    </View>
  );
});

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(
  function OtpInput(
    {
      value,
      onChangeText,
      onComplete,
      disabled = false,
      hasError = false,
      errorMessage,
      shakeTrigger = 0,
    },
    forwardedRef,
  ) {
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);
    const { width } = useWindowDimensions();
    const shakeX = useSharedValue(0);

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => inputRef.current?.focus(),
      }),
      [],
    );

    useEffect(() => {
      if (shakeTrigger <= 0) {
        return;
      }

      shakeX.value = withSequence(
        withTiming(-9, { duration: 35 }),
        withTiming(9, { duration: 35 }),
        withTiming(-9, { duration: 35 }),
        withTiming(9, { duration: 35 }),
        withTiming(-7, { duration: 35 }),
        withTiming(7, { duration: 35 }),
        withTiming(-4, { duration: 35 }),
        withTiming(4, { duration: 35 }),
        withTiming(0, { duration: 35 }),
      );
    }, [shakeTrigger, shakeX]);

    const shakeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: shakeX.value }],
    }));

    const boxSize = Math.min(
      64,
      (width -
        spacing.xl * 2 -
        spacing.md * Math.max(0, OTP_LENGTH - 1)) /
        OTP_LENGTH,
    );

    const digits = useMemo(
      () => Array.from({ length: OTP_LENGTH }, (_, index) => value[index]),
      [value],
    );
    const inputOverlayStyle = useMemo(
      () => ({
        height: boxSize,
      }),
      [boxSize],
    );

    const handleChange = (rawValue: string) => {
      const nextValue = rawValue.replace(/\D/g, '').slice(0, OTP_LENGTH);
      onChangeText(nextValue);

      if (nextValue.length === OTP_LENGTH && !disabled) {
        onComplete(nextValue);
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.pressTarget} testID="otp-boxes">
          <Animated.View
            style={[
              styles.boxRow,
              disabled ? styles.rowDisabled : null,
              shakeStyle,
            ]}
          >
            {digits.map((digit, index) => (
              <OtpBox
                active={
                  isFocused &&
                  !disabled &&
                  value.length < OTP_LENGTH &&
                  index === value.length
                }
                digit={digit}
                error={hasError}
                key={`otp-box-${index}`}
                size={boxSize}
              />
            ))}
          </Animated.View>

          <TextInput
            accessibilityHint="Enter or paste the verification code"
            accessibilityLabel={`${OTP_LENGTH}-digit verification code`}
            accessibilityState={{ disabled }}
            autoComplete={
              Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'
            }
            autoFocus
            caretHidden
            contextMenuHidden={false}
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH * 3}
            onBlur={() => setIsFocused(false)}
            onChangeText={handleChange}
            onFocus={() => setIsFocused(true)}
            ref={inputRef}
            selectionColor={colors.primary}
            style={[styles.hiddenInput, inputOverlayStyle]}
            testID="otp-input"
            textContentType="oneTimeCode"
            value={value}
          />
        </View>

        <View style={styles.helperSlot}>
          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  pressTarget: {
    width: '100%',
  },
  boxRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  rowDisabled: {
    opacity: 0.6,
  },
  box: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radii.otpBox,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  boxFilled: {
    backgroundColor: colors.tileTint,
  },
  boxActive: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
  },
  boxError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  digit: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  caret: {
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    height: 26,
    width: 2,
  },
  hiddenInput: {
    backgroundColor: colors.transparentWhite,
    color: colors.transparentWhite,
    left: 0,
    opacity: 0.01,
    outlineWidth: 0,
    padding: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  helperSlot: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.helper,
    color: colors.error,
    textAlign: 'center',
  },
});
