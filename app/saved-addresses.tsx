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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { FloatingAddButton } from '../src/components/dashboard/FloatingAddButton';
import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { loadAddresses, saveAddresses } from '../src/lib/addressStorage';
import {
  removeAddress,
  setDefaultAddress,
  type SavedAddress,
} from '../src/lib/addresses';

const LABEL_ICONS = {
  Home: 'home-outline',
  Other: 'location-outline',
  Work: 'briefcase-outline',
} as const;

export default function SavedAddressesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const insets = useSafeAreaInsets();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busyAddressId, setBusyAddressId] = useState<string>();

  const reloadAddresses = useCallback(async () => {
    setErrorMessage(undefined);
    try {
      setAddresses(await loadAddresses(phone));
    } catch {
      setErrorMessage('Unable to load saved addresses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [phone]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void reloadAddresses();
    }, [reloadAddresses]),
  );

  const openEditor = (addressId?: string) => {
    router.push({
      params: addressId ? { addressId, phone } : { phone },
      pathname: '/address-editor',
    });
  };

  const saveNextAddresses = async (
    addressId: string,
    nextAddresses: SavedAddress[],
  ) => {
    setBusyAddressId(addressId);
    setErrorMessage(undefined);
    try {
      await saveAddresses(phone, nextAddresses);
      setAddresses(nextAddresses);
    } catch {
      setErrorMessage('Unable to update addresses. Please try again.');
    } finally {
      setBusyAddressId(undefined);
    }
  };

  const makeDefault = (addressId: string) => {
    void saveNextAddresses(
      addressId,
      setDefaultAddress(addresses, addressId),
    );
  };

  const confirmDelete = (address: SavedAddress) => {
    Alert.alert(
      'Delete address?',
      `Remove ${getAddressLabel(address)} from your saved addresses?`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () =>
            void saveNextAddresses(
              address.id,
              removeAddress(addresses, address.id),
            ),
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  const floatingBottomOffset = insets.bottom + dashboardSpacing.gap;
  const scrollBottomPadding =
    floatingBottomOffset + dashboardLayout.floatingButtonHeight + 28;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <View style={styles.headerSide} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            addresses.length === 0 && styles.emptyContent,
            { paddingBottom: scrollBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {addresses.length === 0 ? (
            <EmptyAddresses onAdd={() => openEditor()} />
          ) : (
            <>
              <Text style={styles.intro}>
                Choose where you want your medicines delivered.
              </Text>
              {addresses.map((address) => (
                <AddressCard
                  address={address}
                  disabled={busyAddressId === address.id}
                  key={address.id}
                  onDelete={() => confirmDelete(address)}
                  onEdit={() => openEditor(address.id)}
                  onMakeDefault={() => makeDefault(address.id)}
                />
              ))}
            </>
          )}
          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <FloatingAddButton
        bottomOffset={floatingBottomOffset}
        icon="add"
        label="Add Address"
        onPress={() => openEditor()}
      />
    </SafeAreaView>
  );
}

function getAddressLabel(address: SavedAddress): string {
  return address.label === 'Other'
    ? address.customLabel || 'Other'
    : address.label;
}

function EmptyAddresses({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons
          color={dashboardColors.primary}
          name="location-outline"
          size={40}
        />
      </View>
      <Text style={styles.emptyTitle}>No saved addresses yet</Text>
      <Text style={styles.emptySubtitle}>
        Save your delivery addresses to order medicines faster.
      </Text>
      <PressableScale
        accessibilityLabel="Add your first address"
        onPress={onAdd}
        style={styles.emptyButton}
      >
        <Ionicons color={dashboardColors.primary} name="add" size={18} />
        <Text style={styles.emptyButtonText}>Add your first address</Text>
      </PressableScale>
    </View>
  );
}

function AddressCard({
  address,
  disabled,
  onDelete,
  onEdit,
  onMakeDefault,
}: {
  address: SavedAddress;
  disabled: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMakeDefault: () => void;
}) {
  const label = getAddressLabel(address);
  const icon = LABEL_ICONS[address.label];
  const locationLine = [address.building, address.area, address.landmark]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      style={[
        styles.card,
        address.isDefault && styles.cardDefault,
        disabled && styles.cardDisabled,
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.labelIcon,
            address.isDefault && styles.labelIconDefault,
          ]}
        >
          <Ionicons
            color={
              address.isDefault
                ? dashboardColors.primary
                : dashboardColors.textMuted
            }
            name={icon}
            size={20}
          />
        </View>
        <Text style={styles.cardLabel}>{label}</Text>
        {address.isDefault ? (
          <View style={styles.defaultBadge}>
            <Ionicons
              color={dashboardColors.primary}
              name="checkmark"
              size={12}
            />
            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.recipient}>
        {address.recipientName} · +91 {address.phone}
      </Text>
      <Text style={styles.addressLine}>{locationLine}</Text>
      <Text style={styles.addressLine}>
        {address.city}, {address.state} - {address.pinCode}
      </Text>

      <View style={styles.cardActions}>
        {address.isDefault ? (
          <View style={styles.defaultSpacer} />
        ) : (
          <Pressable disabled={disabled} onPress={onMakeDefault}>
            <Text style={styles.defaultAction}>Set as default</Text>
          </Pressable>
        )}
        <View style={styles.actionSpacer} />
        <Pressable disabled={disabled} hitSlop={8} onPress={onEdit}>
          <Text style={styles.editAction}>Edit</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable disabled={disabled} hitSlop={8} onPress={onDelete}>
          <Text style={styles.deleteAction}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
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
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.gap,
  },
  emptyContent: {
    flexGrow: 1,
  },
  intro: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginBottom: dashboardSpacing.gap,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 72,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.gap,
    width: 72,
  },
  emptyTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    maxWidth: 270,
    textAlign: 'center',
  },
  emptyButton: {
    alignItems: 'center',
    borderColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginTop: dashboardSpacing.xl,
    paddingHorizontal: dashboardSpacing.gap,
    paddingVertical: dashboardSpacing.md,
  },
  emptyButtonText: {
    ...dashboardTypography.body,
    color: dashboardColors.primary,
  },
  card: {
    backgroundColor: dashboardColors.card,
    borderColor: 'transparent',
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    marginBottom: dashboardSpacing.md,
    padding: dashboardSpacing.gap,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  cardDefault: {
    borderColor: dashboardColors.primary,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  labelIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: dashboardSpacing.md,
    width: 36,
  },
  labelIconDefault: {
    backgroundColor: dashboardColors.primaryTint,
  },
  cardLabel: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
  },
  defaultBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontSize: 10,
  },
  recipient: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.md,
  },
  addressLine: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  cardActions: {
    alignItems: 'center',
    borderTopColor: dashboardColors.track,
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: dashboardSpacing.gap,
    paddingTop: dashboardSpacing.md,
  },
  defaultSpacer: {
    width: 1,
  },
  defaultAction: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
  },
  actionSpacer: {
    flex: 1,
  },
  editAction: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
  },
  deleteAction: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
  },
  actionDivider: {
    backgroundColor: dashboardColors.track,
    height: 16,
    marginHorizontal: dashboardSpacing.md,
    width: 1,
  },
  errorText: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
});
