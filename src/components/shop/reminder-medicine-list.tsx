import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing, dashboardTypography } from '../../dashboardTheme';
import type { ReminderMedicineReorder } from '../../data/shopSections';
import { useCart } from '../../lib/cart';
import { useLanguage } from '../../lib/i18n';
import { ShopProductCard } from './shop-product-card';

export function ReminderMedicineList({
  medicines,
  onOpen,
}: {
  medicines: readonly ReminderMedicineReorder[];
  onOpen: (product: ReminderMedicineReorder['product']) => void;
}) {
  const { t } = useLanguage();
  const { add, decrement, getQuantity, increment } = useCart();

  if (medicines.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('yourReminderMedicines')}</Text>
      {medicines.map((medicine) => (
        <ShopProductCard
          key={medicine.key}
          onAdd={() => add(medicine.product)}
          onDecrement={() => decrement(medicine.product.id)}
          onIncrement={() => increment(medicine.product.id)}
          onOpen={() => onOpen(medicine.product)}
          product={medicine.product}
          quantity={getQuantity(medicine.product.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: dashboardSpacing.gap,
  },
  heading: {
    ...dashboardTypography.title,
    color: dashboardColors.primary,
    fontSize: 16,
    marginBottom: dashboardSpacing.sm,
  },
});
