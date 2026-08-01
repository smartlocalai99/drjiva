# Custom Course Days and Android Start-Date Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support finite medicine courses from 1 through 365 days, preserve `Everyday`, prevent the Android course-start-date picker crash, and produce an installable Android build.

**Architecture:** Keep duration rules in the existing schedule domain module and make the picker consume those rules. Isolate Android date-picker option construction in a pure helper so tests can prove Material-only options are absent. Align Supabase's finite-course constraint with the same 1–365 range before building the verified app.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, `@react-native-community/datetimepicker` 9.1.0, Vitest, Supabase/PostgreSQL, EAS Build.

## Global Constraints

- Finite course duration is a whole number from 1 through 365 days.
- `Everyday` remains a distinct open-ended schedule mode.
- Android uses the default imperative native date picker; iOS retains the inline picker.
- Existing dashboard streak presentation remains compact and unchanged.
- Preserve all unrelated modified and untracked worktree files.
- Follow the exact Expo SDK 57 documentation and installed datetime-picker 9.1.0 API.

---

### Task 1: Duration Domain Rules

**Files:**
- Modify: `src/lib/medicineSchedule.ts`
- Test: `src/lib/medicineSchedule.test.ts`

**Interfaces:**
- Produces: `MIN_COURSE_DAYS = 1`, `MAX_COURSE_DAYS = 365`
- Produces: `parseCustomCourseDays(value: string): number | null`
- Changes: `CourseDuration` finite `days` becomes `number`
- Consumed by: `DurationPicker`, add-medicine validation, and Task 3 tests

- [ ] **Step 1: Write failing duration tests**

Add assertions that `{ mode: 'finite', days: 8 }` and `days: 365` validate, `days: 366` fails, `validateMedicineCourseInput` accepts 365 and rejects 366, and `parseCustomCourseDays` accepts trimmed whole numbers while rejecting blank, decimal, zero, negative, and 366.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/medicineSchedule.test.ts`

Expected: FAIL because finite values above 7 are rejected and `parseCustomCourseDays` does not exist.

- [ ] **Step 3: Implement the shared duration rules**

Replace the 1–7 union with numeric finite days, add the exported bounds, implement `parseCustomCourseDays` using strict digit-only parsing, and reuse the bounds in both duration validators.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/medicineSchedule.test.ts`

Expected: all medicine schedule tests pass.

- [ ] **Step 5: Commit the domain change**

Stage only `src/lib/medicineSchedule.ts` and `src/lib/medicineSchedule.test.ts`, then commit with `feat: support custom medicine course days`.

---

### Task 2: Safe Android Date-Picker Options

**Files:**
- Create: `src/lib/courseStartDatePicker.ts`
- Create: `src/lib/courseStartDatePicker.test.ts`
- Modify: `src/components/medicine/course-start-date-picker.tsx`

**Interfaces:**
- Produces: `buildAndroidCourseDatePickerOptions(input)` returning the default Android date-picker parameters
- Consumes: `value`, `minimumDate`, `maximumDate`, and an `onValueChange(date)` callback
- Guarantee: result does not contain `design`, `title`, or `initialInputMode`

- [ ] **Step 1: Write the failing Android-options test**

Test that the helper returns `mode: 'date'`, preserves its date bounds and current value, forwards selected dates, and has no Material-only keys.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/courseStartDatePicker.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement and wire the safe options helper**

Create the pure option builder and use it in `CourseStartDatePicker` when calling `DateTimePickerAndroid.open`. Keep the iOS branch and inline component unchanged.

- [ ] **Step 4: Run both focused tests and verify GREEN**

Run: `npm test -- src/lib/courseStartDatePicker.test.ts src/lib/medicineSchedule.test.ts`

Expected: both suites pass and the Android options contain no Material-only configuration.

- [ ] **Step 5: Commit the Android crash fix**

Stage only the three Task 2 files and commit with `fix: use stable Android course date picker`.

---

### Task 3: Custom Duration Picker UI

**Files:**
- Modify: `src/components/medicine/DurationPicker.tsx`
- Modify: `app/add-medicine.tsx`
- Test: `src/lib/medicineSchedule.test.ts`

