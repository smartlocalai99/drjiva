import {
  normalizeMedicineSearch,
} from '../lib/medicineSearch';
import type {
  ShopProduct,
  ShopSectionCode,
} from './shopProductModel';
import { SHOP_SECTION_CODES } from './shopProductModel';

export type ShopSectionKey = ShopSectionCode | 'search';

export type ShopProductSection = {
  code: ShopSectionKey;
  data: ShopProduct[];
  title: string;
};

export type ReminderMedicineReorder = {
  key: string;
  medicineName: string;
  product: ShopProduct;
};

const SECTION_TITLES: Record<ShopSectionCode, string> = {
  body_pains: 'Body Pains',
  cold: 'Cold',
  fever: 'Fever',
  headache: 'Headache',
  stomach_pain: 'Stomach Pain',
};

function matchesProductSearch(
  product: ShopProduct,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const searchable = normalizeMedicineSearch(
    [
      product.name,
      product.composition,
      product.category,
      product.hospitalName,
      product.shortDescription,
      product.commonUses ?? '',
    ].join(' '),
  );
  return normalizedQuery
    .split(' ')
    .every((token) => searchable.includes(token));
}

export function buildShopSections(
  products: readonly ShopProduct[],
  query = '',
): ShopProductSection[] {
  const normalizedQuery = normalizeMedicineSearch(query);
  if (normalizedQuery) {
    const data = products
      .filter((product) =>
        matchesProductSearch(product, normalizedQuery),
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 80);

    if (data.length === 0) {
      return [];
    }

    return [
      {
        code: 'search',
        data,
        title: 'Search results',
      },
    ];
  }

  return SHOP_SECTION_CODES.map((code) => ({
    code,
    data: products
      .filter((product) => product.sectionRanks[code] !== undefined)
      .sort(
        (left, right) =>
          (left.sectionRanks[code] ?? Number.MAX_SAFE_INTEGER) -
            (right.sectionRanks[code] ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name),
      ),
    title: SECTION_TITLES[code],
  })).filter((section) => section.data.length > 0);
}

export function getUniqueReminderMedicineNames(
  names: readonly string[],
): string[] {
  const unique = new Map<string, string>();
  for (const value of names) {
    const displayName = value.trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeMedicineSearch(displayName);
    if (displayName && normalizedName && !unique.has(normalizedName)) {
      unique.set(normalizedName, displayName);
    }
  }
  return [...unique.values()];
}

export function buildReminderMedicineReorders(
  names: readonly string[],
  products: readonly ShopProduct[],
): ReminderMedicineReorder[] {
  const productsByName = new Map<string, ShopProduct | null>();

  for (const product of products) {
    const normalizedName = normalizeMedicineSearch(product.name);
    if (!normalizedName) {
      continue;
    }

    if (!product.hasUniqueCatalogueName) {
      productsByName.set(normalizedName, null);
      continue;
    }

    // An ambiguous catalogue name must never silently choose a product.
    productsByName.set(
      normalizedName,
      productsByName.has(normalizedName) ? null : product,
    );
  }

  return getUniqueReminderMedicineNames(names).flatMap((medicineName) => {
    const key = normalizeMedicineSearch(medicineName);
    const product = productsByName.get(key);
    return product
      ? [
          {
            key,
            medicineName,
            product,
          },
        ]
      : [];
  });
}
