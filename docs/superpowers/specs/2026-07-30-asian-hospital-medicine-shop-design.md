# Asian Hospitals Medicine Shop Design

**Date:** 2026-07-30  
**Status:** Approved for implementation planning  
**Application:** DrJiva Expo SDK 57 patient app

## Goal

Turn the Shop into a clear, image-first ordering experience backed by the
Asian Multi Speciality Hospitals medicine catalogue. Every Asian Hospitals
medicine with a real image must be discoverable, including medicines whose
price has not yet been entered. Reminder medicines must be the first shopping
shortcut below the delivery banner, and every product must open a useful,
plain-language detail screen.

## Confirmed Catalogue Scope

The production catalogue currently contains:

- 1,127 medicine records in total.
- 810 medicine records with an image.
- 383 image-backed records belonging to `ASIAN MULTI SPECIALITY HOSPITALS`.
- 0 of those 383 Asian Hospitals records with a positive stored price.

The Shop must therefore use this eligibility rule:

1. `hospital_name` matches `ASIAN MULTI SPECIALITY HOSPITALS`.
2. `image_url` is present and non-empty.
3. Price is not an eligibility requirement.

Rows without a valid positive price remain orderable and display
`Price confirmed before delivery`. The application must never invent a price
or include an unknown price in a monetary total.

## User Experience

### Shop order

The default Shop screen is ordered as follows:

1. Delivery address header and bag action.
2. Search field.
3. Delivery banner with the complete delivery-agent image.
4. `Your reminder medicines`, when at least one reminder exactly matches an
   eligible Asian Hospitals catalogue item.
5. Curated medicine sections and their eligible products.
6. Checkout control when the bag contains one or more products.

While a non-empty search query is active, the screen keeps the header, search,
and checkout control, and displays only matching medicine results. The banner,
reminder shortcut, and unrelated curated sections are hidden.

### Medicine list presentation

Medicine products use plain list rows rather than cards:

- No outer card background, border, radius, or shadow.
- No image frame, colored image background, image border, image shadow, or
  image corner radius.
- The image uses `contain` so the full package is visible.
- A light separator may divide rows without enclosing them.
- The product name, form, short description, price status, and order control
  sit beside or below the image according to available width.
- Short descriptions are limited to a compact number of lines.
- `View more` opens the medicine detail route; tapping the product body opens
  the same route.
- Quantity controls remain directly accessible and have at least a 44-point
  touch target.

### Reminder medicines

`Your reminder medicines` appears immediately after the banner. It includes
only exact, normalized, unique matches between the patient's active reminders
and eligible Asian Hospitals products. An ambiguous or missing match is
omitted rather than replaced with a different medicine.

Reminder entries use the same real catalogue image and price status as the
main product. Selecting an entry opens its details; its order control updates
the shared bag.

### Medicine detail route

The route is `app/medicine/[id].tsx` and uses the native Expo Router stack.
It contains:

- Native back navigation and title.
- Large, fully contained product image without a decorative image card.
- Medicine name and dosage form.
- Stored price or `Price confirmed before delivery`.
- Short plain-language summary.
- `Common use` information only when it has been reviewed and stored.
- Composition/active ingredients.
- Medicine category and pack/form information.
- Conservative safety guidance.
- A clear educational-information notice.
- Quantity stepper and add-to-bag action.

The detail route loads by stable medicine UUID, not by product name. A missing,
ineligible, or deleted product produces a retryable not-found/error state and
does not show stale details from another product.

## Medical Information Policy

Content is educational catalogue information, not diagnosis, prescribing, or
dosing advice.

Every image-backed Asian Hospitals item receives a useful description:

- When active ingredients and their common use can be verified from an
  authoritative source, the database stores an original, plain-language
  summary and the source provenance.
- When a brand or composition cannot be identified safely, the product still
  explains its stored composition, dosage form, and category, and tells the
  user to follow the prescription or ask a pharmacist. It must not infer an
  indication from the brand name alone.
- No screen recommends a dose, frequency, course duration, or substitution.
- Children's products, combination products, anti-infectives, and
  prescription medicines receive conservative wording.
- Safety copy tells users to read the pack, follow their clinician or
  pharmacist, and seek professional help for allergies, pregnancy,
  breastfeeding, use in children, interactions, or concerning symptoms.

Authoritative sources may include official medicine labels, DailyMed,
MedlinePlus, NHS, WHO, NIH, FDA, or an equivalent government health source.
Source text is paraphrased rather than copied.

## Database Design

The existing `public.medicines` catalogue remains the source of truth. The
following nullable columns are added:

- `shop_short_description text`
- `shop_full_description text`
- `shop_common_uses text`
- `shop_safety_note text`
- `shop_information_source_name text`
- `shop_information_source_url text`
- `shop_information_reviewed_at timestamptz`

