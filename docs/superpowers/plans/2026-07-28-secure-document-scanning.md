# Secure Document Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan one or more report pages, classify them on-device, create one PDF, upload privately, and attach it to the current Medico patient.

**Architecture:** Native capture and OCR are wrapped behind small adapters. Pure functions handle classification, paths, and validation. Supabase anonymous Auth supplies a real `auth.uid()` for RLS, while a private Storage bucket and patient report rows enforce per-user ownership.

**Tech Stack:** Expo SDK 57, React Native 0.86, `react-native-document-scanner-plugin@2.0.4`, `@react-native-ml-kit/text-recognition@2.0.0`, Expo Print, Expo FileSystem, Supabase Auth/Database/Storage, Vitest.

## Global Constraints

- Target the Medico project `jlvjnnltynebenflkcua` only.
- Never expose scanned reports through a public bucket or public URL.
- Never send report images or OCR text to an external AI provider.
- Keep the temporary `1234` check unchanged and label it non-production.
- Native dependency changes require a new Android preview build.
- Use TDD for all pure production functions.

---

### Task 1: Authentication session and database security

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/reportAuth.ts`
- Create: `src/lib/reportAuth.test.ts`
- Create via CLI: a migration named `secure_patient_report_storage`

**Interfaces:**
- Produces: `ensureReportSession(): Promise<string>` returning `auth.uid()`.
- Produces database columns `owner_user_id`, `report_type`, `page_count`, and
  `storage_path`.

- [ ] **Step 1: Write a failing session test**

Inject a Supabase Auth adapter and assert an existing user id is reused while a
missing session calls anonymous sign-in exactly once.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/reportAuth.test.ts`

Expected: FAIL because `ensureReportSession` does not exist.

- [ ] **Step 3: Implement session establishment**

Call `supabase.auth.getUser()`, then `supabase.auth.signInAnonymously()` only
when no user exists. Invoke it after successful `1234` verification.

- [ ] **Step 4: Create the migration**

Use `npx supabase@latest migration new secure_patient_report_storage`, add the
four columns, make `patient-reports` private with PDF/20 MB limits, remove the
broad report policies, and add owner-scoped row/object policies using
`(select auth.uid())`.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/lib/reportAuth.test.ts && npm run typecheck`

Then commit the auth module, test, OTP integration, and generated migration.

### Task 2: Classification and validation

**Files:**
- Create: `src/lib/documentClassifier.ts`
- Create: `src/lib/documentClassifier.test.ts`

**Interfaces:**
- Produces:
  `classifyDocument(text: string, hospitals: HospitalOption[]): Classification`.
- Produces:
  `validateReportMetadata(input: ReportMetadataInput): string | null`.

- [ ] **Step 1: Write failing classifier tests**

Cover prescription, OP consultation, laboratory, imaging, discharge, unknown
text, hospital-name matching, tied scores, and missing manual fields.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/documentClassifier.test.ts`

Expected: FAIL because the classifier module does not exist.

- [ ] **Step 3: Implement keyword scoring**

Normalize case and punctuation, score explicit keyword groups, accept only a
unique positive winner, and choose the longest matching normalized hospital
name.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- src/lib/documentClassifier.test.ts`

Commit the classifier and its tests.

### Task 3: Scan, PDF, and upload adapters

**Files:**
- Create: `src/lib/documentScanner.ts`
- Create: `src/lib/documentScanner.test.ts`
- Create: `src/lib/patientReports.ts`
- Create: `src/lib/patientReports.test.ts`
- Modify: `app.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `scanReportPages(): Promise<string[] | null>`.
- Produces: `createReportPdf(base64Pages: string[]): Promise<string>`.
- Produces:
  `buildReportStoragePath(userId: string, patientId: string, documentId: string): string`.
- Produces: `uploadPatientReport(input): Promise<PatientReport>`.

- [ ] **Step 1: Write failing path and validation tests**

Assert cancellation returns `null`, empty scans are rejected, unsafe path
characters cannot escape the user folder, and PDF metadata maps to the row.

- [ ] **Step 2: Verify RED**

Run:
`npm test -- src/lib/documentScanner.test.ts src/lib/patientReports.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Install pinned native packages**

Run:
`npx expo install react-native-document-scanner-plugin@2.0.4 @react-native-ml-kit/text-recognition@2.0.0 expo-print expo-file-system`

Add the scanner config plugin and camera permission copy to `app.json`.

- [ ] **Step 4: Implement adapters**

Capture up to ten base64 JPEG pages, OCR the first page, create an A4 HTML/PDF
with one image per page, upload an ArrayBuffer to the private bucket, then
insert the owner-scoped `patient_reports` row. Remove the object if row insert
fails.

- [ ] **Step 5: Verify and commit**

Run:
`npm test -- src/lib/documentScanner.test.ts src/lib/patientReports.test.ts && npm run typecheck`

Commit dependencies, configuration, adapters, and tests.

### Task 4: Documents workflow UI

**Files:**
- Modify: `app/documents.tsx`
- Create: `src/components/documents/DocumentReviewSheet.tsx`
- Create: `src/components/documents/ReportList.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes scan/PDF/classification/upload adapters from Tasks 2 and 3.
- Produces a **Scan Document** flow and grouped patient report list.

- [ ] **Step 1: Add a failing copy assertion**

Add a pure copy/menu test asserting the primary document action is
`"Scan Document"` and its icon is `"scan-outline"`.

- [ ] **Step 2: Verify RED**

Run the focused copy/menu test and confirm it fails on the current Add Document
value.

- [ ] **Step 3: Implement workflow**

Resolve the patient id from phone, launch capture, OCR/classify, show the review
sheet, require missing dropdown values, upload with progress, reload folders,
and open reports through fresh signed URLs.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run typecheck`

Commit the Documents screen, components, copy, and tests.

### Task 5: Medico migration and Android delivery

**Files:**
- Modify only migration history generated by Task 1.

**Interfaces:**
- Consumes the committed migration and native configuration.
- Produces a verified Medico database and installable Android preview APK.

- [ ] **Step 1: Enable anonymous Auth for Medico**

Update only project `jlvjnnltynebenflkcua`, then read `/auth/v1/settings` and
verify `external.anonymous_users` is `true`.

- [ ] **Step 2: Apply and record the migration**

Execute the generated migration against the linked Medico project, record only
its new version, and leave remote versions `0001` through `0010` untouched.

- [ ] **Step 3: Verify RLS**

Create two temporary anonymous sessions and prove user A cannot select or
download user B's report. Delete the temporary test rows and objects.

- [ ] **Step 4: Run complete verification**

Run:
`npm test && npm run typecheck && npx expo-doctor && npx expo export --platform android --clear`

- [ ] **Step 5: Build and publish**

Commit remaining changes, run an Android EAS preview build, then publish the
same commit to the `preview` update channel and report the APK URL.

