# Patient Order Null Landmark Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep valid patient orders visible when the optional delivery landmark is null.

**Architecture:** Preserve the database and RPC contract. Normalize the nullable landmark at the existing mobile API boundary while retaining strict validation for malformed non-null values and every required order field.

**Tech Stack:** TypeScript, Expo SDK 57, React Native, Supabase JS, Vitest

## Global Constraints

- Do not change the database schema or production order data.
- Convert only a null or missing landmark to an empty display string.
- Continue rejecting malformed non-null landmarks and malformed required fields.
- Preserve unrelated working-tree changes.

---

### Task 1: Normalize an optional order landmark

**Files:**
- Modify: `src/lib/patientOrders.test.ts`
- Modify: `src/lib/patientOrders.ts`

**Interfaces:**
- Consumes: `mapPatientOrder(value: unknown): PatientOrder`
- Produces: `PatientOrder.address.landmark` as a string, using `''` when the RPC value is null or missing

- [ ] **Step 1: Write the failing regression test**

Add this case to the `patient order normalization` suite:

```ts
it('keeps an order visible when its optional landmark is missing', () => {
  expect(
    mapPatientOrder({
      ...orderRow,
      address: { ...orderRow.address, landmark: null },
    }),
  ).toMatchObject({
    address: { landmark: '' },
    id: 'order-1',
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/patientOrders.test.ts`

Expected: FAIL with `Invalid address landmark.`

- [ ] **Step 3: Implement the smallest production repair**

In `mapPatientOrder`, replace the strict landmark conversion with:

```ts
landmark: nullableString(address.landmark, 'address landmark') ?? '',
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- src/lib/patientOrders.test.ts
npm test
npm run typecheck
npx expo-doctor
```

Expected: the focused regression passes, all tests pass, TypeScript exits 0, and Expo Doctor reports all checks passed.

- [ ] **Step 5: Verify the production response shape without modifying data**

Query the linked Supabase project and confirm the latest order has `address_landmark is null`, one or more items, and no other unexpected nullable required fields.

- [ ] **Step 6: Commit only the repair files**

```bash
git add src/lib/patientOrders.test.ts src/lib/patientOrders.ts
git commit -m "fix: show orders without landmarks"
```

### Task 2: Distribute the repaired client

**Files:**
- Output: `/Users/vardhanreddy/Desktop/DrJiva-1.2.0-build13-orders-fixed.apk`
- Install: iOS Release app `com.drjiva.patient` on the connected iPhone

**Interfaces:**
- Consumes: the verified JavaScript repair from Task 1
- Produces: an Android APK and installed iOS Release binary containing the repair

- [ ] **Step 1: Build the Android preview APK**

Run `npx eas-cli build -p android --profile preview --message "Fix orders without landmarks" --wait --non-interactive` and verify EAS reports `FINISHED`.

- [ ] **Step 2: Download and verify the Android artifact**

Download the EAS `applicationArchiveUrl` to the output path, then run `file`, `stat`, `shasum -a 256`, and `unzip -tq` against the APK.

- [ ] **Step 3: Build and install the iOS Release app**

Run `npx expo run:ios --configuration Release --device 00008140-000A044C027B001C --no-bundler`. If Expo's connector stalls after a successful build, use `xcrun devicectl device install app` with the generated Release app.

- [ ] **Step 4: Launch and verify the installed iOS app**

Launch `com.drjiva.patient` using `xcrun devicectl`, then verify the installed bundle and running process.
