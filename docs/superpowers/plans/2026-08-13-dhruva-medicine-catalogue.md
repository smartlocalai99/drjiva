# Dhruva Medicine Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all imaged Dhruva Hospitals medicines in Shop and Shop search while preserving Dhruva image-backed selection in Add Medicine reminders and Today.

**Architecture:** Expand the existing Shop product model from one hard-coded hospital to a two-hospital allowlist, then keep hospital filtering and section construction in the pure `shopSections` layer. The Shop screen owns a small `all | asian | dhruva` selection state; Add Medicine and Today retain their existing verified-catalogue relationship and receive regression coverage.

**Tech Stack:** Expo 57, React Native, Expo Router, TypeScript, Supabase JS, Vitest.

## Global Constraints

- Preserve the existing cart, checkout, order, notification, and reminder-course behavior.
- Shop includes only supported-hospital medicine rows with non-empty `image_url` values.
- Never hard-code the expected Dhruva image count; render all eligible live rows.
- Preserve all unrelated dirty-worktree changes.
- Use `Dhruva Hospitals` and `ASIAN MULTI SPECIALITY HOSPITALS` as canonical supplier names.

---

### Task 1: Multi-hospital Shop product model

**Files:**
- Modify: `src/data/shopProductModel.ts`
- Modify: `src/data/shopProducts.ts`
- Test: `src/data/shopProducts.test.ts`

**Interfaces:**
- Produces: `SHOP_HOSPITALS`, `ShopHospitalCode`, `ShopHospitalFilter`, `getShopHospitalCode(hospitalName)`, and `mapMedicineRowsToShopProducts(rows)`.
- Preserves: `ShopProduct.hospitalName`, `ShopProduct.id`, and the existing product detail/cart interfaces.

- [ ] **Step 1: Write failing model tests**

Add test rows for `Dhruva Hospitals`, reject unsupported hospitals, and verify that equal normalized medicine names from Asian and Dhruva remain two distinct products while both receive `hasUniqueCatalogueName: false`.

- [ ] **Step 2: Run the focused model tests and confirm failure**

Run: `npm test -- --run src/data/shopProducts.test.ts`

Expected: Dhruva inclusion assertions fail because the mapper currently accepts only Asian Hospitals.

- [ ] **Step 3: Implement the supported-hospital model**

Replace the single-hospital predicate with canonical definitions:

```ts
export const SHOP_HOSPITALS = {
  asian: 'ASIAN MULTI SPECIALITY HOSPITALS',
  dhruva: 'Dhruva Hospitals',
} as const;

export type ShopHospitalCode = keyof typeof SHOP_HOSPITALS;
export type ShopHospitalFilter = 'all' | ShopHospitalCode;
```

Map input hospital names case-insensitively. Deduplicate by `${hospitalCode}:${normalizedName}` and separately count normalized names across the complete eligible set to calculate `hasUniqueCatalogueName` safely.

- [ ] **Step 4: Expand the Supabase Shop query**

Change the catalogue query from `.ilike('hospital_name', ASIAN_HOSPITAL_NAME)` to `.in('hospital_name', Object.values(SHOP_HOSPITALS))`, retaining pagination, image predicates, ordering, abort handling, and cache behavior.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run src/data/shopProducts.test.ts`

Expected: all Shop product model tests pass.

### Task 2: Hospital-aware Shop sections and filter UI

**Files:**
- Modify: `src/data/shopSections.ts`
- Test: `src/data/shopSections.test.ts`
- Modify: `app/shop.tsx`
- Modify: `src/components/shop/shop-product-card.tsx`

**Interfaces:**
- Consumes: `ShopHospitalFilter`, `getShopHospitalCode`, and existing `ShopProduct` values.
- Produces: `buildShopSections(products, query, hospitalFilter)`.

- [ ] **Step 1: Write failing section tests**

Cover:

```ts
buildShopSections(products, '', 'asian')
buildShopSections(products, '', 'dhruva')
buildShopSections(products, '', 'all')
buildShopSections(products, 'paracetamol', 'dhruva')
```

Assert that Asian retains curated category sections, Dhruva gets one alphabetical supplier section, All includes both, and filtered search never leaks the other hospital.

- [ ] **Step 2: Run section tests and confirm failure**

Run: `npm test -- --run src/data/shopSections.test.ts`

Expected: failure because the third filter parameter and Dhruva section do not exist.

- [ ] **Step 3: Implement pure section filtering**

Add an optional third argument defaulting to `all`. Apply hospital filtering before search. Preserve Asian curated section ranking and append one `dhruva` section ordered by product name for All/Dhruva views.

- [ ] **Step 4: Add the compact Shop filter**

In `app/shop.tsx`, add `hospitalFilter` state and render accessible `All`, `Asian`, and `Dhruva` pills directly below the search bar. Pass the selected filter into `buildShopSections`, preserve the current query when toggled, and update empty-state copy with the selected hospital label.

- [ ] **Step 5: Identify suppliers on cards**

Add a one-line supplier label to `ShopProductCard` using `product.hospitalName`, without changing press, quantity, price, or cart behavior.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- --run src/data/shopSections.test.ts src/data/shopProducts.test.ts`

Expected: all focused tests pass.

### Task 3: Reminder and Today regression coverage

**Files:**
- Test: `src/lib/medicineCourses.test.ts`
- Test: `src/data/medicines.test.ts`
- Modify only if a failing test exposes a real gap: `src/lib/medicineCourses.ts`, `src/data/medicines.ts`, or `app/add-medicine.tsx`

**Interfaces:**
- Preserves: `fetchMedicineCatalogue(hospitalId)` returning `MedicineCatalogueItem[]` with `hospitalId`, `hospitalName`, and `imageUrl`.
- Preserves: `fetchMedicinesForDate(patientId, date)` resolving the linked medicine `image_url` into `Medicine.imageUrl`.

- [ ] **Step 1: Add Dhruva catalogue regression coverage**

Mock a Dhruva row and assert that `fetchMedicineCatalogue(DHRUVA_ID)` applies the hospital-ID filter and preserves the image URL and hospital name.

- [ ] **Step 2: Add Today image propagation coverage**

Extend the medicine data test with a course joined to a Dhruva medicine and assert the returned Today medicine uses its `image_url` and `Dhruva Hospitals` name.

- [ ] **Step 3: Run focused reminder tests**

Run: `npm test -- --run src/lib/medicineCourses.test.ts src/data/medicines.test.ts`

Expected: pass without production changes if the existing relationship is sound; otherwise implement only the minimal exposed fix and rerun.

### Task 4: Full verification and live catalogue audit

**Files:**
- No expected source changes.

- [ ] **Step 1: Run TypeScript checking**

Run: `npm run typecheck`

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: all test files and tests pass.

- [ ] **Step 3: Validate Expo configuration**

Run: `npx expo config --type public`

Expected: valid Expo 57 public configuration with the current app/runtime settings.

- [ ] **Step 4: Audit live Dhruva data**

Query Dhruva medicine totals and count non-empty image URLs. Report catalogue counts as a separate data condition; do not manufacture missing image mappings.

- [ ] **Step 5: Review the final diff**

Run: `git diff --check` and inspect `git diff` for only scoped source/test changes plus pre-existing user changes.
