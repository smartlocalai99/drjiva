import { describe, expect, it } from 'vitest';

import { mapMedicineRowsToShopProducts } from './shopProductModel';

describe('shop product catalogue', () => {
  it('keeps products with database images and removes normalized duplicates', () => {
    const products = mapMedicineRowsToShopProducts([
      {
        category: 'PAIN MANAGEMENT',
        composition: 'PARACETAMOL-650MG',
        dosage_form: 'TABLET/CAPSULE',
        hospital_name: 'Asian Hospital',
        id: '1',
        image_url: 'https://db.test/ab-flo.jpg',
        name: 'AB Flo',
        price: 32,
        shop_product_section_items: [
          { section_code: 'fever', sort_order: 1 },
        ],
      },
      {
        category: null,
        composition: null,
        dosage_form: null,
        hospital_name: 'Dhruva Hospital',
        id: '2',
        image_url: 'https://db.test/duplicate.jpg',
        name: 'ab-flo',
        price: 40,
        shop_product_section_items: null,
      },
      {
        category: null,
        composition: null,
        dosage_form: null,
        hospital_name: 'Asian Hospital',
        id: '3',
        image_url: null,
        name: 'No image',
        price: 20,
        shop_product_section_items: null,
      },
    ]);

    expect(products).toHaveLength(1);
    expect(products[0]).toEqual(
      expect.objectContaining({
        hasUniqueCatalogueName: false,
        hospitalName: 'Asian Hospital',
        id: '1',
        imageUrl: 'https://db.test/ab-flo.jpg',
        name: 'AB Flo',
        packSize: 'Tablet Capsule',
        price: 32,
        sectionRanks: { fever: 1 },
      }),
    );
  });

  it('does not expose products without a real positive price', () => {
    expect(
      mapMedicineRowsToShopProducts([
        {
          category: null,
          composition: null,
          dosage_form: 'TABLET',
          hospital_name: null,
          id: 'missing',
          image_url: 'https://db.test/missing.jpg',
          name: 'Missing price',
          price: null,
          shop_product_section_items: null,
        },
        {
          category: null,
          composition: null,
          dosage_form: 'TABLET',
          hospital_name: null,
          id: 'zero',
          image_url: 'https://db.test/zero.jpg',
          name: 'Zero price',
          price: 0,
          shop_product_section_items: null,
        },
      ]),
    ).toEqual([]);
  });
});
