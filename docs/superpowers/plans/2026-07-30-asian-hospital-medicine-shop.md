# Asian Hospitals Medicine Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every image-backed Asian Multi Speciality Hospitals medicine in a plain, image-first Shop, persist safe medicine descriptions in Supabase, support price-pending orders, and provide a full medicine detail route.

**Architecture:** Keep `public.medicines` as the catalogue source of truth and add nullable shop-information columns through an imperative Supabase migration. Map database rows into a nullable-price `ShopProduct`, use pure helpers for safe fallback copy and pricing, keep the 383-product catalogue virtualized, and load detail routes by medicine UUID. Split product presentation out of the existing large Shop route so list rows, quantity controls, and detail content have focused interfaces.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, `expo-image`, Supabase/PostgREST, PostgreSQL migrations and RLS, TypeScript, Vitest, Xcode Release builds.

## Global Constraints

- Read the exact Expo SDK 57 reference before implementation: `https://docs.expo.dev/versions/v57.0.0/`.
- The Shop catalogue includes only `ASIAN MULTI SPECIALITY HOSPITALS` rows with a non-empty `image_url`.
- A positive price is optional; missing/invalid prices map to `null`.
- Never invent prices, diagnoses, doses, frequencies, durations, substitutions, or medicine indications.
- Verified medical claims require an authoritative source URL and review timestamp.
- Unverified rows use composition/form/category identification copy and pharmacist guidance only.
- No outer medicine card, image frame, image background, image border, image shadow, or image corner radius.
- Use virtualized lists and avoid prefetching all 383 product images.
- Preserve current patient, reminder, address, document, notification, and checkout behaviour outside this feature.
- Enable no new public database write access and preserve RLS.
- Use `apply_patch` for source edits and the Supabase CLI to create the migration filename.

---

### Task 1: Safe catalogue copy and nullable-price domain model

**Files:**
- Create: `src/data/shop-product-copy.ts`
- Create: `src/data/shop-product-copy.test.ts`
- Modify: `src/data/shopProductModel.ts`
- Modify: `src/data/shopProducts.test.ts`

**Interfaces:**
- Produces:
  - `ASIAN_HOSPITAL_NAME = 'ASIAN MULTI SPECIALITY HOSPITALS'`
  - `getShopProductFallbackCopy(input): ShopProductCopy`
  - `ShopProduct.price: number | null`
  - `ShopProduct.shortDescription: string`
  - `ShopProduct.fullDescription: string`
  - `ShopProduct.commonUses: string | null`
  - `ShopProduct.safetyNote: string`
  - `ShopProduct.informationSourceName: string | null`
  - `ShopProduct.informationSourceUrl: string | null`
  - `ShopProduct.informationReviewedAt: string | null`
- Consumes: current `ShopMedicineRow`, medicine search normalization, and existing product identity/image/category/composition/form fields.

- [ ] **Step 1: Write failing copy tests**

Add tests that prove fallback copy is useful without making an unsupported
medical claim:

```ts
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
```

Add a second test for missing composition/category that expects:

```ts
{
  commonUses: null,
  fullDescription:
    'Use this medicine only when it matches your prescription or a pharmacist confirms the product.',
  safetyNote:
    'Read the pack and follow your doctor or pharmacist. Ask before use for a child, during pregnancy or breastfeeding, with allergies, or with other medicines.',
  shortDescription:
    'Medicine details are being reviewed. Check the pack or ask a pharmacist.',
}
```

- [ ] **Step 2: Write failing mapping tests**

Replace the current “reject missing price” expectation with tests proving:

```ts
expect(products[0]).toEqual(
  expect.objectContaining({
    hospitalName: ASIAN_HOSPITAL_NAME,
    price: null,
    shortDescription: expect.stringContaining('Check that it matches'),
  }),
);
```

