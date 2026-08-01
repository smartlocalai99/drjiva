# Custom Medicines and Reminder UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patients create private hospital-linked tablets with images, choose one-to-seven-day or ongoing reminders, view ongoing adherence by week, select Android times directly, and install the verified release APK on the connected phone.

**Architecture:** Private custom medicine metadata and images are owner-scoped in Supabase. Course schedule mode is explicit (`finite` or `ongoing`); ongoing events and local notifications are generated through an idempotent rolling horizon instead of an infinite upfront schedule. Pure scheduling, weekly grouping, time conversion, and image-path rules stay independently testable from Expo screens.

**Tech Stack:** PostgreSQL/Supabase RLS and Storage, Expo SDK 57, expo-image-picker, expo-image-manipulator, expo-notifications, React Native modal controls, Vitest, EAS internal-distribution Android APK, ADB.

## Global Constraints

- Read exact Expo SDK 57 ImagePicker, ImageManipulator, Notifications, Router, Audio, and build documentation before writing Expo code.
- Duration values are exactly `1` through `7` days and `Everyday`.
- Everyday is daily, open-ended, and stops only when the patient stops/deletes the course.
- Patient-added medicine names and images are private to the authenticated owner.
- Avoid unlimited notification/event creation; use an idempotent rolling horizon.
- Keep the previously configured custom medicine reminder sound.
- Do not submit to TestFlight, App Store, or Google Play.
- Preserve unrelated user changes.

---

### Task 1: Private custom medicine and ongoing course schema

**Files:**
- Create: `supabase/migrations/20260801160000_add_custom_medicines_and_ongoing_courses.sql`
- Create: `scripts/verify-reminder-backend.mjs`

**Interfaces:**
- Produces: `patient_custom_medicines`
- Produces: private Storage bucket `patient-medicine-images`
- Produces: course fields `custom_medicine_id`, `schedule_mode`, and `stopped_at`
- Produces: exactly-one medicine source and finite/ongoing validity constraints

- [ ] **Step 1: Write a verifier that expects the new schema and RLS**

The verifier creates a custom medicine as authenticated user A, confirms user A can read it, confirms authenticated user B cannot read it, creates an ongoing course with null duration, and rejects a course containing both catalogue and custom medicine ids.

- [ ] **Step 2: Run the verifier and confirm schema failure**

Run: `set -a; source .env.local; node scripts/verify-reminder-backend.mjs`

Expected: FAIL because `patient_custom_medicines` does not exist.

- [ ] **Step 3: Add schema, constraints, indexes, and RLS**

```sql
check (
  (schedule_mode = 'finite' and duration_days between 1 and 7 and stopped_at is null)
  or (schedule_mode = 'ongoing' and duration_days is null)
);

check (num_nonnulls(medicine_id, custom_medicine_id) = 1);
```

The migration must drop `NOT NULL` from the existing `medicine_id` and
`duration_days` columns before adding these checks. Storage policies must
compare the first object-path folder with `auth.uid()::text`. Custom medicine
uniqueness is owner plus hospital source plus normalized name.

- [ ] **Step 4: Apply and verify**

Run: `npx supabase db push`

Run: `set -a; source .env.local; node scripts/verify-reminder-backend.mjs`

