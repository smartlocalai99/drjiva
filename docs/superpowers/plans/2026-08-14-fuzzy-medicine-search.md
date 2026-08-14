# Fuzzy Medicine Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shop and Add Medicine return useful results for correctly spelled, partially entered, and misspelled medicine searches, while making Dhruva medicines visibly branded and easy to browse.

**Architecture:** Add a pure generic search-ranking function to `medicineSearch.ts`, with direct-match filtering followed by adjacent-transposition-aware nearest fallback. Reuse it from Shop section construction and the existing Add Medicine catalogue filter; keep the catalogue cached locally and preserve all list result limits. Extend the shared hospital logo resolver and pass hospital identity through existing UI call sites.

**Tech Stack:** Expo 57, React Native, Expo Router, TypeScript, Supabase JS, Vitest, EAS Update.

## Global Constraints

- Search all supported Shop hospitals whenever the query is non-empty.
- Return direct matches before using nearest-match fallback.
- Keep limits at 80 Shop results and 40 Add Medicine results.
- Do not issue a Supabase request for every keystroke.
- Use `assets/dhruvalogo.png` with `expo-image` and `contentFit="contain"`.
- Preserve all unrelated dirty-worktree changes.
- No native dependency or runtime-version change.

---

### Task 1: Shared typo-tolerant ranking engine

**Files:**
- Modify: `src/lib/medicineSearch.ts`
- Test: `src/lib/medicineSearch.test.ts`

**Interfaces:**
- Produces: `searchMedicineCatalogue<T>(entries, query, limit, getSearchText?)` returning `{ items: T[]; usedNearestFallback: boolean }`.
- Preserves: `filterMedicineCatalogue<T>(medicines, query, limit)` returning `T[]` for existing consumers.

- [ ] **Step 1: Add failing tests**

Test `dloo` → `Dolo 650`, `paracetmol` → `Paracetamol`, direct `dolo` excluding unrelated fallback items, and adjacent transpositions outranking larger edit distances.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/lib/medicineSearch.test.ts`

Expected: new nearest-match assertions fail because current code returns an empty array.

- [ ] **Step 3: Implement minimal ranking**

Add normalized direct-match ranking and an optimal-string-alignment edit-distance helper. For a non-empty query, return ranked direct matches when any exist; otherwise rank every entry by name/text distance and return the closest `limit` entries with `usedNearestFallback: true`.

- [ ] **Step 4: Preserve the existing API**

Make `filterMedicineCatalogue` delegate to `searchMedicineCatalogue(...).items`, keeping Add Medicine, document hospital search, and existing tests source-compatible.

- [ ] **Step 5: Verify green**

Run: `npm test -- --run src/lib/medicineSearch.test.ts`

Expected: all medicine search tests pass.

### Task 2: Universal Shop search and visible Dhruva discovery

**Files:**
- Modify: `src/data/shopSections.ts`
- Test: `src/data/shopSections.test.ts`
- Modify: `app/shop.tsx`

**Interfaces:**
- Consumes: `searchMedicineCatalogue` from Task 1.
- Produces: Shop search sections titled `Search results` or `Closest matches`.

- [ ] **Step 1: Add failing Shop tests**

Assert that query `dhrva` finds a Dhruva product while the active filter is `asian`, `paracetmol` finds a matching product, and direct searches retain the `Search results` title.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/data/shopSections.test.ts`

Expected: active-filter and misspelling assertions fail.

- [ ] **Step 3: Use the shared search engine**

When `query` is non-empty, pass all products to `searchMedicineCatalogue` with a selector joining name, composition, category, hospital, short description, and common uses. Ignore `hospitalFilter` only for that query path. Set the section title from `usedNearestFallback`.

- [ ] **Step 4: Add Dhruva discovery card**

In the no-query `All` view, add a compact pressable header card above banners showing the Dhruva wordmark, the live count from loaded Dhruva products, and `Browse medicines`. Pressing it sets `hospitalFilter` to `dhruva`.

- [ ] **Step 5: Verify green**

Run: `npm test -- --run src/data/shopSections.test.ts src/lib/medicineSearch.test.ts`

Expected: all targeted search tests pass.

### Task 3: Shared Dhruva logo propagation

**Files:**
- Modify: `src/components/HospitalLogo.tsx`
- Modify: `src/components/shop/shop-product-card.tsx`
- Modify: `app/shop.tsx`
- Modify: `app/add-medicine.tsx`
- Modify: `app/reminders.tsx`
- Modify: `src/components/dashboard/MedicineCard.tsx`

**Interfaces:**
- Produces: `HospitalLogo({ hospitalName?, roundedSquare?, size? })` choosing the Dhruva asset case-insensitively.
- Preserves: existing `HospitalLogo` behavior when no hospital name is supplied.

- [ ] **Step 1: Implement hospital-aware logo resolution**

Add `DHRUVA_LOGO = require('../../assets/dhruvalogo.png')`, normalize `hospitalName`, and select it only for `Dhruva Hospitals`. Keep the generic hospital logo fallback.

- [ ] **Step 2: Pass hospital names through existing surfaces**

Pass the known hospital name from Today cards, reminder cards, and Add Medicine review. Use the wide wordmark directly in the Shop Dhruva discovery/section/supplier areas where horizontal space permits.

- [ ] **Step 3: Verify TypeScript**

Run: `npm run typecheck`

Expected: exit 0.

### Task 4: Full verification and OTA distribution

**Files:**
- No expected source changes.

- [ ] **Step 1: Run the full suite**

Run: `npm test -- --run`

Expected: every test passes.

- [ ] **Step 2: Run platform export verification**

Run Android and iOS `npx expo export` commands with clean temporary output directories.

Expected: both exports succeed for SDK 57/runtime `1.2.0`.

- [ ] **Step 3: Verify live data**

Run the production Supabase Shop query and confirm it returns 207 imaged Dhruva medicines.

- [ ] **Step 4: Publish OTA updates**

Publish Android to `preview`, Android to `production`, and iOS to `production` using environment `production`, runtime `1.2.0`, and message `Add smart medicine search and Dhruva branding`.

- [ ] **Step 5: Verify EAS records and manifests**

Use `eas update:view` for all update groups and request the production/preview manifests to confirm the returned update IDs.