Also prove that rows from another hospital and rows without an image are
excluded even when they have a price.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
npx vitest run src/data/shop-product-copy.test.ts src/data/shopProducts.test.ts
```

Expected: failures because the helper and description fields do not exist and
the mapper still rejects `null` prices.

- [ ] **Step 4: Implement the minimal copy helper and model**

Add this input/output boundary:

```ts
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
```

Normalize whitespace only; preserve stored ingredient spelling. Build fallback
sentences from non-empty fields, and never infer an indication from the brand
name.

Extend `ShopMedicineRow` with:

```ts
shop_short_description: string | null;
shop_full_description: string | null;
shop_common_uses: string | null;
shop_safety_note: string | null;
shop_information_source_name: string | null;
shop_information_source_url: string | null;
shop_information_reviewed_at: string | null;
```

Change the price parser to return `number | null`; only reject rows lacking a
name, UUID, image, or exact Asian Hospitals ownership. Prefer non-empty
database copy and fill missing fields from `getShopProductFallbackCopy`.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:

```bash
npx vitest run src/data/shop-product-copy.test.ts src/data/shopProducts.test.ts
```

Expected: both test files pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/data/shop-product-copy.ts src/data/shop-product-copy.test.ts src/data/shopProductModel.ts src/data/shopProducts.test.ts
git commit -m "feat: model Asian Hospitals shop medicines"
```

---

### Task 2: Supabase shop-information migration and catalogue queries

**Files:**
- Create via CLI: the path printed by `npx supabase migration new add_asian_shop_medicine_details`
- Modify: `src/data/shopProducts.ts`
- Modify: `src/data/shopProducts.test.ts`
- Create: `docs/medicine-information/asian-hospitals-shop-sources.md`

**Interfaces:**
- Consumes: `ASIAN_HOSPITAL_NAME`, the extended `ShopMedicineRow`, and `mapMedicineRowsToShopProducts`.
- Produces:
  - `fetchShopProducts(query?, signal?): Promise<ShopProduct[]>`
  - `fetchShopProductById(id, signal?): Promise<ShopProduct | null>`
  - Read-only persisted shop-description columns on `public.medicines`.

- [ ] **Step 1: Verify Supabase workflow and create the migration using the CLI**

Run:

```bash
npx supabase --version
npx supabase migration new --help
npx supabase migration new add_asian_shop_medicine_details
```

Record the exact generated migration path and use only that file. Do not
manually invent a timestamped filename.

- [ ] **Step 2: Inventory ingredient patterns and authoritative sources**

Run a read-only authenticated Supabase query that returns distinct
`composition`, `category`, and `dosage_form` values for the 383 eligible Asian
Hospitals rows. For ingredients receiving a `common use` claim, verify current
primary/authoritative documentation and record:

```md
| Ingredient pattern | Plain-language claim | Source name | Source URL | Checked |
```

The source document must include exact URLs and dates. At minimum, review the
ingredient groups used in the default curated sections: paracetamol,
ibuprofen, cetirizine, aceclofenac combinations, chlorpheniramine,
phenylephrine combinations, chlorzoxazone, serratiopeptidase, and
trypsin/chymotrypsin. If an authoritative source does not support a safe claim,
leave `shop_common_uses` null and use catalogue fallback copy.

- [ ] **Step 3: Write the migration**

Add the columns:

```sql
alter table public.medicines
  add column if not exists shop_short_description text,
  add column if not exists shop_full_description text,
  add column if not exists shop_common_uses text,
  add column if not exists shop_safety_note text,
  add column if not exists shop_information_source_name text,
  add column if not exists shop_information_source_url text,
  add column if not exists shop_information_reviewed_at timestamptz;
```

Add a partial lookup index:

```sql
create index if not exists medicines_asian_shop_catalogue_idx
on public.medicines (hospital_name, name, id)
where nullif(btrim(image_url), '') is not null;
```

Seed only source-backed ingredient rules with all provenance fields. Then fill
all remaining eligible rows without overwriting reviewed copy:

```sql
update public.medicines
set
  shop_short_description = case
    when nullif(btrim(composition), '') is not null then
      concat(
        initcap(lower(coalesce(nullif(btrim(dosage_form), ''), 'medicine'))),
        ' containing ',
        btrim(composition),
        '. Check that it matches your prescription.'
      )
    else
      'Medicine details are being reviewed. Check the pack or ask a pharmacist.'
  end,
  shop_full_description = case
    when nullif(btrim(composition), '') is not null then
      concat(
        'This ',
        lower(coalesce(nullif(btrim(dosage_form), ''), 'medicine')),
        ' contains ',
        btrim(composition),
        case
          when nullif(btrim(category), '') is not null
            then concat(' and is listed in the ', lower(btrim(category)), ' category')
          else ''
        end,
        '. Use it only when it matches your prescription or a pharmacist confirms it.'
      )
    else
      'Use this medicine only when it matches your prescription or a pharmacist confirms the product.'
  end,
  shop_safety_note =
    'Read the pack and follow your doctor or pharmacist. Ask before use for a child, during pregnancy or breastfeeding, with allergies, or with other medicines.'
where upper(btrim(hospital_name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
  and nullif(btrim(image_url), '') is not null
  and nullif(btrim(shop_short_description), '') is null;
```

