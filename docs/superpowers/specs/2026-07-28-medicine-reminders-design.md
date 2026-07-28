# Medicine Courses and Reminders Design

## Goal

Let a patient create a hospital-specific medicine course, receive real phone
notifications, and see only the currently relevant dose cards on the
dashboard.

## Patient Workflow

### Notification Timings

The More tab adds **Notification Timings**. Its screen contains three editable
global defaults:

- Morning: 8:00 AM
- Afternoon: 1:00 PM
- Night: 8:00 PM

These settings control both phone notifications and dashboard time windows.
Changing a default reschedules future notifications for active courses. Times
are stored with the patient's current IANA timezone.

### Add Medicine

Tapping **Add Medicine** opens a compact multi-step sheet:

1. Select a verified hospital or a patient-created custom hospital.
2. Search medicines belonging to that hospital.
3. Select a medicine result. Search is forgiving: normalized,
   case-insensitive, and partial-name matching.
4. Enter tablets per dose and total course days.
5. Select one or more slots: Morning, Afternoon, Night.
6. Select day pattern: Every day or Alternate days.
7. Review and submit.

The selected medicine retains its Medico database `image_url`; the reminder
card never substitutes a random or externally fetched medicine image.

If a hospital is missing, the patient can enter its name. This creates a
patient-owned custom hospital and does not modify the verified global hospital
catalogue.

After creation, an animated success popup confirms that reminders were
scheduled, closes automatically, and refreshes the dashboard.

## Scheduling Semantics

- A course begins on the selected start date, defaulting to today.
- `duration_days` is the calendar span of the course, not the number of doses.
- Every-day courses include every date in that calendar span.
- Alternate-day courses include the start date and then every second date
  within the same span.
- Each included date generates one dose for every selected slot.
- Phone notifications fire at the patient's Morning, Afternoon, and Night
  defaults.
- A dashboard dose becomes active at its scheduled time and remains active
  until the next configured slot begins. The final slot expires at midnight.
- When no dose is currently active, the dashboard may show the next upcoming
  dose time but does not show expired dose cards.
- Completing a dose persists a completion event; it is not only local UI state.
- Past, completed, cancelled, and future courses are derived from stored
  course and dose data rather than demo values.

## Database Design

### `patient_notification_settings`

- `patient_id uuid primary key references patients(id)`
- `owner_user_id uuid not null references auth.users(id)`
- `morning_time time not null default '08:00'`
- `afternoon_time time not null default '13:00'`
- `night_time time not null default '20:00'`
- `timezone text not null`
- timestamps

### `patient_custom_hospitals`

- `id uuid primary key`
- `patient_id uuid not null`
- `owner_user_id uuid not null`
- normalized and display names
- timestamps
- unique owner/name constraint

### `patient_medicine_courses`

- `id uuid primary key`
- `patient_id uuid not null`
- `owner_user_id uuid not null`
- exactly one verified `hospital_id` or custom hospital id
- `medicine_id uuid not null references medicines(id)`
- `tablets_per_dose numeric not null`
- `start_date date not null`
- `duration_days integer not null`
- `day_pattern text` constrained to `daily` or `alternate`
- `status text` constrained to `active`, `completed`, or `cancelled`
- timestamps

### `patient_medicine_course_slots`

- `id uuid primary key`
- `course_id uuid not null`
- `slot text` constrained to `morning`, `afternoon`, or `night`
- unique course/slot constraint

### `patient_medicine_dose_events`

- `id uuid primary key`
- `course_id uuid not null`
- `patient_id uuid not null`
- `owner_user_id uuid not null`
- `scheduled_for timestamptz not null`
- `slot text not null`
- `status text` constrained to `scheduled`, `completed`, `missed`, or
  `cancelled`
- `completed_at timestamptz`
- `notification_id text`
- unique course/scheduled-time constraint

All tables use RLS. Patient operations require
`owner_user_id = (select auth.uid())`. Verified medicine and hospital catalogue
tables remain read-only from this patient workflow.

## Search and Catalogue Rules

- Hospital selection happens before medicine search.
- Verified hospital medicine results filter using the catalogue's hospital
  identity and normalized partial medicine name.
- A custom hospital has no verified hospital-specific catalogue, so its search
  uses normalized partial-name matching across the existing Medico medicine
  catalogue. The user must still select an existing database medicine, which
  preserves the required database image.
- Custom hospitals do not add records to the verified hospital or medicine
  catalogues. Adding custom medicines is outside this version.

## Notifications

Use `expo-notifications` for local scheduled notifications. Request Android
notification permission only when the patient saves the first reminder or
enables notifications. Store scheduled notification identifiers so edits,
cancellations, timing changes, and course completion can cancel and reschedule
the correct notifications.

Android notification channels use high importance and a medicine-reminder
label. Notification content includes medicine name, tablet quantity, and
Morning/Afternoon/Night slot without exposing unrelated medical data.

Because `expo-notifications` adds native code, delivery requires a new Android
preview APK and a new runtime version. The universal `1234` login remains
testing-only and must be replaced by real OTP before production medical use.

## Dashboard

- Replace demo catalogue cards with patient dose events for the selected date.
- Use the linked catalogue medicine image.
- Show tablet quantity, slot, next scheduled time, hospital, and completion
  control.
- Refresh after course creation, notification timing changes, completion, and
  pull-to-refresh.
- The date timeline displays dose events for historical and future dates
  without mutating them locally.

## Error Handling

- Validate positive tablet quantity, bounded duration, at least one slot, a
  hospital, and a medicine before submit.
- Tablet quantity accepts quarter-tablet increments from 0.25 through 10.
- Course duration accepts 1 through 365 calendar days.
- If database creation fails, schedule no notifications.
- If notification scheduling partially fails, cancel identifiers already
  created and mark creation unsuccessful.
- If database creation succeeds but device permission is denied, keep the
  course and dashboard reminders, explain that phone alerts are disabled, and
  offer Notification Settings.
- Timing changes use all-or-nothing replacement: prepare new schedules, then
  cancel old identifiers after new scheduling succeeds.

## Testing

- Pure tests for daily/alternate date generation, slot expansion, active-dose
  windows, validation, fuzzy search normalization, and schedule replacement.
- Data-adapter tests for rollback and notification identifier persistence.
- RLS integration tests with two anonymous users.
- Device verification for permission denied/granted, notification delivery,
  timing changes, course completion, and app restart.
- Full Vitest, TypeScript, Expo Doctor, Android export, EAS Android build, and
  preview update verification.
