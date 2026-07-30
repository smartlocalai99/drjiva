import { describe, expect, it } from 'vitest';

import type { ShopProduct } from './shopProductModel';
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
      product('cold-1', 'Cold One', { cold: 1 }),
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      'Headache',
      'Body Pains',
      'Fever',
      'Cold',
    ]);
    expect(sections[0]?.data.map((item) => item.id)).toEqual([
      'head-1',
      'head-2',
    ]);
    expect(sections[3]?.data.map((item) => item.id)).toEqual([
      'cold-1',
      'cold-2',
    ]);
  });

  it('appends one "All medicines" section with products outside every curated section', () => {
    const curated = product('fever-1', 'Fever One', { fever: 1 });
    const uncurated = product('generic-1', 'Generic One', {});

    const sections = buildShopSections([curated, uncurated]);
    const allSection = sections.at(-1);

    expect(allSection).toEqual(
      expect.objectContaining({
        code: 'all',
        title: 'All medicines',
      }),
    );
    expect(allSection?.data.map((item) => item.id)).toEqual(['generic-1']);
  });

  it('omits "All medicines" entirely when every product is already curated', () => {
    const curated = product('fever-1', 'Fever One', { fever: 1 });
    const sections = buildShopSections([curated]);

    expect(sections.some((section) => section.code === 'all')).toBe(false);
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

  it('returns no sections when a medicine search has no matches', () => {
    expect(
      buildShopSections(
        [product('dolo', 'Dolo-650', { fever: 1 })],
        'amoxicillin',
      ),
    ).toEqual([]);
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
