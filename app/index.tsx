import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScaffold } from '../src/components/AuthScaffold';
import { BrandHeader } from '../src/components/BrandHeader';
import {
  isValidIndianPhone,
  PhoneInput,
} from '../src/components/PhoneInput';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { copy } from '../src/copy';
import { sendOtp } from '../src/lib/auth';
import { checkPatientExists } from '../src/lib/patients';
import { getSessionPhone } from '../src/lib/session';
import { colors, spacing, typography } from '../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const isMountedRef = useRef(true);
  const isSendingRef = useRef(false);
  const isValid = isValidIndianPhone(phone);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stay logged in across restarts until the user explicitly logs out —
  // resume straight to Home (or finish onboarding) instead of showing login.
  useEffect(() => {
    (async () => {
      const sessionPhone = await getSessionPhone().catch(() => null);

      if (!sessionPhone || !isValidIndianPhone(sessionPhone)) {
        if (isMountedRef.current) {
          setIsCheckingSession(false);
        }
        return;
      }

      const exists = await checkPatientExists(sessionPhone).catch(() => null);

      if (!isMountedRef.current) {
        return;
      }

      if (exists === null) {
        setIsCheckingSession(false);
        return;
      }

      router.replace({
        params: { phone: sessionPhone },
        pathname: exists ? '/home' : '/add-patient-details',
      });
    })();
  }, [router]);

  const handlePhoneChange = (nextPhone: string) => {
    setSendError(undefined);
    setPhone(nextPhone);
  };

  const submitPhone = useCallback(async (submittedPhone: string) => {
    if (
      !isValidIndianPhone(submittedPhone) ||
      isSendingRef.current
    ) {
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);
    setSendError(undefined);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );

    try {
      await sendOtp(submittedPhone);
      if (isMountedRef.current) {
        router.push({
          pathname: '/otp',
          params: { phone: submittedPhone },
        });
      }
    } catch {
      if (isMountedRef.current) {
        setSendError(copy.sendCodeError);
      }
    } finally {
      isSendingRef.current = false;
      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  }, [router]);

  useEffect(() => {
    if (isValid) {
      void submitPhone(phone);
    }
  }, [isValid, phone, submitPhone]);

  const handleContinue = () => {
    void submitPhone(phone);
  };

  if (isCheckingSession) {
    return null;
  }

  return (
    <AuthScaffold>
      <View style={styles.brandHeader}>
        <BrandHeader rotateTelugu />
      </View>

      <View style={styles.form}>
        <PhoneInput
          disabled={isSending}
          errorMessage={sendError}
          onChangeText={handlePhoneChange}
          testID="phone-input"
          value={phone}
        />
        <PrimaryButton
          accessibilityLabel={copy.continue}
          disabled={!isValid || isSending}
          label={copy.continue}
          loading={isSending}
          onPress={handleContinue}
          testID="continue-button"
        />
      </View>

      <Text style={styles.legal}>{copy.legal}</Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    paddingTop: spacing.xl,
    width: '100%',
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  legal: {
    ...typography.helper,
    color: colors.textMuted,
    marginTop: spacing.md,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
});
