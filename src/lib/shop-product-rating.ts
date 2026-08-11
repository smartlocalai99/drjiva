const PRODUCT_RATINGS = [4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 5] as const;

function hashProduct(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getShopProductRating(productId: string, productName: string) {
  const hash = hashProduct(`${productId}:${productName}`);
  const rating = PRODUCT_RATINGS[hash % PRODUCT_RATINGS.length] ?? 4.8;

  return {
    count: 120 + (hash % 1381),
    label: Number.isInteger(rating) ? String(rating) : rating.toFixed(1),
    recentOrders: 18 + (hash % 79),
  };
}
