# Document Deletion Design

## Goal

Allow a patient to permanently delete an uploaded medical document from the
Documents screen without exposing or orphaning its private PDF.

## Interaction

- Every document row shows a compact red trash button at its top-right.
- Tapping the document body continues to open the PDF.
- Tapping the trash button does not open the PDF. It opens a destructive
  confirmation dialog containing the localized report type and hospital name.
- Confirming disables that row's actions and shows deletion progress.
- Cancelling changes nothing.
- Success removes the document from the visible hospital folder immediately.
  An empty hospital folder disappears; an empty Documents screen returns to
  the existing empty state.
- Failure keeps the row visible and shows a localized retry message.

## Data Flow

1. Require an authenticated report session.
2. Validate that the selected report has both an id and a storage path.
3. Delete the PDF through the Supabase Storage API. Never delete
   `storage.objects` with SQL.
4. Delete the matching `patient_reports` row by id.
5. Update local screen state only after both operations succeed.

For a legacy database row with no storage path, the confirmation explains that
only its record can be removed, then deletes the owner-scoped row directly.

The existing RLS policies remain the authorization boundary:

- a patient can delete only rows where `owner_user_id = auth.uid()`;
- a patient can delete only objects whose first folder is `auth.uid()`.

The delete helper reports which stage failed. If Storage deletion succeeds but
row deletion fails, the app retries the row deletion once before reporting an
error. A later reload treats an owner row with no object as unavailable; it
never broadens access or uses a secret key in the app.

## Components

- `ReportList` receives an `onDelete` callback and per-report deleting state.
- `DocumentsScreen` owns confirmation, deletion, alerts, and local list
  removal.
- `patientReports` owns the Supabase Storage and database operations.
- Pure deletion-state helpers are isolated for deterministic tests.

## Localization

Add English and Telugu copy for Delete, confirmation title/body, Cancel,
deleting progress, success, and retryable failure.

## Testing

- Confirm the delete control does not trigger the open action.
- Confirm cancelling leaves the report unchanged.
- Confirm successful deletion removes exactly one report.
- Confirm Storage failure prevents row deletion.
- Confirm row deletion failure is retried and surfaced.
- Re-run live two-user RLS verification so another anonymous user cannot
  delete the owner's row or object.

## Delivery

This feature adds no native dependency. After tests, type checking, Android
export, and Supabase integration verification, publish it as an Android preview
update on runtime `1.1.0`.