Do not grant INSERT, UPDATE, or DELETE to the mobile roles. Do not weaken the
existing `medicines` RLS policies.

- [ ] **Step 4: Write failing query/mapping tests**

Add a database-row fixture containing all seven shop-information columns and
assert that reviewed copy and provenance survive mapping. Add a fixture with
all seven columns null and assert that fallback copy is used.

- [ ] **Step 5: Run the focused test and confirm RED**

Run:

```bash
npx vitest run src/data/shopProducts.test.ts
```

Expected: failure until the selected columns and mapping are complete.

- [ ] **Step 6: Update catalogue and detail queries**

Use one shared select string containing identity, image, nullable price,
composition/form/category, the seven shop-information fields, and section
items.

For the main catalogue:

```ts
.eq('hospital_name', ASIAN_HOSPITAL_NAME)
.not('image_url', 'is', null)
.neq('image_url', '')
.order('name')
.order('id')
```

Remove `.gt('price', 0)`. Retain paging, abort signals, deterministic ordering,
and the five-minute non-search cache.

For `fetchShopProductById`, return a cached matching product first; otherwise
query by UUID plus the same hospital/image eligibility and map the single row.
Return `null` for no eligible row and rethrow non-abort database errors.

- [ ] **Step 7: Run focused tests and verify the migration**

Run:

```bash
npx vitest run src/data/shopProducts.test.ts
npx supabase migration list --local
git diff --check
```

Then discover the supported database commands:

```bash
npx supabase db push --help
npx supabase db --help
```

Use the CLI-supported dry-run option before applying the migration. When the
project is linked, apply it and run a read-back query asserting:

- Seven shop-information columns exist.
- Exactly 383 Asian Hospitals image rows are returned before catalogue changes
  made by another operator.
- Every eligible row has a non-empty `shop_short_description`,
  `shop_full_description`, and `shop_safety_note`.
- Mobile sessions can select but cannot update these fields.

- [ ] **Step 8: Commit Task 2**

```bash
git add supabase/migrations docs/medicine-information/asian-hospitals-shop-sources.md src/data/shopProducts.ts src/data/shopProducts.test.ts
git commit -m "feat: persist Asian Hospitals shop details"
```

---

### Task 3: Complete catalogue sections and exact reminder matching

**Files:**
- Modify: `src/data/shopProductModel.ts`
- Modify: `src/data/shopSections.ts`
- Modify: `src/data/shopSections.test.ts`

**Interfaces:**
- Produces `ShopSectionKey = ShopSectionCode | 'all' | 'search'`.
- `buildShopSections` returns curated sections followed by one `All medicines`
  section containing eligible products not already shown in a curated section.
- Reminder matching remains exact, normalized, unique, and unambiguous.

- [ ] **Step 1: Write failing section tests**

Add a product that has no curated rank and assert:

```ts
expect(sections.at(-1)).toEqual(
  expect.objectContaining({
    code: 'all',
    title: 'All medicines',
    data: [uncuratedProduct],
  }),
);
```

Add products present in one or more curated sections and assert they do not
repeat in `All medicines`. Add a search assertion proving all products,
including uncurated products with `price: null`, can match by name,
composition, or description.

- [ ] **Step 2: Run the focused tests and confirm RED**

```bash
npx vitest run src/data/shopSections.test.ts
```

- [ ] **Step 3: Implement the complete section builder**

Track UUIDs used by curated sections, append remaining products sorted by name,
and include `shortDescription` and `commonUses` in the search text. Search
continues to return only one `Search results` section and no unrelated content.

- [ ] **Step 4: Run focused tests and confirm GREEN**

```bash
npx vitest run src/data/shopSections.test.ts
```

- [ ] **Step 5: Commit Task 3**

```bash
git add src/data/shopProductModel.ts src/data/shopSections.ts src/data/shopSections.test.ts
git commit -m "feat: expose the complete Asian medicine catalogue"
```

