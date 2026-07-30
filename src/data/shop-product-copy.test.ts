import { describe, expect, it } from 'vitest';

import { getShopProductFallbackCopy } from './shop-product-copy';

describe('getShopProductFallbackCopy', () => {
  it('builds useful copy from composition, category, and dosage form without inventing a use', () => {
    expect(
      getShopProductFallbackCopy({
        category: 'RESPIRATORY',
        composition: 'CETIRIZINE 10MG',
        dosageForm: 'TABLET',
      }),
    ).toEqual({
      commonUses: null,
      fullDescription:
        'This tablet contains CETIRIZINE 10MG and is listed in the respiratory category. Use it only when it matches your prescription or a pharmacist confirms it.',
      safetyNote:
        'Read the pack and follow your doctor or pharmacist. Ask before use for a child, during pregnancy or breastfeeding, with allergies, or with other medicines.',
      shortDescription:
        'Tablet containing CETIRIZINE 10MG. Check that it matches your prescription.',
    });
  });

  it('falls back to review copy when composition and category are missing', () => {
    expect(
      getShopProductFallbackCopy({
        category: '',
        composition: '',
        dosageForm: '',
      }),
    ).toEqual({
      commonUses: null,
      fullDescription:
        'Use this medicine only when it matches your prescription or a pharmacist confirms the product.',
      safetyNote:
        'Read the pack and follow your doctor or pharmacist. Ask before use for a child, during pregnancy or breastfeeding, with allergies, or with other medicines.',
      shortDescription:
        'Medicine details are being reviewed. Check the pack or ask a pharmacist.',
    });
  });

  it('omits the category clause when category is missing', () => {
    const copy = getShopProductFallbackCopy({
      category: '',
      composition: 'IBUPROFEN 400MG',
      dosageForm: 'TABLET',
    });

    expect(copy.fullDescription).toBe(
      'This tablet contains IBUPROFEN 400MG. Use it only when it matches your prescription or a pharmacist confirms it.',
    );
  });

  it('falls back to a generic "Medicine" label when dosage form is missing', () => {
    const copy = getShopProductFallbackCopy({
      category: '',
      composition: 'IBUPROFEN 400MG',
      dosageForm: '',
    });

    expect(copy.shortDescription).toBe(
      'Medicine containing IBUPROFEN 400MG. Check that it matches your prescription.',
    );
  });
});
