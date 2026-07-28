# Medicine Course Cards Design

## Goal

Show a compact medicine-course preview on the dashboard using medicine names
and images from the Medico Supabase project. The preview is demonstrative: it
must not create fake prescriptions or medicine-course rows in the database.

## Data

- Read up to three rows from `public.medicines`.
- Require a non-empty `image_url`; do not substitute bundled or generated
  medicine artwork.
- Use `name`, `hospital_name`, and `hospital_id` from the row.
- Derive stable demo dosage, schedule, and doctor labels from the medicine id
  so the preview does not change between renders.
- If the query fails or no image-backed medicines exist, retain the existing
  empty state and allow pull-to-refresh.

## Card

- The medicine photograph fills the full card width with no horizontal inset.
- The card is compact, with rounded corners and a fixed image crop using
  `contentFit="cover"`.
- The medicine name overlays or directly follows the image without a large
  whitespace block.
- A three-column detail strip shows tablet quantity on the left, a circular
  hospital-initials badge in the center, and a doctor icon/name on the right.
- The existing completion control remains available and accessible.
- Demo medical details are labelled as sample course information in the
  screen-level helper copy.

## Testing

- Unit-test row mapping, stable demo data, empty image filtering, and hospital
  initials.
- Type-check and run the complete Vitest suite.
- Verify the Android bundle and visually inspect the dashboard in the preview
  build.

