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

export function MedicineDetailContent({
  product,
}: {
  product: ShopProduct;
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

      <Text style={styles.safetyNote}>{product.safetyNote}</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: dashboardSpacing.pagePadding,
  },
  image: {
    height: 240,
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
  safetyNote: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    lineHeight: 17,
    marginTop: dashboardSpacing.gap,
  },
  sourceLink: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
    marginTop: dashboardSpacing.sm,
  },
});