---

### Task 4: Price-pending cart calculations

**Files:**
- Create: `src/lib/shop-pricing.ts`
- Create: `src/lib/shop-pricing.test.ts`
- Modify: `src/lib/currency.ts`
- Modify: `src/lib/currency.test.ts`

**Interfaces:**
- Produces:

```ts
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
): ShopPricingSummary;

export function formatShopProductPrice(price: number | null): string;
```

- [ ] **Step 1: Write failing pricing tests**

Cover all-priced, all-pending, and mixed baskets:

```ts
expect(
  summarizeShopPricing([
    { price: 32, quantity: 2 },
    { price: null, quantity: 3 },
  ]),
).toEqual({
  hasPendingPrices: true,
  knownSubtotal: 64,
  pendingItemCount: 3,
  pendingLineCount: 1,
});

expect(formatShopProductPrice(null)).toBe(
  'Price confirmed before delivery',
);
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
npx vitest run src/lib/shop-pricing.test.ts src/lib/currency.test.ts
```

- [ ] **Step 3: Implement pure pricing helpers**

Only finite positive prices contribute to `knownSubtotal`. Pending items must
never be multiplied as `0` and represented as a completed total.

- [ ] **Step 4: Run focused tests and confirm GREEN**

```bash
npx vitest run src/lib/shop-pricing.test.ts src/lib/currency.test.ts
```

- [ ] **Step 5: Commit Task 4**

```bash
git add src/lib/shop-pricing.ts src/lib/shop-pricing.test.ts src/lib/currency.ts src/lib/currency.test.ts
git commit -m "feat: support pending medicine prices"
```

---

### Task 5: Plain product rows and reminder placement

**Files:**
- Create: `src/components/shop/product-quantity-control.tsx`
- Create: `src/components/shop/shop-product-row.tsx`
- Create: `src/components/shop/reminder-medicine-list.tsx`
- Modify: `app/shop.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- `ProductQuantityControl` consumes product name, quantity, and add/increment/decrement callbacks.
- `ShopProductRow` consumes product, quantity callbacks, and `onOpen`.
- `ReminderMedicineList` consumes exact matched `ReminderMedicineReorder[]` and the same ordering/open callbacks.

- [ ] **Step 1: Add user-facing copy**

Add English and Telugu keys for:

- `allMedicines`
- `yourReminderMedicines`
- `viewMore`
- `priceConfirmedBeforeDelivery`
- `knownSubtotal`
- `pendingPriceNotice`
- `medicineDetails`
- `commonUse`
- `composition`
- `generalMedicineInformation`

Keep stored medicine descriptions in their reviewed database language; do not
machine-translate medical claims in the client.

- [ ] **Step 2: Implement the shared quantity control**

Use 44-point add/increment/decrement targets, tabular number text, accessible
labels containing the product name, and existing cart callbacks. Preserve the
trash behaviour at quantity one.

- [ ] **Step 3: Implement the plain product row**

Use:

```tsx
<Image
  accessibilityLabel={product.name}
  cachePolicy="memory-disk"
  contentFit="contain"
  recyclingKey={product.id}
  source={{ uri: product.imageUrl }}
  style={styles.image}
  transition={120}
