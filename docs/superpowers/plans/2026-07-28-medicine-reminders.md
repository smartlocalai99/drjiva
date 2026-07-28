# Medicine Courses and Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build hospital-specific medicine course creation, owner-scoped persistence, editable global dose times, local phone notifications, and time-aware dashboard dose cards.

**Architecture:** Pure schedule functions generate course dates, dose events, active windows, and validation. Supabase persists owner-scoped settings/courses/events and catalogue references; a native notification adapter schedules/cancels local alerts. Focused screens handle Notification Timings and Add Medicine, while Home renders stored dose events rather than demo catalogue cards.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, `expo-notifications` `~57.0.7`, Supabase JS 2.110.8, Postgres RLS, Vitest, React Native Reanimated.

## Global Constraints

- Target only Medico project `jlvjnnltynebenflkcua`.
- Read Expo SDK 57 notification documentation before implementation.
- Use medicine images only from Medico `medicines.image_url`.
- Morning defaults to 8:00 AM, afternoon 1:00 PM, night 8:00 PM.
- Notification Timings belongs in More.
- Deliver both real local phone notifications and dashboard cards.
- Search is normalized, case-insensitive, and partial.
- Custom hospitals are patient-owned and never modify verified catalogues.
- `duration_days` is a 1–365 day calendar span.
- Tablet quantity is 0.25–10 in quarter-tablet increments.
- Day pattern is exactly `daily` or `alternate`.
- All patient data is owner-scoped by `(select auth.uid())`.
- The universal `1234` login remains testing-only.
- Native notification changes require runtime `1.2.0` and a new Android APK.
- Android configuration must include `SCHEDULE_EXACT_ALARM`; verify the
  permission and exact trigger behavior on the physical preview device.
- Anonymous test sessions are device-scoped. Production release remains
  blocked on replacing universal `1234` login with real OTP authentication.

---

### Task 1: Schedule and validation domain

**Files:**
- Create: `src/lib/medicineSchedule.ts`
- Create: `src/lib/medicineSchedule.test.ts`

**Interfaces:**
- Produces: `validateMedicineCourseInput(input): string | null`.
- Produces: `generateCourseDates(startDate, durationDays, pattern): string[]`.
- Produces: `expandDoseEvents(input): DraftDoseEvent[]`.
- Produces: `getActiveDose(events, now, slotTimes): DoseEvent | null`.

- [ ] **Step 1: Write failing validation tests**

Cover missing hospital/medicine/slot, tablet quantities `0`, `0.3`, `10.25`,
durations `0` and `366`, and valid quarter increments.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/medicineSchedule.test.ts`

Expected: FAIL because the schedule module is absent.

- [ ] **Step 3: Implement minimal validation**

```ts
const validQuarter = Number.isInteger(input.tabletsPerDose * 4);
if (input.tabletsPerDose < 0.25 || input.tabletsPerDose > 10 || !validQuarter) {
  return 'invalidTabletQuantity';
}
if (input.durationDays < 1 || input.durationDays > 365) {
  return 'invalidCourseDuration';
}
```

- [ ] **Step 4: Write failing date-generation tests**

Assert a five-day daily course yields five dates and a five-day alternate
course yields days 1, 3, and 5.

- [ ] **Step 5: Implement date/event expansion**

Use local calendar dates, selected slots, and the IANA timezone. Each draft
event contains course id, date, slot, scheduled timestamp, and `scheduled`
status.

- [ ] **Step 6: Write and implement active-window tests**

Assert Morning is active from its time until Afternoon, Afternoon until Night,
Night until midnight, and expired/future-only events are not active.

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run src/lib/medicineSchedule.test.ts && npm run typecheck`

```bash
git add src/lib/medicineSchedule.ts src/lib/medicineSchedule.test.ts
git commit -m "feat: add medicine schedule engine"
```

### Task 2: Search normalization and course models

**Files:**
- Create: `src/lib/medicineSearch.ts`
- Create: `src/lib/medicineSearch.test.ts`
- Create: `src/data/patientMedicines.ts`
- Create: `src/data/patientMedicines.test.ts`

