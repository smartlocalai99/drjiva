import {
  normalizeMedicineSearch,
  searchMedicineCatalogue,
} from '../lib/medicineSearch';
import type {
  ShopHospitalFilter,
  ShopProduct,
  ShopSectionCode,
} from './shopProductModel';
import {
  DHRUVA_HOSPITAL_NAME,
  getShopHospitalCode,
  SHOP_SECTION_CODES,
} from './shopProductModel';

export type ShopSectionKey = ShopSectionCode | 'dhruva' | 'search';

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
  allergy_cough: 'Allergy & Cough',
  body_pains: 'Body Pains',
  cold: 'Cold',
  diabetes_care: 'Diabetes Care',
  fever: 'Fever',
  headache: 'Headache',
  heart_bp: 'Heart & BP',
  skin_care: 'Skin Care',
  stomach_pain: 'Stomach Pain',
  vitamins: 'Multivitamins',
};

function getProductSearchText(product: ShopProduct): string {
  return [
    product.name,
    product.composition,
    product.category,
    product.hospitalName,
    product.shortDescription,
    product.commonUses ?? '',
  ].join(' ');
}

export function buildShopSections(
  products: readonly ShopProduct[],
  query = '',
  hospitalFilter: ShopHospitalFilter = 'all',
): ShopProductSection[] {
  const normalizedQuery = normalizeMedicineSearch(query);
  if (normalizedQuery) {
    const result = searchMedicineCatalogue(
      products,
      normalizedQuery,
      80,
      getProductSearchText,
    );

    return [
      {
        code: 'search',
        data: result.items,
        title: result.usedNearestFallback
          ? 'Closest matches'
          : 'Search results',
      },
    ];
  }

  const filteredProducts = products.filter((product) => {
    const hospitalCode = getShopHospitalCode(product.hospitalName);
    return hospitalFilter === 'all' || hospitalCode === hospitalFilter;
  });

  const asianSections = SHOP_SECTION_CODES.map((code) => ({
    code,
    data: filteredProducts
      .filter(
        (product) =>
          getShopHospitalCode(product.hospitalName) === 'asian' &&
          product.sectionRanks[code] !== undefined,
      )
      .sort(
        (left, right) =>
          (left.sectionRanks[code] ?? Number.MAX_SAFE_INTEGER) -
            (right.sectionRanks[code] ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name),
      ),
    title: SECTION_TITLES[code],
  })).filter((section) => section.data.length > 0);

  const dhruvaProducts = filteredProducts
    .filter(
      (product) => getShopHospitalCode(product.hospitalName) === 'dhruva',
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  return [
    ...asianSections,
    ...(dhruvaProducts.length > 0
      ? [{ code: 'dhruva' as const, data: dhruvaProducts, title: DHRUVA_HOSPITAL_NAME }]
      : []),
  ];
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
