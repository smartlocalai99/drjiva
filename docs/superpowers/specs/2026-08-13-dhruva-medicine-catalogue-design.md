# Dhruva Medicine Catalogue Design

## Goal

Make Dhruva Hospitals medicines available throughout the patient app anywhere a hospital medicine catalogue is expected: Shop browsing, Shop search, Add Medicine search, reminder creation, and the Today medicine card.

## Current State

- Shop intentionally accepts only medicines supplied by `ASIAN MULTI SPECIALITY HOSPITALS`.
- Dhruva Hospitals is already a verified hospital with ID `0428eaad-d659-4052-bb63-12c9e76d1f98`.
- The live database currently contains 295 Dhruva medicine rows. At verification time, 205 rows have a non-empty `image_url`; the product owner expects 207 uploaded images.
- Add Medicine already loads catalogue rows by the selected hospital ID, displays medicine images, and saves the selected catalogue medicine ID to the reminder course.
- Today already resolves the selected medicine's live `image_url` through the reminder course.

## Approved Experience

### Shop hospital filter

Add a compact horizontal segmented filter immediately below the Shop search field:

- **All** — default. Preserve the existing Asian Hospitals curated category sections and append a `Dhruva Hospitals` section containing Dhruva medicines with usable images.
- **Asian** — show only the existing Asian Hospitals curated sections.
- **Dhruva** — show one alphabetical `Dhruva Hospitals` section containing Dhruva medicines with usable images.

Changing the hospital filter must update the visible products without clearing the search text. Every product card and medicine detail continues to use the existing cart and checkout flow. Product cards should display the supplying hospital so similarly named medicines are distinguishable.

### Shop search

Load eligible medicines for both supported hospitals into the Shop catalogue. Search across name, composition, category, hospital name, description, and common use, then apply the active hospital filter. Search results remain limited to 80 products for responsive rendering.

Only rows with a non-empty `image_url` appear in Shop. Prices continue to use the current fallback behavior when the catalogue price is absent or non-positive.

### Add Medicine and reminders

Dhruva Hospitals remains a normal verified hospital option. Selecting it loads only medicines whose `hospital_id` is the Dhruva hospital ID. Medicine results display the linked Supabase image and can be selected using the existing multi-medicine reminder workflow.

Saving a Dhruva medicine creates the same verified catalogue-backed course used for Asian medicines. No duplicate or custom medicine row is created.

### Today

No separate Today catalogue is introduced. Today continues reading the medicine relation stored on the reminder course, so a saved Dhruva medicine displays its current `image_url` automatically. Missing images continue to use the existing placeholder.

## Data Model and Catalogue Rules

Define the two supported Shop hospital names centrally:

- `ASIAN MULTI SPECIALITY HOSPITALS`
- `Dhruva Hospitals`

The Shop query requests imaged rows for both names and pages until exhausted. Client mapping normalizes hospital names case-insensitively but preserves the canonical display name.

Product identity remains the medicine row ID. Deduplication uses hospital plus normalized medicine name so an Asian and a Dhruva product with the same name can both appear. The cross-catalogue `hasUniqueCatalogueName` flag remains false when a normalized name is ambiguous, preventing the reminder reorder feature from silently choosing the wrong hospital product.

The implementation must not hard-code a count of 207. It should display every Dhruva row with a valid `image_url`, including future uploads. The two expected but currently unlinked images require their medicine rows' `image_url` values to be populated before they can appear; the UI must not invent mappings.

## Components and Boundaries

- `shopProductModel` owns supported-hospital eligibility, canonical hospital names, row mapping, and safe deduplication.
- `shopProducts` owns paginated Supabase catalogue fetching and caching.
- `shopSections` owns hospital filtering and the difference between curated Asian sections, the combined All view, and the alphabetical Dhruva section.
- `ShopScreen` owns the selected hospital filter and renders the segmented control.
- `ShopProductCard` displays the supplier name while preserving add/open behavior.
- The existing Add Medicine and Today paths remain the source of truth for reminder selection and display; targeted regression tests prove Dhruva image propagation rather than creating a parallel implementation.

## Loading, Empty, and Error States

- Existing Shop loading and retry states remain unchanged.
- A filter with no eligible products uses the existing empty state with hospital-aware copy.
- A search with no match reports no matching medicines under the active hospital filter.
- Image load failures use existing image behavior; rows without an image URL never enter Shop.
- Add Medicine continues showing `No medicines found` when the selected hospital has no imaged catalogue matches.

## Verification

- Unit-test mapping for Asian, Dhruva, duplicate names across hospitals, and exclusion of unsupported/missing-image rows.
- Unit-test Shop sections for All, Asian, Dhruva, and filtered search.
- Unit-test that verified medicine catalogue items preserve Dhruva hospital ID and image URL.
- Run focused Vitest files, the full test suite, and TypeScript type checking.
- Query the live catalogue after implementation and report the actual Dhruva total and linked-image count separately from the UI work.

## Out of Scope

- Uploading or guessing missing medicine images.
- Creating Dhruva-specific checkout, pricing, delivery, or order tables.
- Changing reminder notification scheduling.
- Replacing the generic hospital logo with Dhruva branding.
