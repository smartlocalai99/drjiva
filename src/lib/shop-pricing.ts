export type ShopPricingLine = {
  price: number | null;
  quantity: number;
};

export type ShopPricingSummary = {
  hasPendingPrices: boolean;
  knownSubtotal: number;
  pendingItemCount: number;
  pendingLineCount: number;
};

export function summarizeShopPricing(
  lines: readonly ShopPricingLine[],
): ShopPricingSummary {
  let knownSubtotal = 0;
  let pendingItemCount = 0;
  let pendingLineCount = 0;

  for (const line of lines) {
    if (line.price === null) {
      pendingLineCount += 1;
      pendingItemCount += line.quantity;
    } else {
      knownSubtotal += line.price * line.quantity;
    }
  }

  return {
    hasPendingPrices: pendingLineCount > 0,
    knownSubtotal,
    pendingItemCount,
    pendingLineCount,
  };
}