Expected: PASS with owner isolation and constraint rejection confirmed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260801160000_add_custom_medicines_and_ongoing_courses.sql scripts/verify-reminder-backend.mjs
git commit -m "feat: add private ongoing medicine courses"
```

### Task 2: Finite/ongoing scheduling and rolling horizon

**Files:**
- Modify: `src/lib/medicineSchedule.ts`
- Modify: `src/lib/medicineSchedule.test.ts`
- Create: `src/lib/ongoingMedicineSchedule.ts`
- Create: `src/lib/ongoingMedicineSchedule.test.ts`
- Modify: `src/lib/medicineCourseRepository.ts`
- Modify: `src/lib/medicineCourseRepository.test.ts`
- Modify: `src/lib/medicineCourses.ts`
- Modify: `app/_layout.tsx`
- Modify: `app/notification-timings.tsx`

**Interfaces:**
- Produces: `CourseDuration = { mode: 'finite'; days: 1|2|3|4|5|6|7 } | { mode: 'ongoing' }`
- Produces: `buildRollingDoseEvents(course, fromDate, horizonDays): DraftDoseEvent[]`
- Produces: `replenishOngoingCourse(courseId, horizonDays = 14): Promise<void>`

- [ ] **Step 1: Write failing validation and idempotency tests**

```ts
expect(validateCourseDuration({ mode: 'finite', days: 7 })).toBeNull();
expect(validateCourseDuration({ mode: 'finite', days: 8 } as never)).toBe('invalidCourseDuration');
expect(buildRollingDoseEvents(ongoingCourse, '2026-08-01', 14)).toHaveLength(28);
expect(uniqueKeys(events)).toHaveLength(events.length);
```

- [ ] **Step 2: Confirm failures**

Run: `npx vitest run src/lib/medicineSchedule.test.ts src/lib/ongoingMedicineSchedule.test.ts src/lib/medicineCourseRepository.test.ts`

Expected: FAIL for missing duration union and replenishment module.

- [ ] **Step 3: Implement schedule domain and repository writes**

Finite courses create at most seven calendar days. Ongoing courses force daily pattern and create a 14-day horizon. Database event insertion uses upsert/ignore semantics on course, slot, and scheduled time; local notification ids are saved only for newly inserted future events. Stopped courses return without generating events. A small lifecycle coordinator in `_layout` replenishes after authenticated app start and foreground, while notification-timing save replenishes after rescheduling with the new slot times.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/lib/medicineSchedule.test.ts src/lib/ongoingMedicineSchedule.test.ts src/lib/medicineCourseRepository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/medicineSchedule.ts src/lib/medicineSchedule.test.ts src/lib/ongoingMedicineSchedule.ts src/lib/ongoingMedicineSchedule.test.ts src/lib/medicineCourseRepository.ts src/lib/medicineCourseRepository.test.ts src/lib/medicineCourses.ts app/_layout.tsx app/notification-timings.tsx
git commit -m "feat: add ongoing reminder scheduling"
```

### Task 3: Private custom medicine repository and image lifecycle

**Files:**
- Create: `src/lib/customMedicines.ts`
- Create: `src/lib/customMedicines.test.ts`
- Modify: `src/lib/medicineCourses.ts`
- Modify: `src/lib/medicineSearch.ts`
- Modify: `src/lib/medicineSearch.test.ts`

**Interfaces:**
- Produces: `createCustomMedicine({ patientId, hospital, name, imageUri }): Promise<MedicineCatalogueItem>`
- Produces: `loadCustomMedicines(patientId, hospital): Promise<MedicineCatalogueItem[]>`
- Produces: `deleteCustomMedicineImage(path): Promise<void>` for failed-row cleanup

- [ ] **Step 1: Write failing normalization, owner-path, and cleanup tests**

```ts
expect(buildCustomMedicinePath('owner-1', 'pill.jpg')).toMatch(/^owner-1\//);
await expect(createWithAdapter(input, failingRowAdapter)).rejects.toThrow();
expect(storage.remove).toHaveBeenCalledWith([uploadedPath]);
```

- [ ] **Step 2: Confirm failures**

Run: `npx vitest run src/lib/customMedicines.test.ts src/lib/medicineSearch.test.ts`

Expected: FAIL because the custom repository is missing.

- [ ] **Step 3: Implement image compression/upload and row lifecycle**

Use ImagePicker only in the UI boundary. The repository accepts a local URI, uses ImageManipulator to produce a bounded JPEG, uploads with an owner-prefixed UUID path, inserts the custom row, removes the object on insert failure, and returns a signed image URL for display. Merge custom rows with the selected hospital's verified catalogue without leaking them into another patient.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run src/lib/customMedicines.test.ts src/lib/medicineSearch.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/customMedicines.ts src/lib/customMedicines.test.ts src/lib/medicineCourses.ts src/lib/medicineSearch.ts src/lib/medicineSearch.test.ts
git commit -m "feat: add private custom tablets"
```

### Task 4: Add-medicine custom tablet and duration UI

**Files:**
- Create: `src/components/medicine/CustomMedicineSheet.tsx`
- Create: `src/components/medicine/DurationPicker.tsx`
- Modify: `app/add-medicine.tsx`
- Modify: `src/lib/medicineWorkflow.ts`
- Modify: `src/lib/medicineWorkflow.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3 domain functions
- Produces: selectable private tablet and `CourseDuration` UI state

