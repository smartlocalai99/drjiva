import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { PressableScale } from '../src/components/PressableScale';
import { VerifiedBadge } from '../src/components/VerifiedBadge';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { getPatientByPhone, updatePatientProfile } from '../src/lib/patients';
import {
  getCachedPatientName,
  saveCachedPatientName,
} from '../src/lib/session';
import {
  uploadProfilePhoto,
  validateProfilePhoto,
} from '../src/lib/profilePhotos';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [savedAt, setSavedAt] = useState<number | undefined>();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState<
    'female' | 'male' | 'other' | null
  >(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

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
        setAddress(patient.address ?? '');
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

  const selectProfilePhoto = async (source: 'camera' | 'gallery') => {
    try {
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

      const options: ImagePicker.ImagePickerOptions = {
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

      setPendingPhoto(asset);
      setSavedAt(undefined);
    } catch {
      Alert.alert(
        'Unable to open photos',
        'Please try again or choose the other photo source.',
      );
    }
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
      { style: 'cancel', text: 'Cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!isNameValid || !isAgeValid || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(undefined);

    try {
      let nextAvatarUrl = avatarUrl;
      if (pendingPhoto) {
        if (!patientId) {
          throw new Error('Patient profile is unavailable.');
        }
        nextAvatarUrl = await uploadProfilePhoto(patientId, pendingPhoto);
      }

      const patient = await updatePatientProfile(phone, {
        address: address.trim() || null,
        age: parsedAge,
        avatar_url: nextAvatarUrl,
        gender,
        name: trimmedName,
      });
      await saveCachedPatientName(phone, patient.name).catch(() => undefined);
      setAvatarUrl(patient.avatarUrl ?? nextAvatarUrl);
      setPendingPhoto(null);
      setSavedAt(Date.now());
    } catch {
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
                accessibilityHint="Opens camera and gallery options"
                accessibilityLabel="Change profile photo"
                accessibilityRole="button"
                onPress={showPhotoOptions}
                style={styles.avatarButton}
              >
                <View style={styles.avatar}>
                  {pendingPhoto?.uri || avatarUrl ? (
                    <Image
                      contentFit="cover"
                      source={{ uri: pendingPhoto?.uri ?? avatarUrl ?? '' }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {getInitials(name || '?')}
                    </Text>
                  )}
                </View>
                <View style={styles.cameraBadge}>
                  <Ionicons color="#FFFFFF" name="camera" size={15} />
                </View>
              </Pressable>
              <Text style={styles.avatarName}>{name || 'Your name'}</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.phoneText}>+91 {phone}</Text>
                <VerifiedBadge />
              </View>
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
                <TextInput
                  keyboardType="number-pad"
                  maxLength={3}
                  onChangeText={(value) => {
                    setAge(value.replace(/\D/g, ''));
                    setSavedAt(undefined);
                  }}
                  placeholder="Add your age"
                  placeholderTextColor={dashboardColors.textFaint}
                  style={styles.input}
                  value={age}
                />
              </Field>

              <Divider />

              <Field label="Address">
                <TextInput
                  multiline
                  onChangeText={(value) => {
                    setAddress(value);
                    setSavedAt(undefined);
                  }}
                  placeholder="Add your address"
                  placeholderTextColor={dashboardColors.textFaint}
                  style={[styles.input, styles.addressInput]}
                  value={address}
                />
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
              disabled={!isNameValid || !isAgeValid || isSaving}
              onPress={handleSave}
              pressedScale={0.98}
              style={[
                styles.saveButton,
                (!isNameValid || !isAgeValid || isSaving) &&
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
    backgroundColor: dashboardColors.primary,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 80,
  },
  avatarButton: {
    marginBottom: dashboardSpacing.sm,
    position: 'relative',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
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
  addressInput: {
    minHeight: 48,
    textAlignVertical: 'top',
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
