import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import {
  loadAddresses,
  saveAddresses,
} from '../src/lib/addressStorage';
import {
  setDefaultAddress,
  type SavedAddress,
} from '../src/lib/addresses';

export default function ShopAddressSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone)
    ? params.phone[0]
    : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingAddressId, setSavingAddressId] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      void loadAddresses(phone)
        .then((nextAddresses) => {
          if (!cancelled) {
            setAddresses(nextAddresses);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAddresses([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [phone]),
  );

  const selectAddress = async (addressId: string) => {
    if (savingAddressId) {
      return;
    }

    const nextAddresses = setDefaultAddress(addresses, addressId);
    setAddresses(nextAddresses);
    setSavingAddressId(addressId);
    try {
      await saveAddresses(phone, nextAddresses);
      router.back();
    } catch {
      Alert.alert(
        'Unable to update address',
        'Please check your connection and try again.',
      );
    } finally {
      setSavingAddressId(undefined);
    }
  };

  const openAddressEditor = (addressId?: string) => {
    router.push({
      params: { ...(addressId ? { addressId } : {}), phone },
      pathname: '/address-editor',
    });
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DELIVERY LOCATION</Text>
          <Text style={styles.title}>Where should we deliver?</Text>
        </View>
        <Pressable
          accessibilityLabel="Close address picker"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Ionicons
            color={dashboardColors.text}
            name="close"
            size={21}
          />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {addresses.map((address) => (
            <AddressOption
              address={address}
              isSaving={savingAddressId === address.id}
              key={address.id}
              onEdit={() => openAddressEditor(address.id)}
              onSelect={() => void selectAddress(address.id)}
            />
          ))}

          <PressableScale
            accessibilityLabel="Add a new delivery address"
            onPress={() => openAddressEditor()}
            pressedScale={0.98}
            style={styles.addButton}
          >
            <View style={styles.addIcon}>
              <Ionicons
                color={dashboardColors.primary}
                name="add"
                size={21}
              />
            </View>
            <View style={styles.addCopy}>
              <Text style={styles.addTitle}>Add a new address</Text>
              <Text style={styles.addSubtitle}>
                Enter details or detect your current location
              </Text>
            </View>
            <Ionicons
              color={dashboardColors.textFaint}
              name="chevron-forward"
              size={19}
            />
          </PressableScale>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AddressOption({
  address,
  isSaving,
  onEdit,
  onSelect,
}: {
  address: SavedAddress;
  isSaving: boolean;
  onEdit: () => void;
  onSelect: () => void;
}) {
  const label =
    address.label === 'Other'
      ? address.customLabel || 'Other'
      : address.label;
  const location = [
    address.building,
    address.area,
    address.city,
    address.pinCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.addressCard, address.isDefault && styles.addressCardActive]}>
      <Pressable
        accessibilityLabel={`Deliver to ${label}, ${location}`}
        accessibilityRole="button"
        disabled={isSaving}
        onPress={onSelect}
        style={styles.addressMain}
      >
        <View style={[styles.pin, address.isDefault && styles.pinActive]}>
          <Ionicons
            color={
              address.isDefault
                ? '#FFFFFF'
                : dashboardColors.primary
            }
            name={address.label === 'Work' ? 'business' : 'home'}
            size={18}
          />
        </View>
        <View style={styles.addressCopy}>
          <View style={styles.addressLabelRow}>
            <Text style={styles.addressLabel}>{label}</Text>
            {address.isDefault ? (
              <View style={styles.selectedBadge}>
                <Ionicons color="#FFFFFF" name="checkmark" size={11} />
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={2} style={styles.addressLine}>
            {location}
          </Text>
          <Text style={styles.recipient}>
            {address.recipientName} · {address.phone}
          </Text>
        </View>
        {isSaving ? (
          <ActivityIndicator color={dashboardColors.primary} size="small" />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityLabel={`Edit ${label} address`}
        hitSlop={8}
        onPress={onEdit}
        style={styles.editButton}
      >
        <Ionicons
          color={dashboardColors.primary}
          name="pencil-outline"
          size={17}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.card,
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.xl,
  },
  eyebrow: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.1,
  },
  title: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    gap: dashboardSpacing.md,
    paddingBottom: dashboardSpacing.xxl,
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  addressCard: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addressCardActive: {
    backgroundColor: '#F4F8FB',
    borderColor: '#BFD3E4',
  },
  addressMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    minHeight: 106,
    padding: dashboardSpacing.md,
    paddingRight: 50,
  },
  pin: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pinActive: {
    backgroundColor: dashboardColors.primary,
  },
  addressCopy: {
    flex: 1,
    gap: 3,
  },
  addressLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
  },
  addressLabel: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 15,
  },
  selectedBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  selectedText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
  },
  addressLine: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  recipient: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
  },
  editButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 42,
  },
  addButton: {
    alignItems: 'center',
    borderColor: '#BFD3E4',
    borderRadius: dashboardRadii.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    minHeight: 82,
    padding: dashboardSpacing.md,
  },
  addIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  addCopy: {
    flex: 1,
    gap: 2,
  },
  addTitle: {
    ...dashboardTypography.body,
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
  addSubtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 10,
  },
});
