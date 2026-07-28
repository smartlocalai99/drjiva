# Document Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a patient permanently delete an uploaded report from its document row while removing both the private PDF and owner-scoped database record.

**Architecture:** A pure deletion orchestrator enforces Storage-first deletion and one database retry through an injected adapter. The Supabase wrapper supplies owner-scoped Storage and row operations, while the Documents screen owns confirmation, progress, localized feedback, and immediate list removal.

**Tech Stack:** Expo SDK 57, React Native 0.86, Supabase JS 2.110.8, Supabase Storage and Postgres RLS, Vitest.

## Global Constraints

- Target only Medico project `jlvjnnltynebenflkcua`.
- Delete objects through the Supabase Storage API, never SQL.
- Never place a secret or service-role key in the app.
- Preserve owner-scoped row and object DELETE policies.
- Trash icon belongs at the top-right of each document row.
- Deletion is permanent and requires confirmation.
- All new user-visible copy must support English and Telugu.

---

### Task 1: Deletion orchestrator

**Files:**
- Create: `src/lib/deletePatientReport.ts`
- Create: `src/lib/deletePatientReport.test.ts`

**Interfaces:**
- Consumes: report `{ id: string; storagePath: string | null }`.
- Produces: `deletePatientReportWithAdapter(adapter, report): Promise<void>`.

- [ ] **Step 1: Write failing Storage-first and retry tests**

```ts
it('deletes the object before its row', async () => {
  const calls: string[] = [];
  await deletePatientReportWithAdapter({
    removeFile: async () => { calls.push('file'); return null; },
    removeRow: async () => { calls.push('row'); return null; },
  }, { id: 'report-1', storagePath: 'user/patient/report.pdf' });
  expect(calls).toEqual(['file', 'row']);
});

it('does not delete the row when object deletion fails', async () => {
  let rowCalls = 0;
  await expect(deletePatientReportWithAdapter({
    removeFile: async () => new Error('storage failed'),
    removeRow: async () => { rowCalls += 1; return null; },
  }, { id: 'report-1', storagePath: 'user/patient/report.pdf' }))
    .rejects.toThrow('storage failed');
  expect(rowCalls).toBe(0);
});

it('retries one failed row deletion', async () => {
  let rowCalls = 0;
  await deletePatientReportWithAdapter({
    removeFile: async () => null,
    removeRow: async () => {
      rowCalls += 1;
      return rowCalls === 1 ? new Error('temporary') : null;
    },
  }, { id: 'report-1', storagePath: 'user/patient/report.pdf' });
  expect(rowCalls).toBe(2);
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/deletePatientReport.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal orchestrator**

```ts
export async function deletePatientReportWithAdapter(
  adapter: DeletePatientReportAdapter,
  report: { id: string; storagePath: string | null },
): Promise<void> {
  if (report.storagePath) {
    const storageError = await adapter.removeFile(report.storagePath);
    if (storageError) throw storageError;
  }
  const firstError = await adapter.removeRow(report.id);
  if (!firstError) return;
  const retryError = await adapter.removeRow(report.id);
  if (retryError) throw retryError;
}
```

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run src/lib/deletePatientReport.test.ts`

Expected: all deletion tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deletePatientReport.ts src/lib/deletePatientReport.test.ts
git commit -m "feat: add safe patient report deletion"
```

### Task 2: Supabase adapter and local state

**Files:**
- Modify: `src/lib/patientReports.ts`
- Modify: `src/lib/patientReportModel.ts`
- Modify: `src/lib/patientReportModel.test.ts`

**Interfaces:**
- Consumes: `deletePatientReportWithAdapter`.
- Produces: `deletePatientReport(report): Promise<void>`.
- Produces: `removePatientReport(reports, reportId): PatientReport[]`.

- [ ] **Step 1: Write a failing list-removal test**

```ts
expect(removePatientReport([reportA, reportB], reportA.id)).toEqual([reportB]);
expect(removePatientReport([reportA], 'unknown')).toEqual([reportA]);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/patientReportModel.test.ts`

Expected: FAIL because `removePatientReport` is undefined.

- [ ] **Step 3: Implement list removal and Supabase operations**

```ts
export const removePatientReport = (
  reports: PatientReport[],
  reportId: string,
) => reports.filter((report) => report.id !== reportId);
```

Wire `deletePatientReport()` so `removeFile` calls:

```ts
supabase.storage.from('patient-reports').remove([storagePath])
```

and `removeRow` calls:

```ts
supabase.from('patient_reports').delete().eq('id', reportId)
```

Convert non-null Supabase errors to the adapter error return.

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck`

Expected: all tests and TypeScript PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/patientReports.ts src/lib/patientReportModel.ts src/lib/patientReportModel.test.ts
git commit -m "feat: connect report deletion to Supabase"
```

### Task 3: Document-row delete interaction

**Files:**
- Modify: `src/components/documents/ReportList.tsx`
- Modify: `app/documents.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes: `deletePatientReport(report)` and `removePatientReport`.
- Produces: `ReportList` props `onDelete(report)` and `deletingReportId`.

- [ ] **Step 1: Add failing localized-copy assertions**

Extend a pure copy test to require keys for delete, confirmation, deleting,
success, failure, and the legacy-row-only warning in both languages.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because deletion copy/action metadata is missing.

- [ ] **Step 3: Add the row control**

Add a top-right `trash-outline` `PressableScale` with:

```tsx
onPress={(event) => {
  event.stopPropagation();
  onDelete(report);
}}
```

Disable open/delete while `deletingReportId === report.id` and replace the
trash glyph with an `ActivityIndicator`.

- [ ] **Step 4: Add confirmation and state update**

`DocumentsScreen` must confirm destructively, set `deletingReportId`, await
`deletePatientReport(report)`, then call:

```ts
setReports((current) => removePatientReport(current, report.id));
```

Always clear progress in `finally`. Cancellation performs no operation.
When `storagePath` is null, use the legacy warning from the approved design so
the patient knows only the database record will be removed.

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npx expo export --platform android --clear`

Expected: tests, type check, and Android export PASS.

- [ ] **Step 6: Commit**

```bash
git add app/documents.tsx src/components/documents/ReportList.tsx src/lib/i18n.tsx
git commit -m "feat: add document delete controls"
```

### Task 4: Live security verification and preview delivery

**Files:**
- No schema change expected.

**Interfaces:**
- Consumes: existing Medico owner-scoped row/object DELETE policies.
- Produces: verified Android preview update.

- [ ] **Step 1: Verify owner deletion**

Create a temporary patient, anonymous owner, test row, and PDF. Delete through
the publishable-key client and assert both row and signed URL disappear.

- [ ] **Step 2: Verify cross-user denial**

Create a second anonymous session and assert its row DELETE returns zero rows
and its Storage remove call fails or leaves the owner object intact.

- [ ] **Step 3: Clean temporary data**

Delete temporary objects through Storage API and temporary rows/users through
the linked Medico administrative connection.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform android --clear
git diff --check
```

- [ ] **Step 5: Review and publish**

Request a code review, fix all Critical/Important findings, then publish:

```bash
CI=1 npx eas-cli@latest update --branch preview --platform android \
  --environment preview --message "feat: delete uploaded documents"
```

- [ ] **Step 6: Verify published state**

Confirm preview runtime `1.1.0`, commit hash, update group, and clean Git
worktree.
