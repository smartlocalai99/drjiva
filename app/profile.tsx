import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import type {
  ImagePickerAsset,
  ImagePickerOptions,
} from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicineToggle } from '../src/components/dashboard/MedicineToggle';
import { ProfileAvatarFallback } from '../src/components/ProfileAvatarFallback';
import { AgePicker } from '../src/components/profile/AgePicker';
import { PressableScale } from '../src/components/PressableScale';
import { VerifiedBadge } from '../src/components/VerifiedBadge';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import {
  clearPatientProfilePhoto,
  getPatientByPhone,
  updatePatientProfile,
  updatePatientProfilePhoto,
} from '../src/lib/patients';
import {
  getCachedPatientName,
  saveCachedAvatarUrl,
  saveCachedPatientName,
} from '../src/lib/session';
import { isNativeModuleAvailable } from '../src/lib/nativeModuleAvailability';
import {
  deleteProfilePhoto,
  saveProfilePhotoReliably,
  uploadProfilePhoto,
  validateProfilePhoto,
} from '../src/lib/profilePhotos';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [savedAt, setSavedAt] = useState<number | undefined>();
  const [photoWasSaved, setPhotoWasSaved] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<
    'female' | 'male' | 'other' | null
  >(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [pendingPhoto, setPendingPhoto] =
    useState<ImagePickerAsset | null>(null);
  const [isAgePickerVisible, setIsAgePickerVisible] = useState(false);
  const recoveredPickerResultHandled = useRef(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl, pendingPhoto?.uri]);

  useEffect(() => {
    if (!phone) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadPatient = async () => {
      const cachedName = await getCachedPatientName(phone).catch(() => null);
      if (!cancelled && cachedName) {
        setName(cachedName);
      }

      try {
        const patient = await getPatientByPhone(phone);
        if (cancelled || !patient) {
          return;
        }
        setName(patient.name);
        setAge(patient.age != null ? String(patient.age) : '');
        setGender(
          patient.gender === 'female' ||
            patient.gender === 'male' ||
            patient.gender === 'other'
            ? patient.gender
            : null,
        );
        setPatientId(patient.patientId);
        setAvatarUrl(patient.avatarUrl);
        void saveCachedPatientName(phone, patient.name).catch(
          () => undefined,
        );
      } catch {
        // Keep any cached name visible if the profile refresh fails.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPatient();

    return () => {
      cancelled = true;
    };
  }, [phone]);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length >= 2;
  const parsedAge = age.trim() ? Number.parseInt(age, 10) : null;
  const isAgeValid =
    parsedAge === null ||
    (!Number.isNaN(parsedAge) && parsedAge >= 1 && parsedAge <= 120);

  const saveSelectedProfilePhoto = useCallback(
    async (asset: ImagePickerAsset) => {
      if (!patientId || !phone) {
        setErrorMessage(
          'Your profile is still loading. The photo could not be saved yet.',
        );
        return;
      }

      const previousAvatarUrl = avatarUrl;
      setPendingPhoto(asset);
      setIsSavingPhoto(true);
      setPhotoWasSaved(false);
      setErrorMessage(undefined);

      try {
        const savedAvatarUrl = await saveProfilePhotoReliably({
          discard: (uploadedUrl) =>
            deleteProfilePhoto(patientId, uploadedUrl),
          persist: async (uploadedUrl) => {
            const patient = await updatePatientProfilePhoto(
              phone,
              uploadedUrl,
            );
            return patient.avatarUrl;
          },
          upload: () => uploadProfilePhoto(patientId, asset),
          verify: async () => {
            const patient = await getPatientByPhone(phone);
            return patient?.avatarUrl ?? null;
          },
        });

        await saveCachedAvatarUrl(phone, savedAvatarUrl).catch(
          () => undefined,
        );
        setAvatarUrl(savedAvatarUrl);
        setPendingPhoto(null);
        setPhotoWasSaved(true);

        if (previousAvatarUrl && previousAvatarUrl !== savedAvatarUrl) {
          void deleteProfilePhoto(patientId, previousAvatarUrl).catch(
            () => undefined,
          );
        }
      } catch (error) {
        console.error('Unable to save profile photo', error);
        setErrorMessage(
          'The photo could not be saved after automatic retries. Please check your connection.',
        );
      } finally {
        setIsSavingPhoto(false);
      }
    },
    [avatarUrl, patientId, phone],
  );

  const selectProfilePhoto = async (source: 'camera' | 'gallery') => {
    try {
      if (!isNativeModuleAvailable('ExponentImagePicker')) {
        Alert.alert(
          'App update required',
          'Profile photos require a rebuilt DrJiva development or production app.',
        );
        return;
      }

      const ImagePicker = await import('expo-image-picker');
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Permission needed',
            'Allow camera access to take a profile photo.',
          );
          return;
        }
      }

      const options: ImagePickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 0.85,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        return;
      }

      const validationMessage = validateProfilePhoto(asset);
      if (validationMessage) {
        Alert.alert(
          'Photo not supported',
          validationMessage,
        );
        return;
      }

      await saveSelectedProfilePhoto(asset);
    } catch {
      Alert.alert(
        'Unable to open photos',
        'Please try again or choose the other photo source.',
      );
    }
  };

  useEffect(() => {
    if (
      !patientId ||
      recoveredPickerResultHandled.current ||
      !isNativeModuleAvailable('ExponentImagePicker')
    ) {
      return;
    }

    recoveredPickerResultHandled.current = true;
    let cancelled = false;

    void import('expo-image-picker')
      .then(async (ImagePicker) => {
        const recoveredResult = await ImagePicker.getPendingResultAsync();
        if (!recoveredResult || cancelled) {
          return;
        }
        if ('code' in recoveredResult) {
          throw new Error(recoveredResult.message);
        }
        if (recoveredResult.canceled) {
          return;
        }

        const recoveredAsset = recoveredResult.assets[0];
        if (!recoveredAsset) {
          return;
        }
        const validationMessage = validateProfilePhoto(recoveredAsset);
        if (validationMessage) {
          setErrorMessage(validationMessage);
          return;
        }

        await saveSelectedProfilePhoto(recoveredAsset);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Unable to recover selected profile photo', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, saveSelectedProfilePhoto]);

  const removeStoredProfilePhoto = async () => {
    if (
      !avatarUrl ||
      !patientId ||
      isRemovingPhoto ||
      isSaving ||
      isSavingPhoto
    ) {
      return;
    }

    setIsRemovingPhoto(true);
    setErrorMessage(undefined);
    try {
      await deleteProfilePhoto(patientId, avatarUrl);
      await clearPatientProfilePhoto(phone);
      await saveCachedAvatarUrl(phone, null).catch(() => undefined);
      setAvatarUrl(null);
      setPendingPhoto(null);
      setPhotoWasSaved(false);
      setSavedAt(undefined);
    } catch (error) {
      console.error('Unable to remove profile photo', error);
      setErrorMessage(
        'Unable to remove your profile photo. Please try again.',
      );
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    if (pendingPhoto) {
      setPendingPhoto(null);
      setPhotoWasSaved(false);
      setSavedAt(undefined);
      return;
    }
    if (!avatarUrl) {
      return;
    }

    Alert.alert(
      'Remove profile photo?',
      'This permanently deletes the photo from your profile and cloud storage.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void removeStoredProfilePhoto(),
          style: 'destructive',
          text: 'Remove photo',
        },
      ],
    );
  };

  const showPhotoOptions = () => {
    Alert.alert('Profile photo', 'Choose a photo source.', [
      {
        onPress: () => {
          setTimeout(() => void selectProfilePhoto('camera'), 250);
        },
        text: 'Camera',
      },
      {
        onPress: () => {
          setTimeout(() => void selectProfilePhoto('gallery'), 250);
        },
        text: 'Gallery',
      },
      ...(pendingPhoto
        ? [
            {
              onPress: () => {
                setTimeout(
                  () => void saveSelectedProfilePhoto(pendingPhoto),
                  250,
                );
              },
              text: 'Retry saving photo',
            },
            {
              onPress: handleRemovePhoto,
              style: 'destructive' as const,
              text: 'Discard selected photo',
            },
          ]
        : avatarUrl
          ? [
              {
                onPress: () => {
                  setTimeout(handleRemovePhoto, 250);
                },
                style: 'destructive' as const,
                text: 'Remove photo',
              },
            ]
          : []),
      { style: 'cancel', text: 'Cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!isNameValid || !isAgeValid || isSaving || isSavingPhoto) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(undefined);

    try {
      const patient = await updatePatientProfile(phone, {
        age: parsedAge,
        gender,
        name: trimmedName,
      });
      await saveCachedPatientName(phone, patient.name).catch(() => undefined);
      setSavedAt(Date.now());
    } catch (error) {
      console.error('Unable to save profile changes', error);
      setErrorMessage('Unable to save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.avatarCard}>
              <Pressable
                accessibilityHint="Opens options to take, choose, or remove a photo"
                accessibilityLabel="Change profile photo"
                accessibilityRole="button"
                disabled={isRemovingPhoto || isSaving || isSavingPhoto}
                onPress={showPhotoOptions}
                style={styles.avatarButton}
              >
                <View style={styles.avatar}>
                  {(pendingPhoto?.uri || avatarUrl) && !avatarFailed ? (
                    <Image
                      contentFit="cover"
                      onError={() => setAvatarFailed(true)}
                      source={{ uri: pendingPhoto?.uri ?? avatarUrl ?? '' }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <ProfileAvatarFallback size={68} />
                  )}
                </View>
                <View style={styles.cameraBadge}>
                  {isRemovingPhoto || isSavingPhoto ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons color="#FFFFFF" name="camera" size={15} />
                  )}
                </View>
              </Pressable>
              <Text style={styles.avatarName}>{name || 'Your name'}</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.phoneText}>+91 {phone}</Text>
                <VerifiedBadge />
              </View>
              {isSavingPhoto ? (
                <Text style={styles.photoStatus}>Saving photo…</Text>
              ) : photoWasSaved ? (
                <Text style={styles.photoStatusSaved}>Photo saved ✓</Text>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>Personal Details</Text>
            <View style={styles.card}>
              <Field label="Name">
                <TextInput
                  onChangeText={(value) => {
                    setName(value);
                    setSavedAt(undefined);
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor={dashboardColors.textFaint}
                  style={styles.input}
                  value={name}
                />
              </Field>

              <Divider />

              <Field label="Age">
                <Pressable
                  accessibilityLabel="Select age"
                  accessibilityRole="button"
                  onPress={() => setIsAgePickerVisible(true)}
                  style={styles.ageRow}
                >
                  <Text
                    style={[
                      styles.input,
                      !age && { color: dashboardColors.textFaint },
                    ]}
                  >
                    {age || 'Add your age'}
                  </Text>
                  <Ionicons
                    color={dashboardColors.textFaint}
                    name="chevron-down"
                    size={18}
                  />
                </Pressable>
              </Field>

              <Divider />

              <View style={styles.fieldColumn}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setGender(option.value);
                        setSavedAt(undefined);
                      }}
                      style={[
                        styles.genderChip,
                        gender === option.value && styles.genderChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          gender === option.value &&
                            styles.genderChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
            {!isAgeValid ? (
              <Text style={styles.errorText}>
                Enter an age between 1 and 120.
              </Text>
            ) : null}

            <PressableScale
              accessibilityLabel="Save changes"
              disabled={
                !isNameValid || !isAgeValid || isSaving || isSavingPhoto
              }
              onPress={handleSave}
              pressedScale={0.98}
              style={[
                styles.saveButton,
                (!isNameValid ||
                  !isAgeValid ||
                  isSaving ||
                  isSavingPhoto) &&
                  styles.saveButtonDisabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {savedAt ? 'Saved ✓' : 'Save changes'}
                </Text>
              )}
            </PressableScale>

            <Text style={styles.sectionLabel}>Preferences</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Ionicons
                  color={dashboardColors.text}
                  name="notifications-outline"
                  size={20}
                />
                <Text style={styles.rowLabel}>Notifications</Text>
                <View style={styles.rowSpacer} />
                <MedicineToggle
                  onValueChange={() => setNotificationsEnabled((v) => !v)}
                  value={notificationsEnabled}
                />
              </View>
              <Divider />
              <Pressable
                onPress={() => Alert.alert('Language', 'Coming soon.')}
                style={styles.row}
              >
                <Ionicons color={dashboardColors.text} name="language-outline" size={20} />
                <Text style={styles.rowLabel}>Language</Text>
                <View style={styles.rowSpacer} />
                <Text style={styles.rowValue}>English</Text>
                <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={18} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Support</Text>
            <View style={styles.card}>
              <Pressable
                onPress={() => Alert.alert('Help Center', 'Coming soon.')}
                style={styles.row}
              >
                <Ionicons
                  color={dashboardColors.text}
                  name="help-circle-outline"
                  size={20}
                />
                <Text style={styles.rowLabel}>Help Center</Text>
                <View style={styles.rowSpacer} />
                <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={18} />
              </Pressable>
              <Divider />
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'About DrJiva',
                    `Version ${Constants.expoConfig?.version ?? '1.0.0'}`,
                  )
                }
                style={styles.row}
              >
                <Ionicons
                  color={dashboardColors.text}
                  name="information-circle-outline"
                  size={20}
                />
                <Text style={styles.rowLabel}>About DrJiva</Text>
                <View style={styles.rowSpacer} />
                <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={18} />
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <AgePicker
        onClose={() => setIsAgePickerVisible(false)}
        onSelect={(selectedAge) => {
          setAge(String(selectedAge));
          setSavedAt(undefined);
          setIsAgePickerVisible(false);
        }}
        value={parsedAge}
        visible={isAgePickerVisible}
      />
    </SafeAreaView>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.fieldColumn}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingBottom: dashboardSpacing.xxl,
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  avatarCard: {
    alignItems: 'center',
    marginTop: dashboardSpacing.sm,
    marginBottom: dashboardSpacing.xl,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: '#CBD5E1',
    borderRadius: 40,
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    padding: 4,
    width: 80,
  },
  avatarButton: {
    marginBottom: dashboardSpacing.sm,
    position: 'relative',
  },
  avatarImage: {
    borderRadius: 34,
    height: 68,
    width: 68,
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.text,
    borderColor: dashboardColors.card,
    borderRadius: 14,
    borderWidth: 2,
    bottom: -2,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 28,
  },
  avatarName: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  phoneRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  phoneText: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  photoStatus: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.xs,
  },
  photoStatusSaved: {
    ...dashboardTypography.caption,
    color: dashboardColors.success,
    fontFamily: 'Inter_600SemiBold',
    marginTop: dashboardSpacing.xs,
  },
  sectionLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginBottom: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    paddingHorizontal: dashboardSpacing.gap,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  fieldColumn: {
    paddingVertical: dashboardSpacing.md,
  },
  fieldLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginBottom: 4,
  },
  input: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 16,
    padding: 0,
  },
  ageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderRow: {
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginTop: 4,
  },
  genderChip: {
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.pill,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 8,
  },
  genderChipActive: {
    backgroundColor: dashboardColors.primaryTint,
  },
  genderChipText: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    fontSize: 14,
  },
  genderChipTextActive: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    backgroundColor: dashboardColors.track,
    height: 1,
  },
  errorText: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    height: 52,
    justifyContent: 'center',
    marginTop: dashboardSpacing.gap,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    paddingVertical: 14,
  },
  rowLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 15,
  },
  rowSpacer: {
    flex: 1,
  },
  rowValue: {
    ...dashboardTypography.body,
    color: dashboardColors.textFaint,
    fontSize: 14,
    marginRight: 4,
  },
});
