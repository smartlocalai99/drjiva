import { describe, expect, it, vi } from 'vitest';

import {
  ASIAN_HOSPITAL_NAME,
  DHRUVA_HOSPITAL_NAME,
  SHANKAR_HOSPITAL_NAME,
  mapMedicineRowsToShopProducts,
  type ShopProduct,
} from './shopProductModel';

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({}) },
}));
vi.mock('../lib/reportAuth', () => ({
  ensureSecureReportSession: vi.fn(async () => 'anonymous-user'),
}));

import { findCachedShopProduct } from './shopProducts';

const BASE_ROW = {
  category: null,
  composition: null,
  dosage_form: null,
  hospital_name: ASIAN_HOSPITAL_NAME,
  id: '1',
  image_url: 'https://db.test/ab-flo.jpg',
  name: 'AB Flo',
  price: 32,
  shop_common_uses: null,
  shop_full_description: null,
  shop_information_reviewed_at: null,
  shop_information_source_name: null,
  shop_information_source_url: null,
  shop_product_section_items: null,
  shop_safety_note: null,
  shop_short_description: null,
};

const BASE_PRODUCT: ShopProduct = {
  category: 'PAIN MANAGEMENT',
  commonUses: null,
  composition: 'PARACETAMOL-650MG',
  fullDescription: 'Full description.',
  hasUniqueCatalogueName: true,
  hospitalName: ASIAN_HOSPITAL_NAME,
  id: '1',
  imageUrl: 'https://db.test/ab-flo.jpg',
  informationReviewedAt: null,
  informationSourceName: null,
  informationSourceUrl: null,
  name: 'AB Flo',
  packSize: 'Tablet',
  price: 32,
  safetyNote: 'Safety note.',
  sectionRanks: {},
  shortDescription: 'Short description.',
};

