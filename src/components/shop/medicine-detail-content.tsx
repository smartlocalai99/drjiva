import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { ShopProduct } from '../../data/shopProducts';
import { formatShopProductPrice } from '../../lib/currency';
import { useLanguage } from '../../lib/i18n';
import { ProductQuantityControl } from './product-quantity-control';

export function MedicineDetailContent({
  onAdd,
  onDecrement,
  onIncrement,
  product,
  quantity,
}: {
  onAdd: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  product: ShopProduct;
  quantity: number;
}) {
  const { t } = useLanguage();
  const hasSource = Boolean(
    product.informationSourceName && product.informationSourceUrl,
  );

  return (
    <View style={styles.container}>
      <Image
        accessibilityLabel={product.name}
        contentFit="contain"
        source={{ uri: product.imageUrl }}
        style={styles.image}
      />

      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.meta}>{product.packSize}</Text>
      <Text style={styles.price}>{formatShopProductPrice(product.price)}</Text>

      <Text style={styles.body}>{product.shortDescription}</Text>
      <Text style={styles.body}>{product.fullDescription}</Text>

      {product.commonUses ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('commonUse')}</Text>
          <Text style={styles.sectionBody}>{product.commonUses}</Text>
        </View>
      ) : null}

      {product.composition ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('composition')}</Text>
          <Text style={styles.sectionBody}>{product.composition}</Text>
        </View>
      ) : null}

      {product.category ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <Text style={styles.sectionBody}>{product.category}</Text>
        </View>
      ) : null}

      <View style={styles.safetyCard}>
        <View style={styles.safetyHeadingRow}>
          <Ionicons color={dashboardColors.primary} name="shield-checkmark-outline" size={18} />
          <Text style={styles.safetyTitle}>Safety information</Text>
        </View>
        <Text style={styles.safetyBody}>{product.safetyNote}</Text>
      </View>

      <Text style={styles.notice}>{t('generalMedicineInformation')}</Text>

      {hasSource ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(product.informationSourceUrl as string)}
        >
          <Text style={styles.sourceLink}>
            Source: {product.informationSourceName}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.addRow}>
        <ProductQuantityControl
          onAdd={onAdd}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
          productName={product.name}
          quantity={quantity}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: dashboardSpacing.pagePadding,
  },
  image: {
    height: 220,
    marginBottom: dashboardSpacing.gap,
    width: '100%',
  },
  name: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  meta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  price: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.sm,
  },
  body: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    lineHeight: 20,
    marginTop: dashboardSpacing.sm,
  },
  section: {
    marginTop: dashboardSpacing.gap,
  },
  sectionTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 14,
  },
  sectionBody: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  safetyCard: {
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 16,
    marginTop: dashboardSpacing.gap,
    padding: dashboardSpacing.md,
  },
  safetyHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  safetyTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 14,
  },
  safetyBody: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    lineHeight: 20,
    marginTop: dashboardSpacing.sm,
  },
  notice: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    lineHeight: 16,
    marginTop: dashboardSpacing.gap,
  },
  sourceLink: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
    marginTop: dashboardSpacing.sm,
  },
  addRow: {
    alignItems: 'flex-start',
    marginTop: dashboardSpacing.xl,
  },
});
