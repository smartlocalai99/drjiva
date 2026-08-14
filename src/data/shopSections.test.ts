import { describe, expect, it } from 'vitest';

import type { ShopProduct } from './shopProductModel';
import { DHRUVA_HOSPITAL_NAME } from './shopProductModel';
import {
  buildReminderMedicineReorders,
  buildShopSections,
  getUniqueReminderMedicineNames,
} from './shopSections';

function product(
  id: string,
  name: string,
  sectionRanks: ShopProduct['sectionRanks'],
  overrides: Partial<ShopProduct> = {},
): ShopProduct {
  return {
    category: 'Medicine',
    commonUses: null,
    composition: '',
    fullDescription: 'Full description.',
    hasUniqueCatalogueName: true,
    hospitalName: 'ASIAN MULTI SPECIALITY HOSPITALS',
    id,
    imageUrl: `https://images.test/${id}.jpg`,
    informationReviewedAt: null,
    informationSourceName: null,
    informationSourceUrl: null,
    name,
    packSize: 'Tablet',
    price: 32,
    safetyNote: 'Safety note.',
    sectionRanks,
    shortDescription: 'Short description.',
    ...overrides,
  };
}

describe('shop sections', () => {
  it('uses the curated section order and item ranks', () => {
    const sections = buildShopSections([
      product('cold-2', 'Cold Two', { cold: 2 }),
      product('pain-1', 'Pain One', { body_pains: 1 }),
      product('head-2', 'Head Two', { headache: 2 }),
      product('head-1', 'Head One', { headache: 1 }),
      product('fever-1', 'Fever One', { fever: 1 }),
      product('stomach-1', 'Stomach One', { stomach_pain: 1 }),
      product('cold-1', 'Cold One', { cold: 1 }),
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      'Headache',
      'Fever',
      'Body Pains',
      'Stomach Pain',
      'Cold',
    ]);
    expect(sections[0]?.data.map((item) => item.id)).toEqual([
      'head-1',
      'head-2',
    ]);
    expect(sections[4]?.data.map((item) => item.id)).toEqual([
      'cold-1',
      'cold-2',
    ]);
  });

  it('exposes the vitamins shelf as Multivitamins for banner navigation', () => {
    const sections = buildShopSections([
      product('vitamin-1', 'Vitamin One', { vitamins: 1 }),
    ]);

    expect(sections).toMatchObject([
      { code: 'vitamins', title: 'Multivitamins' },
    ]);
  });

  it('never includes uncurated products outside of search', () => {
    const curated = product('fever-1', 'Fever One', { fever: 1 });
    const uncurated = product('generic-1', 'Generic One', {});

    const sections = buildShopSections([curated, uncurated]);

    expect(sections.flatMap((section) => section.data.map((item) => item.id))).toEqual([
      'fever-1',
    ]);
  });

  it('returns no sections when nothing is curated', () => {
    const uncurated = product('generic-1', 'Generic One', {});
    expect(buildShopSections([uncurated])).toEqual([]);
  });

  it('shows Dhruva medicines alphabetically in the Dhruva filter', () => {
    const sections = buildShopSections(
      [
        product('asian', 'Asian medicine', { fever: 1 }),
        product('dhruva-z', 'Zed medicine', {}, {
          hospitalName: DHRUVA_HOSPITAL_NAME,
        }),
        product('dhruva-a', 'Alpha medicine', {}, {
          hospitalName: DHRUVA_HOSPITAL_NAME,
        }),
      ],
      '',
      'dhruva',
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      code: 'dhruva',
      title: DHRUVA_HOSPITAL_NAME,
    });
    expect(sections[0]?.data.map((item) => item.id)).toEqual([
      'dhruva-a',
      'dhruva-z',
    ]);
  });

  it('appends Dhruva medicines to the curated Asian shelves in All', () => {
    const sections = buildShopSections([
      product('asian', 'Asian medicine', { fever: 1 }),
      product('dhruva', 'Dhruva medicine', {}, {
        hospitalName: DHRUVA_HOSPITAL_NAME,
      }),
    ]);

    expect(sections.map((section) => section.code)).toEqual([
      'fever',
      'dhruva',
    ]);
  });

  it('searches every hospital even when a browse filter is selected', () => {
    const products = [
      product('asian', 'Paracetamol Asian', { fever: 1 }),
      product('dhruva', 'Paracetamol Dhruva', {}, {
        hospitalName: DHRUVA_HOSPITAL_NAME,
      }),
    ];

    expect(
      buildShopSections(products, 'paracetamol', 'asian')[0]?.data.map(
        (item) => item.id,
      ),
    ).toEqual(['asian', 'dhruva']);
    expect(
      buildShopSections(products, 'paracetamol', 'dhruva')[0]?.data.map(
        (item) => item.id,
      ),
    ).toEqual(['asian', 'dhruva']);
  });

  it('returns the closest medicine for a misspelled search', () => {
    const sections = buildShopSections(
      [
        product('para', 'Paracetamol', { fever: 1 }),
        product('amox', 'Amoxicillin', {}),
      ],
      'paracetmol',
      'asian',
    );

    expect(sections[0]).toMatchObject({ title: 'Closest matches' });
    expect(sections[0]?.data[0]?.id).toBe('para');
  });

  it('keeps a price-pending product discoverable through search', () => {
    const products = [
      product('dolo', 'Dolo-650', { fever: 1 }, {
        composition: 'Paracetamol 650mg',
      }),
      product('cold', 'Cold tablet', { cold: 1 }, {
        composition: 'Cetirizine',
      }),
      product('generic', 'Generic pending', {}, {
        price: null,
        shortDescription: 'Contains paracetamol derivative.',
      }),
    ];

    expect(
      buildShopSections(products, 'paracetamol')[0]?.data.map(
        (item) => item.id,
      ),
    ).toEqual(expect.arrayContaining(['dolo', 'generic']));
  });

  it('returns closest matches when a medicine search has no direct matches', () => {
    expect(
      buildShopSections(
        [product('dolo', 'Dolo-650', { fever: 1 })],
        'amoxicillin',
      ),
    ).toEqual([
      expect.objectContaining({
        data: [expect.objectContaining({ id: 'dolo' })],
        title: 'Closest matches',
      }),
    ]);
  });

  it('deduplicates reminder medicine names without using images', () => {
    expect(
      getUniqueReminderMedicineNames([
        ' Dolo-650 ',
        'dolo 650',
        'Cetzine',
      ]),
    ).toEqual(['Dolo-650', 'Cetzine']);
  });

  it('matches reminder medicines only to exact normalized catalogue names', () => {
    const dolo = product('dolo', 'DOLO-650', { fever: 1 });
    const cetzine = product('cetzine', 'Cetzine Tablet', { cold: 1 });

    const reorders = buildReminderMedicineReorders(
      [' Dolo 650 ', 'Cetzine', 'Unknown medicine'],
      [dolo, cetzine],
    );

    expect(
      reorders.map(({ medicineName, product: matchedProduct }) => ({
        medicineName,
        productId: matchedProduct.id,
      })),
    ).toEqual([{ medicineName: 'Dolo 650', productId: 'dolo' }]);
  });

  it('does not offer a reorder when an exact catalogue name is ambiguous', () => {
    const reorders = buildReminderMedicineReorders(
      ['Dolo-650'],
      [
        product('dolo-a', 'Dolo 650', { fever: 1 }),
        product('dolo-b', 'DOLO-650', { fever: 2 }),
      ],
    );

    expect(reorders).toEqual([]);
  });
});