describe('shop product catalogue', () => {
  it('keeps eligible Asian Hospitals products with a real image and removes normalized duplicates', () => {
    const products = mapMedicineRowsToShopProducts([
      {
        ...BASE_ROW,
        category: 'PAIN MANAGEMENT',
        composition: 'PARACETAMOL-650MG',
        dosage_form: 'TABLET/CAPSULE',
        shop_product_section_items: [{ section_code: 'fever', sort_order: 1 }],
      },
      {
        ...BASE_ROW,
        id: '2',
        image_url: 'https://db.test/duplicate.jpg',
        name: 'ab-flo',
        price: 40,
      },
      {
        ...BASE_ROW,
        id: '3',
        image_url: null,
        name: 'No image',
        price: 20,
      },
    ]);

    expect(products).toHaveLength(1);
    expect(products[0]).toEqual(
      expect.objectContaining({
        hasUniqueCatalogueName: false,
        hospitalName: ASIAN_HOSPITAL_NAME,
        id: '1',
        imageUrl: 'https://db.test/ab-flo.jpg',
        name: 'AB Flo',
        packSize: 'Tablet Capsule',
        price: 32,
        sectionRanks: { fever: 1 },
      }),
    );
  });

  it('includes Dhruva products with a real image', () => {
    expect(
      mapMedicineRowsToShopProducts([
        {
          ...BASE_ROW,
          hospital_name: DHRUVA_HOSPITAL_NAME,
          id: 'dhruva-product',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        hospitalName: DHRUVA_HOSPITAL_NAME,
        id: 'dhruva-product',
      }),
    ]);
  });

  it('includes Shankar products with a real image', () => {
    expect(
      mapMedicineRowsToShopProducts([
        {
          ...BASE_ROW,
          hospital_name: SHANKAR_HOSPITAL_NAME,
          id: 'shankar-product',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        hospitalName: SHANKAR_HOSPITAL_NAME,
        id: 'shankar-product',
      }),
    ]);
  });

  it('keeps same-name products from different supported hospitals and marks the name ambiguous', () => {
    const products = mapMedicineRowsToShopProducts([
      BASE_ROW,
      {
        ...BASE_ROW,
        hospital_name: DHRUVA_HOSPITAL_NAME,
        id: 'dhruva-ab-flo',
      },
    ]);

    expect(products).toHaveLength(2);
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hasUniqueCatalogueName: false,
          hospitalName: ASIAN_HOSPITAL_NAME,
        }),
        expect.objectContaining({
          hasUniqueCatalogueName: false,
          hospitalName: DHRUVA_HOSPITAL_NAME,
        }),
      ]),
    );
  });

  it('excludes rows from unsupported hospitals even when priced and imaged', () => {
    expect(
      mapMedicineRowsToShopProducts([
        { ...BASE_ROW, hospital_name: 'Some Other Hospital', id: 'other' },
      ]),
    ).toEqual([]);
  });

  it('excludes rows without a real image even when priced', () => {
    expect(
      mapMedicineRowsToShopProducts([
        { ...BASE_ROW, id: 'no-image', image_url: '' },
      ]),
    ).toEqual([]);
  });

  it('keeps an eligible product with a missing or non-positive price instead of rejecting it', () => {
    const [missing, zero] = mapMedicineRowsToShopProducts([
      { ...BASE_ROW, id: 'missing', price: null },
      { ...BASE_ROW, id: 'zero', name: 'Zero price', price: 0 },
    ]);

    expect(missing).toEqual(expect.objectContaining({ id: 'missing', price: null }));
    expect(zero).toEqual(expect.objectContaining({ id: 'zero', price: null }));
  });

  it('prefers reviewed database copy over the generated fallback', () => {
    const [product] = mapMedicineRowsToShopProducts([
      {
        ...BASE_ROW,
        composition: 'CETIRIZINE 10MG',
        shop_common_uses: 'Relieves allergy symptoms such as sneezing and itching.',
        shop_full_description: 'Reviewed full description.',
        shop_information_reviewed_at: '2026-07-01T00:00:00.000Z',
        shop_information_source_name: 'MedlinePlus',
        shop_information_source_url: 'https://medlineplus.gov/druginfo/example.html',
        shop_safety_note: 'Reviewed safety note.',
        shop_short_description: 'Reviewed short description.',
      },
    ]);

    expect(product).toEqual(
      expect.objectContaining({
        commonUses: 'Relieves allergy symptoms such as sneezing and itching.',
        fullDescription: 'Reviewed full description.',
        informationReviewedAt: '2026-07-01T00:00:00.000Z',
        informationSourceName: 'MedlinePlus',
        informationSourceUrl: 'https://medlineplus.gov/druginfo/example.html',
        safetyNote: 'Reviewed safety note.',
        shortDescription: 'Reviewed short description.',
      }),
    );
  });

  it('fills missing description fields from the fallback copy generator', () => {
    const [product] = mapMedicineRowsToShopProducts([
      { ...BASE_ROW, composition: 'IBUPROFEN 400MG', dosage_form: 'TABLET' },
    ]);

    expect(product).toEqual(
      expect.objectContaining({
        commonUses: null,
        fullDescription:
          'This tablet contains IBUPROFEN 400MG. Use it only when it matches your prescription or a pharmacist confirms it.',
        informationSourceName: null,
        informationSourceUrl: null,
        shortDescription:
          'Tablet containing IBUPROFEN 400MG. Check that it matches your prescription.',
      }),
    );
  });
});

describe('findCachedShopProduct', () => {
  const products: ShopProduct[] = [
    { ...BASE_PRODUCT, id: 'ab-flo-uuid', name: 'AB Flo' },
    { ...BASE_PRODUCT, id: 'zerodol-uuid', name: 'Zerodol SP' },
  ];

  it('returns the exact matching product by id', () => {
    expect(findCachedShopProduct(products, 'zerodol-uuid')).toEqual(
      expect.objectContaining({ id: 'zerodol-uuid', name: 'Zerodol SP' }),
    );
  });

  it('returns null when no product matches the id', () => {
    expect(findCachedShopProduct(products, 'missing-uuid')).toBeNull();
  });
});
