import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidIndianPhone } from '../src/components/PhoneInput';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { copy } from '../src/copy';
import { createPatient } from '../src/lib/patients';
import { saveCachedPatientName } from '../src/lib/session';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../src/theme';

const illustrationSource = require('../assets/namefield.png');
const ILLUSTRATION_ASPECT_RATIO = 1024 / 1536;
const MIN_NAME_LENGTH = 2;

export default function AddPatientDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length >= MIN_NAME_LENGTH;

  useEffect(() => {
    if (!isValidIndianPhone(phone)) {
      router.replace('/');
    }
  }, [phone, router]);

  const handleChangeName = (nextName: string) => {
    if (errorMessage) {
      setErrorMessage(undefined);
    }
    setName(nextName);
  };

  const handleSubmit = async () => {
    if (!isNameValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(undefined);

    try {
      const patient = await createPatient(phone, trimmedName);
      await saveCachedPatientName(phone, patient.name).catch(() => undefined);
      router.replace({ params: { phone }, pathname: '/home' });
    } catch {
      setErrorMessage(copy.createPatientError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isValidIndianPhone(phone)) {
    return null;
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Image
            accessibilityLabel="Pill bottle illustration"
            cachePolicy="memory-disk"
            contentFit="contain"
            source={illustrationSource}
            style={styles.illustration}
          />

          <Text accessibilityRole="header" style={styles.headline}>
            {copy.onboardingHeadline}
          </Text>
          <Text style={styles.subtitle}>{copy.onboardingSubtitle}</Text>

          <View style={styles.form}>
            <View style={[styles.inputContainer, errorMessage && styles.inputContainerError]}>
              <TextInput
                accessibilityLabel="Your name"
                autoCapitalize="words"
                autoComplete="off"
                editable={!isSubmitting}
                importantForAutofill="no"
                onChangeText={handleChangeName}
                placeholder={copy.namePlaceholder}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.input}
                testID="name-input"
                textContentType="none"
                value={name}
              />
            </View>
            <View style={styles.helperSlot}>
              <Text
                accessibilityRole={errorMessage ? 'alert' : undefined}
                style={styles.helper}
              >
                {errorMessage ?? ' '}
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <PrimaryButton
              accessibilityLabel={copy.continue}
              disabled={!isNameValid}
              label={copy.continue}
              loading={isSubmitting}
              onPress={handleSubmit}
              testID="continue-button"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.contentPadding,
    paddingVertical: spacing.xl,
  },
  illustration: {
    aspectRatio: ILLUSTRATION_ASPECT_RATIO,
    width: '60%',
  },
  headline: {
    ...typography.headline,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  form: {
    marginTop: spacing.xl,
    width: '100%',
  },
  inputContainer: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1.5,
    height: layout.inputHeight,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  input: {
    ...typography.input,
    color: colors.text,
    height: '100%',
    padding: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  helperSlot: {
    height: typography.helper.lineHeight + spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  helper: {
    ...typography.helper,
    color: colors.error,
  },
  footer: {
    marginTop: spacing.md,
    width: '100%',
  },
});
