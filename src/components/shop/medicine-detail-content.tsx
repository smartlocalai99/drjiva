import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, type ComponentProps } from "react";
import {
  LayoutAnimation,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../dashboardTheme";
import type { ShopProduct } from "../../data/shopProducts";
import {
  formatShopProductMrp,
  formatShopProductPrice,
  SHOP_DISCOUNT_PERCENT,
} from "../../lib/currency";
import { useLanguage } from "../../lib/i18n";
import { getShopProductRating } from "../../lib/shop-product-rating";
import { PressableScale } from "../PressableScale";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Faq = {
  answer: string;
  question: string;
};

function buildFaqs(product: ShopProduct): Faq[] {
  return [
    {
      answer:
        product.commonUses ??
        `${product.name} should be used only when it matches your prescription or a pharmacist confirms it is appropriate for you.`,
      question: `What is ${product.name} commonly used for?`,
    },
    {
      answer:
        "Follow the dose, timing, and duration written on your prescription or advised by your doctor or pharmacist. Do not change the dose on your own.",
      question: `How should I use ${product.name}?`,
    },
    {
      answer:
        "Ask your doctor or pharmacist before combining medicines, supplements, or herbal products. Keep an updated list of everything you take.",
      question: "Can I take it with other medicines?",
    },
    {
      answer:
        "Keep it in its original pack, away from direct heat, light, and moisture, and out of reach of children. Follow any storage directions printed on the pack.",
      question: "How should I store this medicine?",
    },
  ];
}

function Benefit({
  icon,
  label,
  value,
}: {
  icon: IoniconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.benefitItem}>
      <View style={styles.benefitIcon}>
        <Ionicons color={dashboardColors.primary} name={icon} size={20} />
      </View>
      <Text numberOfLines={1} style={styles.benefitValue}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.benefitLabel}>
        {label}
      </Text>
    </View>
  );
}

