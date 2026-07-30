import { normalizeMedicineSearch } from '../lib/medicineSearch';
import { getShopProductFallbackCopy } from './shop-product-copy';

export const ASIAN_HOSPITAL_NAME = 'ASIAN MULTI SPECIALITY HOSPITALS';

export const SHOP_SECTION_CODES = [
  'headache',
  'body_pains',
  'fever',
  'cold',
] as const;

export type ShopSectionCode = (typeof SHOP_SECTION_CODES)[number];

export type ShopProduct = {
  category: string;
  commonUses: string | null;
  composition: string;
  fullDescription: string;
  hasUniqueCatalogueName: boolean;
  hospitalName: string;
  id: string;
  imageUrl: string;
  informationReviewedAt: string | null;
  informationSourceName: string | null;
  informationSourceUrl: string | null;
  name: string;
  packSize: string;
  price: number | null;
  safetyNote: string;
  sectionRanks: Partial<Record<ShopSectionCode, number>>;
  shortDescription: string;
};

export type ShopMedicineRow = {
  category: string | null;
  composition: string | null;
  dosage_form: string | null;
  hospital_name: string | null;
  id: string;
  image_url: string | null;
  name: string;
  price: number | string | null;
  shop_common_uses: string | null;
  shop_full_description: string | null;
  shop_information_reviewed_at: string | null;
  shop_information_source_name: string | null;
  shop_information_source_url: string | null;
  shop_product_section_items:
    | Array<{
        section_code: string;
        sort_order: number;
      }>
    | {
        section_code: string;
        sort_order: number;
      }
    | null;
  shop_safety_note: string | null;
  shop_short_description: string | null;
};

function isShopSectionCode(value: string): value is ShopSectionCode {
  return SHOP_SECTION_CODES.includes(value as ShopSectionCode);
}

function formatDosageForm(value: string | null): string {
  const normalized = value?.trim().replace(/[_/]+/g, ' ').toLowerCase();
  if (!normalized) {
    return 'Medicine';
  }

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAsianHospital(value: string | null): boolean {
  return (value ?? '').trim().toUpperCase() === ASIAN_HOSPITAL_NAME;
}

function parsePrice(value: number | string | null): number | null {
  const price =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function mapMedicineRowsToShopProducts(
  rows: readonly ShopMedicineRow[],
): ShopProduct[] {
  const unique = new Map<string, ShopProduct>();

  for (const row of rows) {
    const name = row.name.trim();
    const imageUrl = row.image_url?.trim() ?? '';
    const normalizedName = normalizeMedicineSearch(name);
    if (!name || !imageUrl || !normalizedName || !isAsianHospital(row.hospital_name)) {
      continue;
    }

    const existingProduct = unique.get(normalizedName);
    if (existingProduct) {
      unique.set(normalizedName, {
        ...existingProduct,
        hasUniqueCatalogueName: false,
      });
      continue;
    }

    const sectionRows = Array.isArray(row.shop_product_section_items)
      ? row.shop_product_section_items
      : row.shop_product_section_items
        ? [row.shop_product_section_items]
        : [];
    const sectionRanks: Partial<Record<ShopSectionCode, number>> = {};
    for (const section of sectionRows) {
      if (
        isShopSectionCode(section.section_code) &&
        Number.isFinite(section.sort_order)
      ) {
        sectionRanks[section.section_code] = section.sort_order;
      }
    }

    const category = row.category?.trim() ?? '';
    const composition = row.composition?.trim() ?? '';
    const dosageForm = row.dosage_form?.trim() ?? '';
    const fallback = getShopProductFallbackCopy({
      category,
      composition,
      dosageForm,
    });

    unique.set(normalizedName, {
      category,
      commonUses: nonEmpty(row.shop_common_uses) ?? fallback.commonUses,
      composition,
      fullDescription:
        nonEmpty(row.shop_full_description) ?? fallback.fullDescription,
      hasUniqueCatalogueName: true,
      hospitalName: ASIAN_HOSPITAL_NAME,
      id: row.id,
      imageUrl,
      informationReviewedAt: nonEmpty(row.shop_information_reviewed_at),
      informationSourceName: nonEmpty(row.shop_information_source_name),
      informationSourceUrl: nonEmpty(row.shop_information_source_url),
      name,
      packSize: formatDosageForm(row.dosage_form),
      price: parsePrice(row.price),
      safetyNote: nonEmpty(row.shop_safety_note) ?? fallback.safetyNote,
      sectionRanks,
      shortDescription:
        nonEmpty(row.shop_short_description) ?? fallback.shortDescription,
    });
  }

  return [...unique.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