/>
```

The image style has width/height only: no background, border, radius, shadow,
or clipping wrapper. The row has no card background/border/radius/shadow.
Use a bottom hairline separator. Render name, form, two-line short description,
`View more`, formatted price status, and the quantity control. Product body and
`View more` open the UUID route.

- [ ] **Step 4: Implement reminder medicines immediately below the banner**

Remove the enclosing reminder card treatment. Render a section heading and
plain reminder product rows immediately after the delivery banner. Omit the
section when there are no exact eligible matches.

- [ ] **Step 5: Integrate the virtualized Shop**

Update `app/shop.tsx` to:

- Keep header/search/checkout outside the `SectionList`.
- Render banner and reminders in `ListHeaderComponent` only when not searching.
- Render only the search section when searching.
- Add `all` section icon/title support.
- Navigate with:

```ts
router.push({
  pathname: '/medicine/[id]',
  params: { id: product.id, phone },
});
```

- Use `summarizeShopPricing` for the floating checkout bar.
- Prefetch only the first ten image URLs.
- Remove embedded product/reminder components and obsolete card/image-frame
  styles from `app/shop.tsx`.

- [ ] **Step 6: Verify Task 5**

Run:

```bash
npm run typecheck
npx vitest run src/data/shopSections.test.ts src/lib/shop-pricing.test.ts
git diff --check
```

Manually inspect the simulator/device for banner → reminder → catalogue order,
unframed images, readable copy, 44-point controls, search-only results, and
smooth scrolling through the `All medicines` section.

- [ ] **Step 7: Commit Task 5**

```bash
git add app/shop.tsx src/components/shop src/lib/i18n.tsx
git commit -m "feat: redesign the medicine shop catalogue"
```

---

### Task 6: Medicine detail route

**Files:**
- Create: `app/medicine/[id].tsx`
- Create: `src/components/shop/medicine-detail-content.tsx`
- Modify: `app/_layout.tsx`
- Modify: `src/data/shopProducts.ts`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes `fetchShopProductById`, `ShopProduct`, `useCart`, and route params
  `{ id: string; phone?: string }`.
- Produces a native stack detail screen with retry/not-found/error states.

- [ ] **Step 1: Add a failing product-selection test**

Add a pure exported helper:

```ts
export function findCachedShopProduct(
  products: readonly ShopProduct[],
  id: string,
): ShopProduct | null;
```

Test exact UUID selection and a missing UUID returning `null`; a different
product must never be returned.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npx vitest run src/data/shopProducts.test.ts
```

- [ ] **Step 3: Implement cache-first product lookup**

Use `findCachedShopProduct` in `fetchShopProductById`; revalidate from Supabase
when absent. Abort on route cleanup and ignore stale request completion.

- [ ] **Step 4: Implement focused detail content**

`MedicineDetailContent` receives a resolved product and callbacks. It renders:

- Full contained image with no decorative frame or rounded corners.
- Name, form, nullable-price label, short and full descriptions.
- `Common use` only when non-null.
- Composition, category, safety note, and general-information notice.
- Source name/link only when both source name and URL are non-empty.
- Quantity control and add-to-bag action.

Do not render dosage instructions.

- [ ] **Step 5: Implement the route and native header**

Use `Stack.Screen` with `headerShown: true`, title `Medicine details`,
`headerBackButtonDisplayMode: 'minimal'`, and no header shadow. The first route
content is a `ScrollView` with
`contentInsetAdjustmentBehavior="automatic"`. Handle:

- Loading spinner.
- Retryable request error.
- Product not found with Back action.
- Loaded content.

Account for the bottom safe area around the add-to-bag action.

- [ ] **Step 6: Register and verify navigation**

Add the dynamic screen to `app/_layout.tsx` only if explicit options cannot be
fully declared in the route. Verify cold deep-link loading and cached Shop
navigation.

Run:

```bash
npm run typecheck
npx vitest run src/data/shopProducts.test.ts
git diff --check
```

- [ ] **Step 7: Commit Task 6**

```bash
git add app/medicine app/_layout.tsx src/components/shop/medicine-detail-content.tsx src/data/shopProducts.ts src/data/shopProducts.test.ts src/lib/i18n.tsx
git commit -m "feat: add medicine product details"
```

---

### Task 7: Price-pending cart and checkout UI

