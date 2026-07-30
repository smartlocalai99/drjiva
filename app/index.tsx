import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { checkPatientExists } from '../src/lib/patients';
import { ensureSecureReportSession } from '../src/lib/reportAuth';
import {
  getCachedPatientName,
  getSessionPhone,
  saveSessionPhone,
} from '../src/lib/session';
import { colors, spacing, typography } from '../src/theme';

const SESSION_LOOKUP_TIMEOUT_MS = 1200;

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const isMountedRef = useRef(true);
  const otpNavigationStartedRef = useRef(false);
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

      const normalizedSessionPhone = sessionPhone.replace(/\D/g, '').slice(-10);
      const cachedPatientName = await getCachedPatientName(
        normalizedSessionPhone,
      ).catch(() => null);

      if (!isMountedRef.current) {
        return;
      }

      if (cachedPatientName) {
        router.replace({
          params: { phone: normalizedSessionPhone },
          pathname: '/home',
        });
        return;
      }

      const exists = await Promise.race<boolean | null>([
        checkPatientExists(sessionPhone).catch(() => null),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), SESSION_LOOKUP_TIMEOUT_MS);
        }),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      router.replace({
        params: { phone: normalizedSessionPhone },
        pathname:
          exists === false ? '/add-patient-details' : '/home',
      });
    })();
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      otpNavigationStartedRef.current = false;
    }, []),
  );

  const handlePhoneChange = (nextPhone: string) => {
    setPhone(nextPhone);
  };

  // OTP verification is temporarily skipped (no real SMS backend checks it
  // yet) — go straight to the same destination a verified OTP would.
  const submitPhone = useCallback((submittedPhone: string) => {
    if (!isValidIndianPhone(submittedPhone) || otpNavigationStartedRef.current) {
      return;
    }
    otpNavigationStartedRef.current = true;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );

    const mobile = submittedPhone.replace(/\D/g, '').slice(-10);
    void saveSessionPhone(mobile).catch(() => undefined);
    void ensureSecureReportSession().catch(() => undefined);

    void checkPatientExists(mobile)
      .catch(() => false)
      .then((patientExists) => {
        router.replace({
          params: { phone: mobile },
          pathname: patientExists ? '/home' : '/add-patient-details',
        });
      });
  }, [router]);

  useEffect(() => {
    if (isValid) {
      submitPhone(phone);
    }
  }, [isValid, phone, submitPhone]);

  const handleContinue = () => {
    submitPhone(phone);
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
          onChangeText={handlePhoneChange}
          testID="phone-input"
          value={phone}
        />
        <PrimaryButton
          accessibilityLabel={copy.continue}
          disabled={!isValid}
          label={copy.continue}
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
