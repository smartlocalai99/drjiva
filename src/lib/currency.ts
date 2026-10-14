export function formatRupees(value: number): string {
  if (!Number.isFinite(value)) {
    return '₹0';
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

export const DUMMY_MEDICINE_PRICE = 49;
export const SHOP_DISCOUNT_PERCENT = 5;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resolveShopProductPrice(price: number | null): number {
  const mrp = resolveShopProductMrp(price);
  return roundCurrency(mrp * (1 - SHOP_DISCOUNT_PERCENT / 100));
}

export function resolveShopProductMrp(price: number | null): number {
  return price ?? DUMMY_MEDICINE_PRICE;
}

export function formatShopProductMrp(price: number | null): string {
  return formatRupees(resolveShopProductMrp(price));
}

export function formatShopProductPrice(price: number | null): string {
  return formatRupees(resolveShopProductPrice(price));
}
