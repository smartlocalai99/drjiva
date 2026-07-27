import { Ionicons } from '@expo/vector-icons';
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

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { loadAddresses, saveAddresses } from '../src/lib/addressStorage';
import {
  normalizeAddress,
  upsertAddress,
  validateAddress,
  type AddressDraft,
  type AddressErrors,
  type AddressLabel,
  type SavedAddress,
} from '../src/lib/addresses';

const LABELS: {
  icon: keyof typeof Ionicons.glyphMap;
  value: AddressLabel;
}[] = [
  { icon: 'home-outline', value: 'Home' },
  { icon: 'briefcase-outline', value: 'Work' },
  { icon: 'location-outline', value: 'Other' },
];

function createEmptyDraft(phone: string): AddressDraft {
  return {
    area: '',
    building: '',
    city: '',
    customLabel: '',
    label: 'Home',
    landmark: '',
    phone,
    pinCode: '',
    recipientName: '',
    state: '',
  };
}

export default function AddressEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    addressId?: string | string[];
    phone?: string | string[];
  }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const addressIdParam = Array.isArray(params.addressId)
    ? params.addressId[0]
    : params.addressId;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const addressId = addressIdParam || undefined;

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [draft, setDraft] = useState<AddressDraft>(() =>
    createEmptyDraft(phone),
  );
  const [errors, setErrors] = useState<AddressErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const storedAddresses = await loadAddresses(phone);
        if (cancelled) {
          return;
        }

        setAddresses(storedAddresses);
        if (addressId) {
          const existing = storedAddresses.find(
            (address) => address.id === addressId,
          );
          if (!existing) {
            Alert.alert('Address not found', 'This saved address is unavailable.', [
              { onPress: () => router.back(), text: 'Go back' },
            ]);
            return;
          }
          const { id: _id, isDefault: _isDefault, ...addressDraft } = existing;
          setDraft(addressDraft);
        }
      } catch {
        Alert.alert(
          'Unable to load addresses',
          'Please go back and try again.',
          [{ onPress: () => router.back(), text: 'Go back' }],
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [addressId, phone, router]);

  const updateField = <Key extends keyof AddressDraft>(
    key: Key,
    value: AddressDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const nextErrors = validateAddress(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    const id =
      addressId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextAddress = normalizeAddress(draft, id);

    try {
      await saveAddresses(phone, upsertAddress(addresses, nextAddress));
      router.back();
    } catch {
      Alert.alert(
        'Unable to save address',
        'Please check your connection and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {addressId ? 'Edit Address' : 'Add Address'}
        </Text>
        <View style={styles.headerSide} />
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
            <Text style={styles.sectionTitle}>Save address as</Text>
            <View style={styles.labelRow}>
              {LABELS.map(({ icon, value }) => {
                const selected = draft.label === value;
                return (
                  <PressableScale
                    accessibilityState={{ selected }}
                    key={value}
                    onPress={() => updateField('label', value)}
                    pressedScale={0.96}
                    style={[styles.labelChip, selected && styles.labelChipActive]}
                  >
                    <Ionicons
                      color={
                        selected
                          ? dashboardColors.primary
                          : dashboardColors.textMuted
                      }
                      name={icon}
                      size={18}
                    />
                    <Text
                      style={[
                        styles.labelChipText,
                        selected && styles.labelChipTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {draft.label === 'Other' ? (
              <AddressField
                error={errors.customLabel}
                label="Address label"
                onChangeText={(value) => updateField('customLabel', value)}
                placeholder="Parents' home, Clinic..."
                value={draft.customLabel}
              />
            ) : null}

            <Text style={styles.sectionTitle}>Contact details</Text>
            <View style={styles.formCard}>
              <AddressField
                autoCapitalize="words"
                error={errors.recipientName}
                label="Recipient name"
                onChangeText={(value) => updateField('recipientName', value)}
                placeholder="Full name"
                value={draft.recipientName}
              />
              <Divider />
              <AddressField
                error={errors.phone}
                keyboardType="phone-pad"
                label="Phone number"
                maxLength={14}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="10-digit mobile number"
                value={draft.phone}
              />
            </View>

            <Text style={styles.sectionTitle}>Address details</Text>
            <View style={styles.formCard}>
              <AddressField
                autoCapitalize="words"
                error={errors.building}
                label="House, flat or building"
                onChangeText={(value) => updateField('building', value)}
                placeholder="Flat 302, Lotus Heights"
                value={draft.building}
              />
              <Divider />
              <AddressField
                autoCapitalize="words"
                error={errors.area}
                label="Street or area"
                onChangeText={(value) => updateField('area', value)}
                placeholder="Road name, area or locality"
                value={draft.area}
              />
              <Divider />
              <AddressField
                autoCapitalize="words"
                label="Landmark (optional)"
                onChangeText={(value) => updateField('landmark', value)}
                placeholder="Near hospital, school..."
                value={draft.landmark}
              />
              <Divider />
              <AddressField
                autoCapitalize="words"
                error={errors.city}
                label="City"
                onChangeText={(value) => updateField('city', value)}
                placeholder="Hyderabad"
                value={draft.city}
              />
              <Divider />
              <View style={styles.splitRow}>
                <View style={styles.splitField}>
                  <AddressField
                    autoCapitalize="words"
                    error={errors.state}
                    label="State"
                    onChangeText={(value) => updateField('state', value)}
                    placeholder="Telangana"
                    value={draft.state}
                  />
                </View>
                <View style={styles.splitDivider} />
                <View style={styles.splitField}>
                  <AddressField
                    error={errors.pinCode}
                    keyboardType="number-pad"
                    label="PIN code"
                    maxLength={6}
                    onChangeText={(value) =>
                      updateField('pinCode', value.replace(/\D/g, ''))
                    }
                    placeholder="500001"
                    value={draft.pinCode}
                  />
                </View>
              </View>
            </View>

            <PressableScale
              accessibilityLabel={addressId ? 'Update address' : 'Save address'}
              disabled={isSaving}
              onPress={handleSave}
              pressedScale={0.98}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons color="#FFFFFF" name="checkmark" size={20} />
                  <Text style={styles.saveButtonText}>
                    {addressId ? 'Update Address' : 'Save Address'}
                  </Text>
                </>
              )}
            </PressableScale>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function AddressField({
  error,
  label,
  ...inputProps
}: {
  error?: string;
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={dashboardColors.textFaint}
        style={styles.input}
        {...inputProps}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
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
  headerSide: {
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
  sectionTitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginBottom: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
    textTransform: 'uppercase',
  },
  labelRow: {
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
  },
  labelChip: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: dashboardSpacing.md,
  },
  labelChipActive: {
    backgroundColor: dashboardColors.primaryTint,
    borderColor: dashboardColors.primary,
  },
  labelChipText: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  labelChipTextActive: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  formCard: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    paddingHorizontal: dashboardSpacing.gap,
  },
  field: {
    paddingVertical: dashboardSpacing.md,
  },
  fieldLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginBottom: 5,
  },
  input: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 16,
    padding: 0,
  },
  fieldError: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
    marginTop: 5,
  },
  divider: {
    backgroundColor: dashboardColors.track,
    height: 1,
  },
  splitRow: {
    flexDirection: 'row',
  },
  splitField: {
    flex: 1,
  },
  splitDivider: {
    backgroundColor: dashboardColors.track,
    marginHorizontal: dashboardSpacing.md,
    width: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    height: 56,
    justifyContent: 'center',
    marginTop: dashboardSpacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
});
