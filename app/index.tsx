import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScaffold } from '../src/components/AuthScaffold';
import { BrandHeader } from '../src/components/BrandHeader';
import {
  isValidIndianPhone,
  PhoneInput,
} from '../src/components/PhoneInput';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { TermsCheckbox } from '../src/components/TermsCheckbox';
import { copy } from '../src/copy';
import {
  claimHospitalMedicineCourses,
  linkPatientDevice,
} from '../src/lib/hospitalMedicineClaims';
import { checkPatientExists } from '../src/lib/patients';
import { ensureSecureReportSession } from '../src/lib/reportAuth';
import {
  getCachedPatientName,
  getSessionPhone,
  hasAcceptedTerms,
  saveSessionPhone,
  saveTermsAccepted,
} from '../src/lib/session';
import { recordTermsAcceptance } from '../src/lib/termsAcceptance';
import { colors, fonts, spacing } from '../src/theme';

const SESSION_LOOKUP_TIMEOUT_MS = 1200;

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const isMountedRef = useRef(true);
  const otpNavigationStartedRef = useRef(false);
  const isValid = isValidIndianPhone(phone);
  const canContinue = isValid && termsAccepted;

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
      const [sessionPhone, termsAlreadyAccepted] = await Promise.all([
        getSessionPhone().catch(() => null),
        hasAcceptedTerms().catch(() => false),
      ]);

      if (!sessionPhone || !isValidIndianPhone(sessionPhone)) {
        if (isMountedRef.current) {
          setIsCheckingSession(false);
        }
        return;
      }

      // Returning users who signed in before the Terms of Use gate shipped
      // haven't agreed yet — show the form pre-filled with their number
      // instead of silently resuming, so everyone ends up with terms on file.
      if (!termsAlreadyAccepted) {
        if (isMountedRef.current) {
          setPhone(sessionPhone.replace(/\D/g, '').slice(-10));
          setIsCheckingSession(false);
        }
        return;
      }

      const normalizedSessionPhone = sessionPhone.replace(/\D/g, '').slice(-10);
      const claimPromise = ensureSecureReportSession()
        .then(() =>
          Promise.all([
            linkPatientDevice(normalizedSessionPhone),
            claimHospitalMedicineCourses(normalizedSessionPhone),
          ]),
        )
        .catch(() => undefined);
      const cachedPatientName = await getCachedPatientName(
        normalizedSessionPhone,
      ).catch(() => null);

      if (!isMountedRef.current) {
        return;
      }

      if (cachedPatientName) {
        await Promise.race([
          claimPromise,
          new Promise((resolve) => {
            setTimeout(resolve, SESSION_LOOKUP_TIMEOUT_MS);
          }),
        ]);
        if (!isMountedRef.current) {
          return;
        }
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
      await Promise.race([
        claimPromise,
        new Promise((resolve) => {
          setTimeout(resolve, SESSION_LOOKUP_TIMEOUT_MS);
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
    if (
      !isValidIndianPhone(submittedPhone) ||
      !termsAccepted ||
      otpNavigationStartedRef.current
    ) {
      return;
    }
    otpNavigationStartedRef.current = true;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );

    const mobile = submittedPhone.replace(/\D/g, '').slice(-10);
    void saveSessionPhone(mobile).catch(() => undefined);
    void saveTermsAccepted().catch(() => undefined);
    void recordTermsAcceptance();

    void Promise.allSettled([
      ensureSecureReportSession().then(() =>
        Promise.all([
          linkPatientDevice(mobile),
          claimHospitalMedicineCourses(mobile),
        ]),
      ),
      checkPatientExists(mobile).catch(() => false),
    ]).then(([, patientExistsResult]) => {
      const patientExists =
        patientExistsResult.status === 'fulfilled' &&
        patientExistsResult.value;
      router.replace({
        params: { phone: mobile },
        pathname: patientExists ? '/home' : '/add-patient-details',
      });
    });
  }, [router, termsAccepted]);

  useEffect(() => {
    if (canContinue) {
      submitPhone(phone);
    }
  }, [canContinue, phone, submitPhone]);

  const handleContinue = () => {
    submitPhone(phone);
  };

  const handleBrowseAsGuest = () => {
    router.push('/shop');
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
        <TermsCheckbox accepted={termsAccepted} onToggle={setTermsAccepted} />
        <PrimaryButton
          accessibilityLabel={copy.continue}
          disabled={!canContinue}
          label={copy.continue}
          onPress={handleContinue}
          testID="continue-button"
        />
        <Pressable
          accessibilityLabel="Browse products without signing in"
          accessibilityRole="button"
          hitSlop={spacing.sm}
          onPress={handleBrowseAsGuest}
          style={styles.guestLink}
          testID="browse-as-guest"
        >
          <Text style={styles.guestLinkText}>
            Browse products without signing in
          </Text>
        </Pressable>
      </View>
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
  guestLink: {
    alignItems: 'center',
    minHeight: 32,
    paddingVertical: spacing.xs,
  },
  guestLinkText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