- [ ] **Step 1: Write reducer tests for custom selection and Everyday behavior**

Test that a created custom tablet is selected, finite values retain the repeat selector, Everyday sets `{ mode: 'ongoing' }`, forces `daily`, and hides/disables alternate days.

- [ ] **Step 2: Run workflow tests and confirm failure**

Run: `npx vitest run src/lib/medicineWorkflow.test.ts`

Expected: FAIL for missing custom medicine/duration actions.

- [ ] **Step 3: Implement the UI**

Add `Add new tablet` to the empty/search results area after hospital selection. The sheet supports Take Photo and Choose Photo, preview, name validation, upload progress, retry, and cancel. Replace the duration text input with the exact dropdown choices. Review and success summaries say `Everyday` rather than inventing an end date for ongoing courses.

- [ ] **Step 4: Run Expo tests and typecheck**

Run: `npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/add-medicine.tsx src/components/medicine/CustomMedicineSheet.tsx src/components/medicine/DurationPicker.tsx src/lib/medicineWorkflow.ts src/lib/medicineWorkflow.test.ts
git commit -m "feat: add custom tablet reminder flow"
```

### Task 5: Direct Android time modal

**Files:**
- Create: `src/components/medicine/TimePickerModal.tsx`
- Create: `src/components/medicine/TimePickerModal.test.tsx`
- Modify: `src/components/medicine/SlotTimeEditor.tsx`
- Modify: `src/lib/medicineTime.ts`
- Modify: `src/lib/medicineTime.test.ts`

**Interfaces:**
- Produces: `toTimeParts('13:08') -> { hour: 1, minute: 8, period: 'PM' }`
- Produces: `fromTimeParts({ hour, minute, period }) -> '13:08'`
- Produces: modal with staged value, `onSave(value)`, and `onCancel()`

- [ ] **Step 1: Write failing conversion and modal behavior tests**

Test midnight/noon conversion, exact minutes, Cancel preserving the original value, and Save emitting one normalized `HH:mm` value.

- [ ] **Step 2: Confirm failures**

Run: `npx vitest run src/lib/medicineTime.test.ts src/components/medicine/TimePickerModal.test.tsx`

Expected: FAIL because the parts functions and modal do not exist.

- [ ] **Step 3: Implement direct selection**

Use a React Native Modal with three direct selectors: hour 1–12, minute 00–59, and AM/PM. Keep a local draft initialized on open. Cancel closes without calling `onChange`; Save normalizes through `fromTimeParts` and closes. Retain the existing iOS spinner unless shared styling makes the modal clearer there too; Android must not invoke the previously crashing imperative picker.

- [ ] **Step 4: Run focused and full checks**

Run: `npx vitest run src/lib/medicineTime.test.ts src/components/medicine/TimePickerModal.test.tsx && npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/medicine/TimePickerModal.tsx src/components/medicine/TimePickerModal.test.tsx src/components/medicine/SlotTimeEditor.tsx src/lib/medicineTime.ts src/lib/medicineTime.test.ts
git commit -m "fix: add direct Android reminder time picker"
```

### Task 6: Weekly ongoing streaks and stop cleanup

**Files:**
- Modify: `src/data/medicineCourse.ts`
- Modify: `src/data/medicines.ts`
- Modify: `src/data/medicines.test.ts`
- Modify: `app/reminders.tsx`
- Modify: `src/lib/deleteMedicineReminder.ts`
- Modify: `src/lib/deleteMedicineReminder.test.ts`

