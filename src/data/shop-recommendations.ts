import type { ShopProduct } from "./shopProductModel";

function recommendationScore(
  candidate: ShopProduct,
  current: ShopProduct,
): number {
  let score = 0;
  const currentSections = new Set(Object.keys(current.sectionRanks));

  if (current.category && candidate.category === current.category) {
    score += 6;
  }
  if (current.composition && candidate.composition === current.composition) {
    score += 3;
  }
  for (const sectionCode of Object.keys(candidate.sectionRanks)) {
    if (currentSections.has(sectionCode)) {
      score += 4;
    }
  }

  return score;
}

export function getShopProductRecommendations(
  products: readonly ShopProduct[],
  current: ShopProduct,
  limit = 6,
): ShopProduct[] {
  return products
    .filter((product) => product.id !== current.id)
    .map((product) => ({
      product,
      score: recommendationScore(product, current),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.product.name.localeCompare(right.product.name),
    )
    .slice(0, Math.max(0, limit))
    .map(({ product }) => product);
}