**Interfaces:**
- Produces: `normalizeMedicineSearch(value): string`.
- Produces: `matchesMedicineSearch(name, query): boolean`.
- Produces TypeScript rows/settings/course/event DTOs shared by adapters/UI.

- [ ] **Step 1: Write failing fuzzy-search tests**

```ts
expect(matchesMedicineSearch('Dolo 650 Tablet', ' dolo 650 ')).toBe(true);
expect(matchesMedicineSearch('Paracetamol', 'CETAM')).toBe(true);
expect(matchesMedicineSearch('Amoxicillin', 'paracetamol')).toBe(false);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/medicineSearch.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement normalized partial matching**

Normalize Unicode, lowercase, replace punctuation with spaces, collapse
whitespace, and use token-inclusive matching.

- [ ] **Step 4: Add row-mapping tests**

Require mapped medicine results to reject missing `image_url` and preserve the
database image verbatim.

- [ ] **Step 5: Implement model mappings and verify**

Run: `npx vitest run src/lib/medicineSearch.test.ts src/data/patientMedicines.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/lib/medicineSearch.ts src/lib/medicineSearch.test.ts \
  src/data/patientMedicines.ts src/data/patientMedicines.test.ts
git commit -m "feat: add medicine search and course models"
```

### Task 3: Medico schema and RLS

**Files:**
- Create via CLI: migration `add_patient_medicine_courses`
- Test: live two-user RLS script executed from the shell without committing secrets.

**Interfaces:**
- Produces tables from the approved spec plus
  `patient_medicine_dose_events.notification_id text`.
- Produces indexes for owner/date queries and hospital/medicine search.

- [ ] **Step 1: Create the migration with the CLI**

Run:

```bash
npx supabase@latest migration new add_patient_medicine_courses
```

- [ ] **Step 2: Add exact constraints and indexes**

Create the five approved tables, foreign keys, checks, unique constraints, and:

```sql
create index patient_medicine_events_owner_scheduled_idx
  on public.patient_medicine_dose_events
  (owner_user_id, patient_id, scheduled_for);
```

Use a generated normalized-name column or explicit stored normalized name for
custom-hospital uniqueness.

- [ ] **Step 3: Add RLS**

Enable RLS on every new table. For SELECT/INSERT/UPDATE/DELETE, require:

```sql
(select auth.uid()) = owner_user_id
```

UPDATE policies include both `using` and `with check`. Child rows must also
reference an owner-scoped parent course.

- [ ] **Step 4: Apply only the new migration to Medico**

Use `--profile medico`, execute the exact migration file, then repair only its
new version as applied. Preserve remote versions `0001`–`0010`.

- [ ] **Step 5: Verify two-user isolation**

Create two anonymous users. User A creates settings/course/events; User B must
see zero rows and cannot update/delete A's rows. Clean all temporary data.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/<generated>_add_patient_medicine_courses.sql
git commit -m "feat: add secure medicine course schema"
```

### Task 4: Supabase catalogue, settings, and course adapters

**Files:**
- Create: `src/lib/medicineCourses.ts`
- Create: `src/lib/medicineCourseRepository.ts`
- Create: `src/lib/medicineCourseRepository.test.ts`

**Interfaces:**
- Produces `fetchVerifiedHospitals()`.
- Produces `searchHospitalMedicines(hospitalId, query)`.
- Produces `searchAllMedicines(query)` for custom hospitals.
- Produces `getNotificationSettings(patientId)`.
- Produces `saveNotificationSettings(input)`.
- Produces `createMedicineCourse(input, draftEvents)`.
- Produces `fetchDoseEvents(patientId, date)`.
- Produces `completeDoseEvent(eventId)`.

- [ ] **Step 1: Write failing transaction/rollback adapter tests**

