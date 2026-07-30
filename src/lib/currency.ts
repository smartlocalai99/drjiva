export function formatRupees(value: number): string {
  if (!Number.isFinite(value)) {
    return '₹0';
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

export const DUMMY_MEDICINE_PRICE = 49;

export function resolveShopProductPrice(price: number | null): number {
  return price ?? DUMMY_MEDICINE_PRICE;
}

export function formatShopProductPrice(price: number | null): string {
  return formatRupees(resolveShopProductPrice(price));
}