function RelatedProductCard({
  onAdd,
  onOpen,
  product,
}: {
  onAdd: () => void;
  onOpen: () => void;
  product: ShopProduct;
}) {
  return (
    <View style={styles.relatedCard}>
      <Pressable
        accessibilityLabel={`Open ${product.name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.relatedOpenArea}
      >
        <View style={styles.relatedImageWrap}>
          <Image
            accessibilityLabel={product.name}
            cachePolicy="memory-disk"
            contentFit="contain"
            recyclingKey={product.id}
            source={{ uri: product.imageUrl }}
            style={styles.relatedImage}
            transition={120}
          />
        </View>
        <Text numberOfLines={2} style={styles.relatedName}>
          {product.name}
        </Text>
        <Text numberOfLines={1} style={styles.relatedMeta}>
          {product.packSize}
        </Text>
      </Pressable>
      <View style={styles.relatedPriceRow}>
        <Text style={styles.relatedPrice}>
          {formatShopProductPrice(product.price)}
        </Text>
        <PressableScale
          accessibilityLabel={`Add ${product.name} to cart`}
          onPress={onAdd}
          pressedScale={0.94}
          style={styles.relatedAddButton}
        >
          <Ionicons color="#FFFFFF" name="add" size={16} />
          <Text style={styles.relatedAddText}>Add</Text>
        </PressableScale>
      </View>
    </View>
  );
}

export function MedicineDetailContent({
  onAddRelatedProduct,
  onOpenRelatedProduct,
  product,
  relatedProducts = [],
}: {
  onAddRelatedProduct?: (product: ShopProduct) => void;
  onOpenRelatedProduct?: (product: ShopProduct) => void;
  product: ShopProduct;
  relatedProducts?: readonly ShopProduct[];
}) {
  const { t } = useLanguage();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const rating = getShopProductRating(product.id, product.name);
  const faqs = buildFaqs(product);
  const hasSource = Boolean(
    product.informationSourceName && product.informationSourceUrl,
  );
  const detailRows = [
    { label: "Pack size", value: product.packSize },
    { label: "Category", value: product.category },
    { label: t("composition"), value: product.composition },
    { label: "Supplied by", value: product.hospitalName },
  ].filter(({ value }) => value.trim());

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq((current) => (current === index ? null : index));
  };

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

      <View style={styles.heroCopy}>
        <Text selectable style={styles.name}>
          {product.name}
        </Text>
        <Text selectable style={styles.meta}>
          {product.packSize}
        </Text>
        <View style={styles.priceBlock}>
          <View style={styles.sellingPriceRow}>
            <Text selectable style={styles.price}>
              {formatShopProductPrice(product.price)}
            </Text>
            <View style={styles.mrpRow}>
              <Text style={styles.mrpLabel}>MRP</Text>
              <Text style={styles.mrpPrice}>
                {formatShopProductMrp(product.price)}
              </Text>
            </View>
          </View>
          <Text style={styles.taxText}>Inclusive of all taxes</Text>
        </View>
        <View style={styles.ratingRow}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{rating.label}</Text>
            <Ionicons color="#FFFFFF" name="star" size={12} />
          </View>
          <Text selectable style={styles.ratingCount}>
            {rating.count} ratings
          </Text>
        </View>
      </View>

      <View style={styles.benefitGrid}>
        <Benefit icon="flash-outline" label="Fast delivery" value="15 mins" />
        <Benefit
          icon="cube-outline"
          label="On this order"
          value="Free delivery"
        />
        <Benefit icon="cash-outline" label="Available" value="COD" />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="document-text-outline"
              size={19}
            />
          </View>
          <Text style={styles.sectionTitle}>About this product</Text>
        </View>
        <Text selectable style={styles.sectionLead}>
          {product.shortDescription}
        </Text>
        {product.fullDescription !== product.shortDescription ? (
          <Text selectable style={styles.sectionBody}>
            {product.fullDescription}
          </Text>
        ) : null}
        {product.commonUses ? (
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>{t("commonUse")}</Text>
            <Text selectable style={styles.sectionBody}>
              {product.commonUses}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewHeaderCopy}>
            <Text style={styles.sectionTitle}>Ratings & reviews</Text>
            <Text style={styles.reviewSummary}>
              {rating.label} out of 5 · {rating.count} ratings
            </Text>
          </View>
        </View>
        <View style={styles.reviewExpanded}>
          <View style={styles.reviewScoreRow}>
            <Text style={styles.reviewScore}>{rating.label}</Text>
            <View style={styles.reviewStars}>
              {[0, 1, 2, 3, 4].map((star) => (
                <Ionicons
                  key={star}
                  color="#F59E0B"
                  name={
                    Number(rating.label) >= star + 1
                      ? "star"
                      : Number(rating.label) >= star + 0.5
                        ? "star-half"
                        : "star-outline"
                  }
                  size={18}
                />
              ))}
            </View>
          </View>
          <Text style={styles.reviewBody}>
            Based on customer ratings. Written reviews will appear here when
            customers submit them after purchase.
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="information-circle-outline"
              size={20}
            />
          </View>
          <Text style={styles.sectionTitle}>Product details</Text>
        </View>
        <View style={styles.detailsTable}>
          {detailRows.map(({ label, value }, index) => (
            <View
              key={label}
              style={[
                styles.detailRow,
                index === detailRows.length - 1 && styles.detailRowLast,
              ]}
            >
              <Text style={styles.detailLabel}>{label}</Text>
              <Text numberOfLines={3} selectable style={styles.detailValue}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="help-circle-outline"
              size={20}
            />
          </View>
          <Text style={styles.sectionTitle}>Frequently asked questions</Text>
        </View>
        <View style={styles.faqList}>
          {faqs.map((faq, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <View key={faq.question} style={styles.faqItem}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() => toggleFaq(index)}
                  style={styles.faqQuestionRow}
                >
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons
                    color={dashboardColors.textMuted}
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                  />
                </Pressable>
                {isExpanded ? (
                  <Text selectable style={styles.faqAnswer}>
                    {faq.answer}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.safetyCard}>
        <View style={styles.safetyHeadingRow}>
          <View style={styles.safetyIcon}>
            <Ionicons
              color="#B45309"
              name="shield-checkmark-outline"
              size={21}
            />
          </View>
          <View style={styles.safetyHeadingCopy}>
            <Text style={styles.safetyTitle}>Safety advice</Text>
            <Text style={styles.safetySubtitle}>Please read before use</Text>
          </View>
        </View>
        <Text selectable style={styles.safetyNote}>
          {product.safetyNote}
        </Text>
        <View style={styles.safetyPoints}>
          {[
            "Check the pack, expiry date, and prescribed strength before use.",
            "Tell your doctor about allergies, pregnancy, breastfeeding, or other medicines.",
            "Stop use and seek medical help if you notice a serious or unexpected reaction.",
          ].map((advice) => (
            <View key={advice} style={styles.safetyPoint}>
              <Ionicons color="#B45309" name="checkmark-circle" size={16} />
              <Text selectable style={styles.safetyPointText}>
                {advice}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {hasSource ? (
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(product.informationSourceUrl as string)
          }
          style={styles.sourceCard}
        >
          <Ionicons
            color={dashboardColors.primary}
            name="open-outline"
            size={17}
          />
          <Text style={styles.sourceLink}>
            Product information source: {product.informationSourceName}
          </Text>
        </Pressable>
      ) : null}

      {relatedProducts.length > 0 ? (
        <View style={styles.relatedSection}>
          <View style={styles.relatedHeadingRow}>
            <View>
              <Text style={styles.relatedHeading}>Products you may need</Text>
              <Text style={styles.relatedSubheading}>
                More options from the medicine shop
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            contentContainerStyle={styles.relatedTrack}
            showsHorizontalScrollIndicator={false}
          >
            {relatedProducts.map((relatedProduct) => (
              <RelatedProductCard
                key={relatedProduct.id}
                onAdd={() => onAddRelatedProduct?.(relatedProduct)}
                onOpen={() => onOpenRelatedProduct?.(relatedProduct)}
                product={relatedProduct}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: dashboardSpacing.gap,
    padding: dashboardSpacing.pagePadding,
  },
  imageWrap: {
    backgroundColor: dashboardColors.productImageBg,
    borderCurve: "continuous",
    borderRadius: 24,
    height: 250,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  offerBadge: {
    alignItems: "center",
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    left: dashboardSpacing.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: "absolute",
    top: dashboardSpacing.md,
  },
  offerBadgeText: {
    ...dashboardTypography.caption,
    color: "#DC2626",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  heroCopy: {
    gap: 3,
  },
  name: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    fontSize: 22,
    lineHeight: 28,
  },
  meta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    paddingTop: dashboardSpacing.xs,
  },
  ratingBadge: {
    alignItems: "center",
    backgroundColor: "#15803D",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  ratingCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  priceBlock: {
    gap: 1,
    paddingTop: dashboardSpacing.sm,
  },
  sellingPriceRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 10,
  },
  mrpRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  mrpLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  mrpPrice: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    textDecorationLine: "line-through",
  },
  price: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primaryDark,
    fontSize: 22,
    lineHeight: 28,
  },
  taxText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 10,
  },
  benefitGrid: {
    backgroundColor: "#FFFFFF",
    borderColor: dashboardColors.track,
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: dashboardSpacing.xs,
    paddingVertical: dashboardSpacing.md,
  },
  benefitItem: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    minWidth: 0,
    paddingHorizontal: 3,
  },
  benefitIcon: {
    alignItems: "center",
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  benefitValue: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    textAlign: "center",
  },
  benefitLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 9,
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderColor: dashboardColors.track,
    borderCurve: "continuous",
    borderRadius: 20,
    borderWidth: 1,
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.gap,
  },
  sectionHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
  },
  sectionHeadingIcon: {
    alignItems: "center",
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  sectionTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primary,
    flex: 1,
    fontSize: 16,
  },
  sectionLead: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    lineHeight: 21,
  },
  sectionBody: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    lineHeight: 21,
  },
  infoBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    gap: 3,
    padding: dashboardSpacing.md,
  },
  infoLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: "Inter_700Bold",
  },
  detailsTable: {
    borderColor: dashboardColors.track,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.md,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    width: 86,
  },
  detailValue: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  faqList: {
    gap: dashboardSpacing.sm,
  },
  faqItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    overflow: "hidden",
  },
  faqQuestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    minHeight: 48,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 10,
  },
  faqQuestion: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  faqAnswer: {
    ...dashboardTypography.caption,
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    color: dashboardColors.textMuted,
    lineHeight: 19,
    padding: dashboardSpacing.md,
  },
  safetyCard: {
    backgroundColor: "#FFF8E8",
    borderColor: "#FDE3A7",
    borderCurve: "continuous",
    borderRadius: 20,
    borderWidth: 1,
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.gap,
  },
  safetyHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
  },
  safetyIcon: {
    alignItems: "center",
    backgroundColor: "#FFEDC2",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  safetyHeadingCopy: {
    flex: 1,
  },
  safetyTitle: {
    ...dashboardTypography.cardTitle,
    color: "#92400E",
    fontSize: 16,
  },
  safetySubtitle: {
    ...dashboardTypography.caption,
    color: "#A16207",
    fontSize: 10,
  },
  safetyNote: {
    ...dashboardTypography.body,
    color: "#78350F",
    lineHeight: 20,
  },
  safetyPoints: {
    gap: dashboardSpacing.sm,
  },
  safetyPoint: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 7,
  },
  safetyPointText: {
    ...dashboardTypography.caption,
    color: "#92400E",
    flex: 1,
    lineHeight: 18,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
  },
  reviewHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  reviewSummary: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  reviewExpanded: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    gap: dashboardSpacing.sm,
    padding: dashboardSpacing.md,
  },
  reviewScoreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
  },
  reviewScore: {
    ...dashboardTypography.largeTitle,
    color: dashboardColors.text,
    fontSize: 30,
    fontVariant: ["tabular-nums"],
    lineHeight: 34,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewBody: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    lineHeight: 18,
  },
  sourceCard: {
    alignItems: "center",
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 14,
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    padding: dashboardSpacing.md,
  },
  sourceLink: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    flex: 1,
    fontFamily: "Inter_600SemiBold",
  },
  relatedSection: {
    gap: dashboardSpacing.md,
  },
  relatedHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  relatedHeading: {
    ...dashboardTypography.title,
    color: dashboardColors.primary,
    fontSize: 18,
  },
  relatedSubheading: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    paddingTop: 2,
  },
  relatedTrack: {
    gap: dashboardSpacing.md,
    paddingRight: dashboardSpacing.pagePadding,
  },
  relatedCard: {
    backgroundColor: "#FFFFFF",
    borderColor: dashboardColors.track,
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    padding: dashboardSpacing.sm,
    width: 174,
  },
  relatedOpenArea: {
    width: "100%",
  },
  relatedImageWrap: {
    alignItems: "center",
    backgroundColor: dashboardColors.productImageBg,
    borderRadius: 14,
    height: 134,
    justifyContent: "center",
    overflow: "hidden",
  },
  relatedImage: {
    height: "98%",
    width: "98%",
  },
  relatedName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    paddingTop: dashboardSpacing.sm,
  },
  relatedMeta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 9,
    paddingTop: 2,
  },
  relatedPriceRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: dashboardSpacing.sm,
  },
  relatedPrice: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primaryDark,
    fontSize: 15,
  },
  relatedAddButton: {
    alignItems: "center",
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    flexDirection: "row",
    gap: 3,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  relatedAddText: {
    ...dashboardTypography.caption,
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
});