Inject a repository adapter and assert course creation removes its course when
slot or event insertion fails. Assert catalogue mappings never synthesize an
image URL.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/medicineCourseRepository.test.ts`

Expected: FAIL because repository functions are absent.

- [ ] **Step 3: Implement minimal repository orchestration**

Insert course, slots, then events; on failure delete the owner-created course,
using FK cascades for children. Return the persisted course/events only after
all inserts succeed.

- [ ] **Step 4: Implement Supabase queries**

Sanitize and normalize the query, use a bounded case-insensitive database
candidate query, then apply `matchesMedicineSearch` locally. Verified searches
also filter `hospital_id`; custom-hospital searches omit that filter. Both
reject null/blank `image_url` and never synthesize an image.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/lib/medicineCourses.ts src/lib/medicineCourseRepository.ts \
  src/lib/medicineCourseRepository.test.ts
git commit -m "feat: connect medicine courses to Supabase"
```

### Task 5: Local notification adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Create: `src/lib/medicineNotifications.ts`
- Create: `src/lib/medicineNotifications.test.ts`

**Interfaces:**
- Produces `requestMedicineNotificationPermission()`.
- Produces `scheduleDoseNotifications(events, medicine): ScheduledNotification[]`.
- Produces `cancelDoseNotifications(ids): Promise<void>`.
- Produces `replaceDoseNotifications(oldIds, newEvents, medicine)`.

- [ ] **Step 1: Write failing rollback tests**

Assert partial scheduling failure cancels identifiers already created. Assert
replacement schedules all new alerts before cancelling old identifiers.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/medicineNotifications.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Install the exact SDK 57 package**

Run:

```bash
npx expo install expo-notifications
```

Confirm resolved version is `~57.0.7`. Add the config plugin and default Android
channel. Add Android `SCHEDULE_EXACT_ALARM` permission. Bump app/package
version and runtime to `1.2.0`.

- [ ] **Step 4: Implement notification setup**

Create Android channel `medicine-reminders` before requesting Android 13
permission. Schedule one-off `DATE` triggers with medicine name, tablet count,
slot, channel id, and navigation data. Store every returned identifier in the
matching event `notification_id`.

- [ ] **Step 5: Implement rollback/replacement and verify**

Run: `npx vitest run src/lib/medicineNotifications.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json \
  src/lib/medicineNotifications.ts src/lib/medicineNotifications.test.ts
git commit -m "feat: schedule local medicine notifications"
```

### Task 6: Notification Timings in More

**Files:**
- Modify: `src/lib/moreMenu.ts`
- Modify: `src/lib/moreMenu.test.ts`
- Modify: `app/more.tsx`
- Create: `app/notification-timings.tsx`
- Create: `src/components/medicine/TimeSlotEditor.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes settings adapter and notification replacement.
- Produces More menu key `notificationTimings`.

- [ ] **Step 1: Update the failing More-menu test**

Require:

```ts
['profile', 'notificationTimings', 'language']
```

and verify the existing generic coming-soon notification row is removed.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/moreMenu.test.ts`

Expected: FAIL against the current `notifications` key.

- [ ] **Step 3: Add navigation and screen**

The row navigates to `/notification-timings?phone=...`. The screen loads the
patient/settings, edits three HH:mm values with a compact native-free selector,
validates chronological order, and saves.

- [ ] **Step 4: Reschedule active courses**

Calculate replacement event times, schedule all new notifications, persist the
new settings/event timestamps/identifiers, then cancel old ids. If persistence
fails, cancel the new ids and keep the prior settings and notifications.
Permission denial keeps dashboard schedules and offers system Settings.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck`

```bash
git add app/more.tsx app/notification-timings.tsx \
  src/components/medicine/TimeSlotEditor.tsx src/lib/moreMenu.ts \
  src/lib/moreMenu.test.ts src/lib/i18n.tsx
git commit -m "feat: add notification timing settings"
```

### Task 7: Add Medicine workflow

**Files:**
- Create: `app/add-medicine.tsx`
- Create: `src/components/medicine/HospitalPicker.tsx`
- Create: `src/components/medicine/MedicineSearch.tsx`
- Create: `src/components/medicine/CourseDetailsForm.tsx`
- Create: `src/components/medicine/MedicineSuccessModal.tsx`
- Modify: `app/home.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes hospital/medicine search, schedule engine, repository, and
  notification adapter.
- Produces complete persisted course and scheduled notifications.