**Interfaces:**
- Produces: `MedicineStreakWeek = { label: string; days: MedicineStreakDay[] }`
- Produces: `buildWeeklyMedicineStreak(startDate, events, asOf): MedicineStreakWeek[]`
- Consumes: rolling horizon/stop behavior from Task 2

- [ ] **Step 1: Write failing weekly grouping and stop tests**

```ts
expect(buildWeeklyMedicineStreak('2026-07-20', events, '2026-08-01'))
  .toMatchObject([{ label: 'This week' }, { label: 'Previous week' }]);
expect(cancelDoseNotifications).toHaveBeenCalledWith(expect.arrayContaining(futureIds));
```

- [ ] **Step 2: Confirm failures**

Run: `npx vitest run src/data/medicines.test.ts src/lib/deleteMedicineReminder.test.ts`

Expected: FAIL for missing weekly grouping/ongoing stop behavior.

- [ ] **Step 3: Implement weekly UI and cleanup**

Return current week first, preserve all-dose completion semantics, label earlier weeks by date range when older than one week, and render compact seven-day rows. Ongoing reminder cards expose a separate Stop action with confirmation; Stop/delete sets `stopped_at`, cancels all known future notifications, and prevents replenishment. Finite course rendering remains unchanged.

- [ ] **Step 4: Run full Expo verification**

Run: `npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/medicineCourse.ts src/data/medicines.ts src/data/medicines.test.ts app/reminders.tsx src/lib/deleteMedicineReminder.ts src/lib/deleteMedicineReminder.test.ts
git commit -m "feat: show weekly ongoing medicine streaks"
```

### Task 7: Android QA, APK, and connected-device install

**Files:**
- Modify only if verification finds scoped defects: `app/add-medicine.tsx`, `app/cart.tsx`, `app/checkout.tsx`, `app/orders.tsx`, `app/reminders.tsx`, `app/shop.tsx`, `src/components/medicine/*.tsx`
- Modify if needed: `eas.json`

**Interfaces:**
- Consumes: all mobile tasks from both plans
- Produces: installable internal-distribution APK and installed release on target Android device

- [ ] **Step 1: Run repository and configuration checks**

Run: `npm test && npm run typecheck && npx expo-doctor`

Expected: tests/typecheck pass and Expo Doctor reports no actionable dependency/config mismatch.

- [ ] **Step 2: Verify Android layouts and interactions**

On a narrow Android viewport/device, verify keyboard avoidance, safe areas, long names, custom image actions, duration dropdown, weekly streak rows, exact time entry, `− 1 +` controls, checkout receipt/sound, Orders badge, and order detail. Make only scoped spacing fixes and rerun tests after each fix.

- [ ] **Step 3: Confirm the target device before installation**

Run: `adb devices -l`

Expected: exactly one authorized `device` target. If none or unauthorized, stop before installation and report the precise cable/USB debugging action needed; do not guess a serial.

- [ ] **Step 4: Build the APK without store submission**

Run: `eas build --platform android --profile preview --wait`

Expected: successful internal-distribution Android APK URL. Download it to an explicit temporary path and record its checksum.

- [ ] **Step 5: Install and launch on the connected phone**

Resolve exact values without globs:

```bash
drjiva_device_serial="$(adb devices | awk '$2 == "device" { print $1; exit }')"
drjiva_apk_path="$(pwd)/artifacts/drjiva-preview.apk"
drjiva_application_id="$(node -e "const c=require('./app.json'); process.stdout.write(c.expo.android.package)")"
test -n "$drjiva_device_serial" && test -f "$drjiva_apk_path"
adb -s "$drjiva_device_serial" install -r "$drjiva_apk_path"
```

Run: `adb -s "$drjiva_device_serial" shell monkey -p "$drjiva_application_id" -c android.intent.category.LAUNCHER 1`

Expected: install returns `Success` and the launcher opens DRJIVA directly without a development-server discovery screen.

- [ ] **Step 6: Push mobile code when a remote exists**

Verify `git remote -v`, push the feature branch without force, and report the commit/branch. If no remote exists, retain the verified branch and request only the mobile repository URL; APK creation and device installation still proceed.