The existing medicine UUID is the product identifier. No public write access
is added. Existing catalogue read and staff/collector mutation policies remain
in force.

Migration behaviour:

- Add columns idempotently.
- Seed reviewed descriptions for medicines that can be identified safely.
- Populate a conservative composition/form/category-based fallback for every
  Asian Hospitals row with an image whose reviewed description is absent.
- Never overwrite a non-empty reviewed description with fallback copy.
- Store a source only for genuinely sourced medical claims.
- Add a partial index supporting the Asian Hospitals image-backed catalogue
  lookup if query analysis shows it is not already covered.

The migration explicitly preserves RLS and grants. The mobile client receives
read-only access through its existing authenticated session and cannot modify
shop information.

## Application Data Model

`ShopProduct` supports:

- `price: number | null`
- `shortDescription: string`
- `fullDescription: string`
- `commonUses: string | null`
- `safetyNote: string`
- `informationSourceName: string | null`
- `informationSourceUrl: string | null`
- Existing identity, image, composition, category, form, hospital, and
  section-rank fields.

Database mapping rejects rows without a name, UUID, or image, but it does not
reject a missing price. Invalid non-positive prices map to `null`.

The catalogue fetch:

- Filters to Asian Multi Speciality Hospitals and non-empty images.
- Pages deterministically by name and UUID.
- Selects the new shop-information columns.
- Supports cancellation.
- Uses the existing short-lived in-memory catalogue cache.
- Provides a product-by-ID fetch for detail deep links.
- Treats a missing database description as a safe local fallback rather than
  a blank screen.

## Cart and Checkout

The shared bag accepts both priced and price-pending products.

- Known-price lines contribute to the known subtotal.
- Price-pending lines do not contribute `0` as though that were their price.
- When any line is pending, totals are labelled `Known subtotal`.
- Checkout clearly states that the pharmacy confirms pending prices before
  delivery.
- Quantity controls and removal work identically for both price states.
- A final order summary never presents a pending-price order as fully paid or
  fully priced.

## Performance

- Continue using a virtualized `SectionList`/`FlatList` rather than eagerly
  mounting all 383 products.
- Keep stable UUID keys and a stable row renderer.
- Prefetch only the first visible group of images.
- Use `expo-image` disk/memory caching, `recyclingKey`, and `contentFit="contain"`.
- Do not preload all 383 full-resolution images.
- Search filtering is deferred or debounced sufficiently to keep typing
  responsive.
- Product-by-ID navigation reuses cached product data when available and
  revalidates from Supabase when necessary.

## Error and Empty States

- Initial catalogue loading uses a neutral progress state, not a false empty
  state.
- A failed catalogue load offers Retry.
- A search with no match says `No matching medicines`.
- No eligible reminder match hides the reminder section.
- A failed detail request offers Retry and Back.
- A missing description uses safe fallback copy.
- A missing price uses the pending-price label.
- A failed image load keeps the product text and order action usable and shows
  a neutral medicine placeholder.

## Accessibility and Copy

- Product rows and buttons expose descriptive accessibility labels and roles.
- Quantity controls describe increase, decrease, and removal behaviour.
- Important medicine and error text is selectable.
- Touch targets are at least 44 points.
- Text avoids unexplained clinical jargon where plain language is possible.
- Composition remains visible verbatim because it is product data.
- The detail screen identifies its information as general and asks the user
  to verify suitability with a clinician or pharmacist.

## Testing and Verification

Automated tests cover:

- Mapping image-backed Asian Hospitals rows with `null` prices.
- Excluding other hospitals and rows without images.
- Description fallback generation without unsupported medical claims.
- Exact reminder-product matching.
- Search result isolation.
- Known subtotal and pending-price cart summaries.
- Product-by-ID success, missing-product, cancellation, and error behaviour.
- Detail-copy formatting and source visibility rules.

Project verification includes:

- TypeScript type check.
- Full Vitest suite.
- Expo Doctor.
- Migration SQL review and, when a linked database is available, a read-back
  query verifying the columns and catalogue count.
- Release iOS build with an embedded JavaScript bundle.
- Installation and launch on the connected iPhone.
- Manual checks for banner order, reminder placement, search-only results,
  full unframed images, View more navigation, detail content, price-pending
  cart behaviour, and checkout messaging.

## Out of Scope

- Inventing or scraping medicine prices.
- Giving dosage, diagnosis, or substitution advice.
- Processing payment.
- Replacing the existing order fulfilment backend.
- Showing medicines without a real catalogue image.
- Showing catalogue records from hospitals other than Asian Multi Speciality
  Hospitals in this Shop experience.
