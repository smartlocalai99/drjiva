import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthScaffold } from '../src/components/AuthScaffold';
import { BrandHeader } from '../src/components/BrandHeader';
import {
  OtpInput,
  type OtpInputHandle,
  OTP_LENGTH,
} from '../src/components/OtpInput';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { copy } from '../src/copy';
import { sendOtp, verifyOtp } from '../src/lib/auth';
import { checkPatientExists } from '../src/lib/patients';
import { ensureSecureReportSession } from '../src/lib/reportAuth';
import { saveSessionPhone } from '../src/lib/session';
import {
  colors,
  fonts,
  spacing,
  typography,
} from '../src/theme';

const RESEND_SECONDS = 30;
const CODE_SENT_VISIBLE_MS = 2000;
const ERROR_SHAKE_MS = 350;
const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;

function formatPhone(phone: string) {
  if (phone.length !== 10) {
    return phone;
  }

  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [hasOtpError, setHasOtpError] = useState(false);
  const [showOtpErrorBorders, setShowOtpErrorBorders] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [showCodeSent, setShowCodeSent] = useState(false);
  const [resendFailed, setResendFailed] = useState(false);

  const otpInputRef = useRef<OtpInputHandle>(null);
  const isMountedRef = useRef(true);
  const isVerifyingRef = useRef(false);
  const isRejectingRef = useRef(false);
  const isResendingRef = useRef(false);
  const shouldRefocusRef = useRef(false);
  const verificationRequestRef = useRef(0);
  const resendRequestRef = useRef(0);
  const deadlineRef = useRef(0);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
    }

    deadlineRef.current = Date.now() + RESEND_SECONDS * 1000;
    setSecondsRemaining(RESEND_SECONDS);

    const tick = () => {
      const nextSeconds = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000),
      );
      setSecondsRemaining(nextSeconds);

      if (nextSeconds > 0) {
        countdownTimerRef.current = setTimeout(tick, 250);
      }
    };

    countdownTimerRef.current = setTimeout(tick, 250);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    startCountdown();

    return () => {
      isMountedRef.current = false;
      verificationRequestRef.current += 1;
      resendRequestRef.current += 1;
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
      if (codeSentTimerRef.current) {
        clearTimeout(codeSentTimerRef.current);
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [startCountdown]);

  useEffect(() => {
    if (!isRejecting && shouldRefocusRef.current) {
      shouldRefocusRef.current = false;
      otpInputRef.current?.focus();
    }
  }, [isRejecting]);

  useEffect(() => {
    if (!INDIAN_PHONE_PATTERN.test(phone)) {
      router.replace('/');
    }
  }, [phone, router]);

  const handleCodeChange = (nextCode: string) => {
    if (hasOtpError) {
      setHasOtpError(false);
    }
    if (showOtpErrorBorders) {
      setShowOtpErrorBorders(false);
    }
    setCode(nextCode);
  };

  const rejectSubmittedCode = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }

    setHasOtpError(true);
    setShowOtpErrorBorders(true);
    isRejectingRef.current = true;
    setIsRejecting(true);
    setShakeTrigger((current) => current + 1);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error,
    ).catch(() => undefined);

    errorTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      shouldRefocusRef.current = true;
      setCode('');
      setShowOtpErrorBorders(false);
      isRejectingRef.current = false;
      setIsRejecting(false);
    }, ERROR_SHAKE_MS);
  }, []);

  const handleVerify = useCallback(
    async (submittedCode: string) => {
      if (
        submittedCode.length !== OTP_LENGTH ||
        isVerifyingRef.current ||
        isRejectingRef.current ||
        isResendingRef.current
      ) {
        return;
      }

      const requestId = verificationRequestRef.current + 1;
      verificationRequestRef.current = requestId;
      isVerifyingRef.current = true;
      setIsVerifying(true);
      setHasOtpError(false);
      setShowOtpErrorBorders(false);

      try {
        const result = await verifyOtp(phone, submittedCode);

        if (
          !isMountedRef.current ||
          verificationRequestRef.current !== requestId
        ) {
          return;
        }

        if (result.ok) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => undefined);
          void saveSessionPhone(phone).catch(() => undefined);
          void ensureSecureReportSession().catch(() => undefined);

          // If the patient lookup itself fails, fail open to onboarding
          // rather than stranding a verified user on this screen.
          const patientExists = await checkPatientExists(phone).catch(
            () => false,
          );

          if (patientExists) {
            router.replace({ params: { phone }, pathname: '/home' });
          } else {
            router.replace({
              params: { phone },
              pathname: '/add-patient-details',
            });
          }
          return;
        }

        rejectSubmittedCode();
      } catch {
        if (
          isMountedRef.current &&
          verificationRequestRef.current === requestId
        ) {
          rejectSubmittedCode();
        }
      } finally {
        if (verificationRequestRef.current === requestId) {
          isVerifyingRef.current = false;
          if (isMountedRef.current) {
            setIsVerifying(false);
          }
        }
      }
    },
    [phone, rejectSubmittedCode, router],
  );

  const handleResend = async () => {
    if (
      secondsRemaining > 0 ||
      isResendingRef.current ||
      isVerifyingRef.current ||
      isRejectingRef.current
    ) {
      return;
    }

    const requestId = resendRequestRef.current + 1;
    resendRequestRef.current = requestId;
    isResendingRef.current = true;
    setIsResending(true);
    setResendFailed(false);

    try {
      await sendOtp(phone);

      if (
        !isMountedRef.current ||
        resendRequestRef.current !== requestId
      ) {
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
      startCountdown();
      setShowCodeSent(true);

      if (codeSentTimerRef.current) {
        clearTimeout(codeSentTimerRef.current);
      }
      codeSentTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setShowCodeSent(false);
        }
      }, CODE_SENT_VISIBLE_MS);
    } catch {
      if (
        isMountedRef.current &&
        resendRequestRef.current === requestId
      ) {
        setResendFailed(true);
        codeSentTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setResendFailed(false);
          }
        }, CODE_SENT_VISIBLE_MS);
      }
    } finally {
      if (resendRequestRef.current === requestId) {
        isResendingRef.current = false;
        if (isMountedRef.current) {
          setIsResending(false);
        }
      }
    }
  };

  const otpLead = copy.otpSentTo.replace(
    '{length}',
    String(OTP_LENGTH),
  );
  const formattedPhone = formatPhone(phone);
  const controlsDisabled = isVerifying || isRejecting || isResending;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const otpSubtitle = (
    <>
      <Text style={styles.otpLead}>
        {otpLead}{' '}
        <Text style={styles.phoneText}>{formattedPhone}</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={spacing.xs}
        onPress={handleBack}
        testID="change-number-button"
      >
        <Text style={styles.changeNumber}>{copy.changeNumber}</Text>
      </Pressable>
    </>
  );

  if (!INDIAN_PHONE_PATTERN.test(phone)) {
    return null;
  }

  return (
    <AuthScaffold onBack={handleBack}>
      <BrandHeader subtitle={otpSubtitle} />

      <View style={styles.form}>
        <OtpInput
          disabled={controlsDisabled}
          errorMessage={hasOtpError ? copy.wrongCode : undefined}
          hasError={showOtpErrorBorders}
          onChangeText={handleCodeChange}
          onComplete={handleVerify}
          ref={otpInputRef}
          shakeTrigger={shakeTrigger}
          value={code}
        />
        <PrimaryButton
          accessibilityLabel={copy.verify}
          disabled={code.length !== OTP_LENGTH || controlsDisabled}
          label={copy.verify}
          loading={isVerifying}
          onPress={() => handleVerify(code)}
          testID="verify-button"
        />
      </View>

      <View style={styles.resendSlot}>
        {resendFailed ? (
          <Text accessibilityRole="alert" style={styles.resendError}>
            {copy.sendCodeError}
          </Text>
        ) : showCodeSent ? (
          <Text accessibilityRole="alert" style={styles.codeSent}>
            {copy.codeSent}
          </Text>
        ) : secondsRemaining > 0 ? (
          <Text style={styles.resendMuted}>
            {copy.resendIn} 0:{String(secondsRemaining).padStart(2, '0')}
          </Text>
        ) : isResending ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Pressable
            accessibilityState={{ disabled: controlsDisabled }}
            accessibilityRole="button"
            disabled={controlsDisabled}
            hitSlop={spacing.sm}
            onPress={handleResend}
            testID="resend-button"
          >
            <Text style={styles.resendLink}>{copy.resend}</Text>
          </Pressable>
        )}
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  otpLead: {
    ...typography.subtitle,
    color: colors.textMuted,
    textAlign: 'center',
    width: '100%',
  },
  phoneText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
  changeNumber: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  resendSlot: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  resendMuted: {
    ...typography.helper,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  resendLink: {
    ...typography.helper,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  codeSent: {
    ...typography.helper,
    color: colors.success,
    fontFamily: fonts.semiBold,
  },
  resendError: {
    ...typography.helper,
    color: colors.error,
    textAlign: 'center',
  },
});