- [ ] **Step 1: Write failing workflow-state tests**

Create a pure reducer test covering hospital → medicine → details → review,
back navigation, custom hospital, and validation errors.

- [ ] **Step 2: Run RED**

Run: focused workflow reducer test.

Expected: FAIL because the reducer is absent.

- [ ] **Step 3: Implement the reducer and compact step components**

Hospital selection comes first. Debounce search by 250 ms. Verified hospitals
filter their medicine catalogue; custom hospitals search the global catalogue.
Only results with database images are selectable.

- [ ] **Step 4: Implement submit orchestration**

Resolve patient/session, validate, generate events, persist course, request
permission, schedule notifications, persist identifiers, and rollback scheduled
ids/course on hard failure. Permission denial is a soft success with dashboard
reminders retained.

- [ ] **Step 5: Add success animation**

Use Reanimated scale/fade/checkmark motion, block duplicate submissions, close
automatically, and route to Home with a refresh parameter.

- [ ] **Step 6: Wire Home Add Medicine**

Replace the coming-soon alert with:

```ts
router.push({ pathname: '/add-medicine', params: { phone } });
```

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run typecheck && npx expo export --platform android --clear`

```bash
git add app/add-medicine.tsx app/home.tsx src/components/medicine src/lib/i18n.tsx
git commit -m "feat: add medicine course creator"
```

### Task 8: Time-aware dashboard and completion

**Files:**
- Modify: `src/data/medicines.ts`
- Modify: `src/data/medicineCourse.ts`
- Modify: `src/data/medicines.test.ts`
- Modify: `app/home.tsx`
- Modify: `src/components/dashboard/MedicineCard.tsx`

**Interfaces:**
- Replaces demo `fetchMedicinesForDate(date)` with patient dose-event query.
- Persists dose completion through `completeDoseEvent`.

- [ ] **Step 1: Write failing dose-card mapping tests**

Assert mapped cards preserve database image, patient tablet quantity, hospital,
slot, scheduled time, and persisted completion. Assert expired events are
excluded from today's active list.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/data/medicines.test.ts`

Expected: FAIL against current deterministic demo data.

- [ ] **Step 3: Implement patient event fetching**

Change the fetch signature to:

```ts
fetchMedicinesForDate(patientId: string, date: Date, now = new Date())
```

Join course, medicine, hospital/custom hospital, settings, and dose events.
Historical/future selected dates show all scheduled events; today emphasizes
only the active window and next upcoming dose.

- [ ] **Step 4: Persist completion**

Toggle calls `completeDoseEvent(id)` and updates state only after success.
Completed events remain visible in their current window with the existing
success animation.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/data/medicines.ts src/data/medicineCourse.ts \
  src/data/medicines.test.ts app/home.tsx \
  src/components/dashboard/MedicineCard.tsx
git commit -m "feat: show scheduled patient medicine doses"
```

### Task 9: Security, native build, and preview delivery

**Files:**
- Modify only files required by review findings.

**Interfaces:**
- Produces a verified Medico database, Android 1.2.0 APK, and preview update.

- [ ] **Step 1: Run full verification**

```bash
npm ci
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform android --clear
git diff --check
```

- [ ] **Step 2: Run live integration tests**

Verify two-user RLS, course rollback, permission denial, one real notification
on a physical Android device, timing replacement, alternate days, completion,
and app restart.

- [ ] **Step 3: Request code review**

Review the full medicine range against the approved spec. Fix every
Critical/Important issue and rerun verification.

- [ ] **Step 4: Build Android preview**

```bash
npx eas-cli@latest build --platform android --profile preview \
  --non-interactive --no-wait
```

Monitor to terminal `FINISHED`; do not publish an update to runtime `1.2.0`
until the native build succeeds.

- [ ] **Step 5: Publish final preview update**

```bash
CI=1 npx eas-cli@latest update --branch preview --platform android \
  --environment preview --message "feat: medicine courses and reminders"
```

- [ ] **Step 6: Verify and report**

Verify APK download, build version/runtime, update group/commit, migrations,
clean worktree, and note that no Git remote exists if that remains true.