**Interfaces:**
- Consumes: `CourseDuration`, `parseCustomCourseDays`, `MIN_COURSE_DAYS`, and `MAX_COURSE_DAYS`
- Produces through existing prop: `onChange({ mode: 'finite', days })`

- [ ] **Step 1: Add the remaining failing label/parsing assertions**

Verify that a finite 30-day duration formats as `30 days` and the parsing helper rejects non-digit characters and whitespace-only input.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/medicineSchedule.test.ts`

Expected: the new assertion fails until custom duration labeling/input behavior is supported.

- [ ] **Step 3: Implement the Custom sheet state**

Keep quick options 1–7 and `Everyday`, add `Custom`, show a number-pad `TextInput`, preserve the previous value when the sheet opens, display `Enter a whole number from 1 to 365 days` for invalid input, and call `onChange` only after a valid Apply action.

- [ ] **Step 4: Verify the duration is propagated**

Confirm `app/add-medicine.tsx` uses the numeric finite duration for validation, course-end preview, generated events, saved `duration_days`, and confirmation labels without a 7-day clamp.

- [ ] **Step 5: Run focused tests and type checking**

Run: `npm test -- src/lib/medicineSchedule.test.ts src/lib/courseStartDatePicker.test.ts && npm run typecheck`

Expected: both test suites and TypeScript pass.

- [ ] **Step 6: Commit the picker UI**

Stage only `DurationPicker.tsx`, `add-medicine.tsx`, and the Task 3 test changes, then commit with `feat: add custom course duration input`.

---

### Task 4: Supabase Constraint Alignment

**Files:**
- Create: `supabase/migrations/20260802090000_expand_finite_course_duration.sql`
- Create: `supabase/tests/course_duration_constraints_test.sql`

**Interfaces:**
- Changes `patient_medicine_course_schedule_valid` finite branch from `1 and 7` to `1 and 365`
- Preserves ongoing-course requirements: null duration, daily pattern, and existing stopped-state behavior

- [ ] **Step 1: Write the failing PostgreSQL constraint test**

Cover acceptance of a finite 365-day row, rejection of a 366-day row, and continued acceptance of a valid ongoing row.

- [ ] **Step 2: Run the database test against the current schema and verify RED**

Run: `npx supabase start && npx supabase test db supabase/tests/course_duration_constraints_test.sql`

Expected: the 365-day finite insert fails under the current 7-day constraint.

- [ ] **Step 3: Write the migration**

Drop and recreate `patient_medicine_course_schedule_valid` with the finite range `duration_days between 1 and 365`, retaining the ongoing branch verbatim.

- [ ] **Step 4: Apply and verify the migration**

Run the database test again, then push the migration to the linked Dr Jiva Supabase project and verify the remote constraint definition.

Expected: 365-day and ongoing cases pass; 366 days remains rejected.

- [ ] **Step 5: Commit the database change**

Stage only the new migration and its test, then commit with `feat: allow year-long finite medicine courses`.

---

### Task 5: Full Verification and Android Build

**Files:**
- Modify only if required by build version policy: `app.json` or `eas.json`
- Output: installable Android APK artifact outside the repository source tree

**Interfaces:**
- Consumes the completed app and deployed schema
- Produces an APK installable on Android devices

- [ ] **Step 1: Run the complete automated verification**

Run: `npm test && npm run typecheck && npx expo-doctor`

Expected: all tests pass, TypeScript reports no errors, and Expo Doctor reports no actionable dependency/config failures.

- [ ] **Step 2: Inspect the final diff and commit scope**

Confirm every implementation commit contains only its named files and that pre-existing unrelated changes remain unstaged and untouched.

- [ ] **Step 3: Build the Android preview APK**

Use the existing EAS preview/APK profile if present; otherwise add the minimal APK profile required by the project and run `npx eas-cli@latest build --platform android --profile preview`.

Expected: EAS reports a finished Android APK build and provides an artifact URL.

- [ ] **Step 4: Install and manually verify when a device is connected**

Install the APK on the connected Android device, then execute the acceptance flow from the design: select a custom value above 7, verify the end date, open and change the start date without a crash, and save the reminder.

- [ ] **Step 5: Push the implementation commits**

Push `main` only after verification and report the commit hashes, migration status, APK location/link, installation status, and whether future changes of this kind require an app rebuild.
