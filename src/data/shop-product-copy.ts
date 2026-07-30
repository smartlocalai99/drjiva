export type ShopProductCopyInput = {
  category: string;
  composition: string;
  dosageForm: string;
};

export type ShopProductCopy = {
  commonUses: string | null;
  fullDescription: string;
  safetyNote: string;
  shortDescription: string;
};

const SAFETY_NOTE =
  'Read the pack and follow your doctor or pharmacist. Ask before use for a child, during pregnancy or breastfeeding, with allergies, or with other medicines.';

const REVIEW_PENDING_COPY: ShopProductCopy = {
  commonUses: null,
  fullDescription:
    'Use this medicine only when it matches your prescription or a pharmacist confirms the product.',
  safetyNote: SAFETY_NOTE,
  shortDescription:
    'Medicine details are being reviewed. Check the pack or ask a pharmacist.',
};

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getShopProductFallbackCopy(
  input: ShopProductCopyInput,
): ShopProductCopy {
  const composition = input.composition.trim();
  if (!composition) {
    return REVIEW_PENDING_COPY;
  }

  const category = input.category.trim();
  const dosageForm = input.dosageForm.trim();
  const formLower = dosageForm ? dosageForm.toLowerCase() : 'medicine';
  const formLabel = titleCase(formLower);
  const categoryClause = category
    ? ` and is listed in the ${category.toLowerCase()} category`
    : '';

  return {
    commonUses: null,
    fullDescription: `This ${formLower} contains ${composition}${categoryClause}. Use it only when it matches your prescription or a pharmacist confirms it.`,
    safetyNote: SAFETY_NOTE,
    shortDescription: `${formLabel} containing ${composition}. Check that it matches your prescription.`,
  };
}
