import { normalizeMedicineSearch } from '../lib/medicineSearch';

export const SHOP_SECTION_CODES = [
  'headache',
  'body_pains',
  'fever',
  'cold',
] as const;

export type ShopSectionCode = (typeof SHOP_SECTION_CODES)[number];

export type ShopProduct = {
  category: string;
  composition: string;
  hasUniqueCatalogueName: boolean;
  hospitalName: string;
  id: string;
  imageUrl: string;
  name: string;
  packSize: string;
  price: number;
  sectionRanks: Partial<Record<ShopSectionCode, number>>;
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

function parsePrice(value: number | string | null): number | null {
  const price =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function mapMedicineRowsToShopProducts(
  rows: readonly ShopMedicineRow[],
): ShopProduct[] {
  const unique = new Map<string, ShopProduct>();

  for (const row of rows) {
    const name = row.name.trim();
    const imageUrl = row.image_url?.trim() ?? '';
    const normalizedName = normalizeMedicineSearch(name);
    const price = parsePrice(row.price);
    if (
      !name ||
      !imageUrl ||
      !normalizedName ||
      price === null
    ) {
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

    unique.set(normalizedName, {
      category: row.category?.trim() ?? '',
      composition: row.composition?.trim() ?? '',
      hasUniqueCatalogueName: true,
      hospitalName: row.hospital_name?.trim() || 'Verified medicine',
      id: row.id,
      imageUrl,
      name,
      packSize: formatDosageForm(row.dosage_form),
      price,
      sectionRanks,
    });
  }

  return [...unique.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
