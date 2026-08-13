# Fuzzy Medicine Search and Dhruva Branding Design

## Goal

Make every imaged Asian and Dhruva medicine discoverable in DrJiva even when a patient misspells its name, and use the supplied Dhruva Hospitals logo in the relevant Shop, reminder, and Today surfaces.

## Confirmed Root Cause

- EAS serves the latest Dhruva update to both Android `preview` and Android `production` runtime `1.2.0` clients.
- The live Shop query returns 590 imaged medicines: 383 Asian and 207 Dhruva.
- Normal Shop browsing appends Dhruva after all curated Asian sections, making it difficult to reach.
- Shop and Add Medicine searches use normalized substring matching. A misspelled query therefore returns no result.
- Shop search currently applies the active browsing hospital filter, so an Asian filter can hide a valid Dhruva match.

## Search Behavior

When the Shop query is non-empty, search all supported hospitals regardless of the selected browsing filter. The filter continues to control only the no-query browsing view.

Use a shared, deterministic on-device ranking engine:

1. Normalize case, punctuation, accents, and whitespace.
2. Prefer exact names, name prefixes, word prefixes, and direct substrings.
3. If there are direct matches, return only those matches in ranked order.
4. If there are no direct matches, rank the full candidate catalogue using adjacent-transposition-aware edit distance and return the nearest matches.
5. Keep existing result limits: 80 in Shop and 40 in Add Medicine.

Shop searches may match medicine name, composition, category, supplier, description, or common use, but name similarity receives the strongest rank. Add Medicine searches the selected hospital's medicine names and uses the same direct-versus-nearest fallback.

The Shop section title is `Search results` for direct matches and `Closest matches` for typo fallback. Add Medicine displays the existing result list, so the patient can select a nearest result and create a reminder without a separate workflow.

## Dhruva Visibility and Branding

- Keep `All | Asian | Dhruva` for browsing.
- Add a visible Dhruva discovery card near the top of the unfiltered Shop so users do not need to scroll through every Asian section.
- The discovery card uses `assets/dhruvalogo.png`, shows the available imaged medicine count, and switches the browse filter to Dhruva.
- Use the Dhruva logo in the Dhruva section header and supplier identity on Dhruva product cards.
- Extend the shared hospital-logo component to choose the Dhruva asset when `hospitalName` is `Dhruva Hospitals`. Existing generic branding remains the fallback for other hospitals.
- Pass the hospital name into existing Today, Reminders, and Add Medicine review logo locations.

The wordmark is rendered with `contentFit="contain"` on white because the supplied PNG has transparency and a wide logo composition.

## Performance and Data Flow

The catalogue is already cached and contains only 590 products, so fuzzy ranking stays local and does not issue a network request per keystroke. Ranking is memoized through the existing React `useMemo` paths. The virtualized `SectionList` and current result limits remain in place.

No database migration or native rebuild is required. The change is compatible with runtime `1.2.0` and can be distributed through EAS Update.

## Verification

- Unit-test adjacent transpositions, missing letters, and direct-match precedence.
- Unit-test Shop search across filters and its `Closest matches` title.
- Unit-test Add Medicine's shared catalogue search fallback.
- Verify all 207 live Dhruva image URLs remain queryable.
- Run all Vitest tests, TypeScript, and Android/iOS Expo exports.
- Publish Android updates to `preview` and `production`, plus iOS to `production`, then verify each EAS update record and manifest.

## Out of Scope

- Autocorrecting the text entered by the patient.
- Server-side trigram indexes or per-keystroke Supabase RPC calls.
- Showing medicines from unsupported hospitals in Shop.
- Guessing a medication when the patient submits a reminder; the patient must still tap a result.
