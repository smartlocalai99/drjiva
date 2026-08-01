# Direct Sync of Patient-Entered Hospitals

## Goal

When a patient enters a new hospital while creating a medicine reminder, that hospital must immediately become an official shared hospital and appear in the Medislash tablet app. Matching names must reuse the existing hospital instead of creating duplicates.

## Root Cause

The patient app currently saves user-entered hospitals in `public.patient_custom_hospitals`. The Medislash tablet app reads only `public.hospitals`. Both apps use the same Supabase project, but no database operation copies or links the patient-entered name into the shared hospital directory.

## Approved Behavior

- Every successfully saved `patient_custom_hospitals` row creates or reuses a matching row in `public.hospitals`.
- Matching ignores capitalization, punctuation separators, leading/trailing whitespace, and repeated whitespace.
- Existing official hospital details are never overwritten by a patient-entered name.
- Existing patient-entered hospitals are backfilled into the shared directory when the migration is applied.
- A failure to sync the shared hospital rolls back the patient hospital insert, so the two lists cannot silently diverge.
- The Medislash hospital picker refreshes when the shared hospital table changes, without requiring a page reload.

## Architecture and Data Flow

### Database normalization and uniqueness

Add a database normalization function and a generated normalized-name column on `public.hospitals`. Add a unique index on that generated value. Production currently has seven official hospitals and no normalized-name collisions, so the uniqueness constraint can be applied safely.

### Atomic direct sync

Add a `SECURITY INVOKER` trigger function on `public.patient_custom_hospitals`. After an insert or hospital-name update, it inserts the display name into `public.hospitals` with `ON CONFLICT` behavior that preserves the existing official row. Because the trigger runs in the same transaction, a sync error rejects the originating patient save rather than leaving partial state.

The trigger relies on the existing authenticated insert permission and RLS policy for `public.hospitals`; it does not introduce a service-role key, a privileged client, or a `SECURITY DEFINER` bypass.

### Existing data

The migration inserts the distinct names already stored in `public.patient_custom_hospitals` into `public.hospitals`, using the same normalized uniqueness rule. No patient identifier or other private patient data is copied.

### Live Medislash refresh

Add `public.hospitals` to the Supabase Realtime publication if it is not already present. The Medislash hospital context subscribes to hospital changes, refetches the ordered official list after a change, preserves the currently selected hospital when it still exists, and removes the channel during cleanup.

## Error Handling

- Database errors propagate to the existing patient-app save error handling.
- A duplicate normalized hospital name is treated as success and reuses the official row.
- A Medislash Realtime reconnect or event-refetch failure keeps the last valid list and exposes the existing context error state; a later event or page load retries the normal list fetch.
- The sync never replaces official address, phone, code, logo, or doctor-image fields.

## Testing and Verification

- Add a failing Medislash unit test for subscribing to `public.hospitals` changes, invoking the refresh callback, and cleaning up the channel.
- Run the Medislash test suite, lint, and production build.
- Apply the Supabase migration and verify that existing custom hospital names now have corresponding official hospital rows with no normalized duplicates.
- Insert a temporary authenticated test patient hospital only if a safe disposable test identity is available; otherwise verify the trigger transaction through database inspection and the real patient flow.
- Open the deployed Medislash PWA and confirm a newly added patient hospital appears without a manual reload.

## Release Impact

The patient mobile binary does not need rebuilding because its existing write to `patient_custom_hospitals` activates the database trigger. The Supabase migration must be deployed, and the Medislash PWA must be redeployed for live refresh behavior.

## Out of Scope

- Moderation or approval of patient-entered hospital names.
- Automatic population of hospital address, phone, code, logo, or doctor image.
- Merging historically distinct official hospital records beyond normalized exact-name matching.
