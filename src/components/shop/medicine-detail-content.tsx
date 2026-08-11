import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { ShopProduct } from '../../data/shopProducts';
import {
  formatShopProductMrp,
  formatShopProductPrice,
  SHOP_DISCOUNT_PERCENT,
} from '../../lib/currency';
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
      <View style={styles.imageWrap}>
        <Image
          accessibilityLabel={product.name}
          contentFit="contain"
          source={{ uri: product.imageUrl }}
          style={styles.image}
        />
        <View style={styles.offerBadge}>
          <Ionicons color="#DC2626" name="pricetag" size={13} />
          <Text style={styles.offerBadgeText}>
            {SHOP_DISCOUNT_PERCENT}% OFF
          </Text>
        </View>
      </View>

      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.meta}>{product.packSize}</Text>
      <View style={styles.mrpRow}>
        <Text style={styles.mrpLabel}>MRP</Text>
        <Text style={styles.mrpPrice}>
          {formatShopProductMrp(product.price)}
        </Text>
      </View>
      <Text style={styles.price}>{formatShopProductPrice(product.price)}</Text>
      <Text style={styles.offerText}>{SHOP_DISCOUNT_PERCENT}% offer</Text>
      <View style={styles.deliveryBenefit}>
        <Ionicons
          color={dashboardColors.primary}
          name="bicycle-outline"
          size={16}
        />
        <Text style={styles.deliveryBenefitText}>Free delivery</Text>
      </View>

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
  imageWrap: {
    backgroundColor: '#F1F3F5',
    borderRadius: 22,
    height: 240,
    marginBottom: dashboardSpacing.gap,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  offerBadge: {
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    left: dashboardSpacing.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    top: dashboardSpacing.md,
  },
  offerBadgeText: {
    ...dashboardTypography.caption,
    color: '#DC2626',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
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
  mrpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: dashboardSpacing.sm,
  },
  mrpLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  mrpPrice: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    textDecorationLine: 'line-through',
  },
  price: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primaryDark,
    fontSize: 20,
    marginTop: 1,
  },
  offerText: {
    ...dashboardTypography.caption,
    color: '#DC2626',
    fontFamily: 'Inter_600SemiBold',
    marginTop: 1,
  },
  deliveryBenefit: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: dashboardSpacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deliveryBenefitText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  section: {
    marginTop: dashboardSpacing.gap,
  },
  sectionTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primary,
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
