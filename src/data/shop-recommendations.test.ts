import { describe, expect, it } from "vitest";

import type { ShopProduct } from "./shopProductModel";
import { getShopProductRecommendations } from "./shop-recommendations";

function product(
  id: string,
  overrides: Partial<ShopProduct> = {},
): ShopProduct {
  return {
    category: "Pain relief",
    commonUses: null,
    composition: "Paracetamol",
    fullDescription: "Description",
    hasUniqueCatalogueName: true,
    hospitalName: "Hospital",
    id,
    imageUrl: `https://images.test/${id}.png`,
    informationReviewedAt: null,
    informationSourceName: null,
    informationSourceUrl: null,
    name: id,
    packSize: "Tablet",
    price: 49,
    safetyNote: "Use as directed.",
    sectionRanks: {},
    shortDescription: "Description",
    ...overrides,
  };
}

describe("getShopProductRecommendations", () => {
  it("excludes the current product and prioritizes related sections", () => {
    const current = product("Current", { sectionRanks: { headache: 1 } });
    const sameSection = product("Same section", {
      category: "Other",
      composition: "Other",
      sectionRanks: { headache: 2 },
    });
    const unrelated = product("Unrelated", {
      category: "Other",
      composition: "Other",
    });

    expect(
      getShopProductRecommendations(
        [unrelated, current, sameSection],
        current,
      ).map(({ id }) => id),
    ).toEqual(["Same section", "Unrelated"]);
  });

  it("honors the requested limit", () => {
    const current = product("Current");
    expect(
      getShopProductRecommendations(
        [current, product("A"), product("B")],
        current,
        1,
      ),
    ).toHaveLength(1);
  });
});