**Files:**
- Modify: `app/cart.tsx`
- Modify: `app/checkout.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes `summarizeShopPricing` and `formatShopProductPrice`.
- Produces truthful known-subtotal/pending-price messaging throughout the bag
  and checkout.

- [ ] **Step 1: Replace direct nullable-price arithmetic**

Build line summaries with:

```ts
const pricing = summarizeShopPricing(
  lines.map(({ product, quantity }) => ({
    price: product.price,
    quantity,
  })),
);
```

Remove every direct `product.price * quantity` expression that can receive
`null`.

- [ ] **Step 2: Update cart line and footer copy**

Each pending product displays `Price confirmed before delivery`. If
`pricing.hasPendingPrices`:

- Label the numeric value `Known subtotal`.
- Hide the numeric value entirely when `knownSubtotal === 0`.
- Display the pending item count and the pharmacy-confirmation notice.

Known-price-only carts keep the current total behaviour.

- [ ] **Step 3: Update checkout summary and order alert**

Use the same line and subtotal rules. The checkout disclaimer must say the
pharmacy confirms pending prices before delivery. The current “ordering is
coming soon” alert remains, but must not claim a final total when prices are
pending.

- [ ] **Step 4: Verify Task 7**

Run:

```bash
npm run typecheck
npx vitest run src/lib/shop-pricing.test.ts src/lib/currency.test.ts
git diff --check
```

Manually test one known-price item, one pending-price item, and a mixed bag.

- [ ] **Step 5: Commit Task 7**

```bash
git add app/cart.tsx app/checkout.tsx src/lib/i18n.tsx
git commit -m "feat: show pending prices in checkout"
```

---

### Task 8: Full verification, review, Release build, and iPhone installation

**Files:**
- Modify only files required by verified failures.

**Interfaces:**
- Consumes the integrated feature.
- Produces a reviewed, signed, standalone iOS Release installed on the paired
  iPhone.

- [ ] **Step 1: Run automated project verification**

Run in parallel where safe:

```bash
npm run typecheck
npm test -- --run
npx expo-doctor
git diff --check
```

Expected: TypeScript succeeds, every Vitest test passes, Expo Doctor reports
all checks passed, and Git reports no whitespace errors.

- [ ] **Step 2: Run database verification**

Use the linked Supabase project to read back the 383 eligible records and
assert the description fields are populated. Run the available database
advisors discovered through:

```bash
npx supabase db --help
```

Fix migration/RLS/index findings before proceeding. Verify an authenticated
patient session can read but cannot update shop-information columns.

- [ ] **Step 3: Request two-stage code review**

Use `superpowers:requesting-code-review` for:

1. Specification compliance: all approved requirements and safety constraints.
2. Code quality: stale requests, nullable-price arithmetic, list performance,
   RLS/grants, accessibility, and navigation correctness.

Resolve each accepted finding with `superpowers:receiving-code-review`, rerun
the affected focused test, and then rerun the full suite.

- [ ] **Step 4: Build the standalone Release**

Run:

```bash
xcodebuild -workspace ios/DrJiva.xcworkspace -scheme DrJiva -configuration Release -destination 'generic/platform=iOS' build
```

Verify:

```bash
codesign --verify --deep --strict --verbose=2 /Users/vardhanreddy/Library/Developer/Xcode/DerivedData/DrJiva-cioemgjhmhuobfaxixyvvarbqctg/Build/Products/Release-iphoneos/DrJiva.app
stat /Users/vardhanreddy/Library/Developer/Xcode/DerivedData/DrJiva-cioemgjhmhuobfaxixyvvarbqctg/Build/Products/Release-iphoneos/DrJiva.app/main.jsbundle
```

The embedded bundle must exist so the app never searches for a development
server.

- [ ] **Step 5: Install and launch on the connected iPhone**

First resolve the current opaque device identifier:

```bash
xcrun devicectl list devices
```

Then install and launch using the exact connected identifier:

```bash
xcrun devicectl device install app --device 1CC30A7C-CEE1-58F6-B061-3FA5756D98F0 /Users/vardhanreddy/Library/Developer/Xcode/DerivedData/DrJiva-cioemgjhmhuobfaxixyvvarbqctg/Build/Products/Release-iphoneos/DrJiva.app
xcrun devicectl device process launch --device 1CC30A7C-CEE1-58F6-B061-3FA5756D98F0 --terminate-existing com.drjiva.patient
xcrun devicectl device info processes --device 1CC30A7C-CEE1-58F6-B061-3FA5756D98F0
```

Confirm the DrJiva process remains present after launch.

- [ ] **Step 6: Manual production acceptance**

On the installed iPhone verify:

1. Shop opens without a false empty state.
2. Delivery banner shows the complete agent.
3. Exact reminder medicines appear immediately below it.
4. All 383 Asian Hospitals image products are discoverable.
5. Search shows only matching medicines.
6. Product/image rows have no card or rounded image treatment.
7. Every row has readable short copy and View more.
8. Detail routes show correct UUID-owned content, safety copy, and no dosing.
9. Pending prices remain orderable and never display as ₹0.
10. Cart and checkout show truthful known subtotal/pending-price messaging.
11. Images load smoothly and full packages remain visible.

- [ ] **Step 7: Final commit**

```bash
git add app src supabase docs package.json package-lock.json
git commit -m "feat: ship Asian Hospitals medicine shop"
```

If no Git remote is configured, report the final commit and request the exact
remote URL rather than guessing or creating a repository.
