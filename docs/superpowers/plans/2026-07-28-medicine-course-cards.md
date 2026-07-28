# Medicine Course Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render compact dashboard medicine cards using real Medico medicine images and stable demo course metadata.

**Architecture:** A focused data module fetches image-backed medicine rows and maps them into the existing dashboard `Medicine` model. The dashboard loads asynchronously and the card component owns only presentation.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, Supabase JS 2.110.8, Expo Image, Vitest.

## Global Constraints

- Medicine images must come only from `public.medicines.image_url`.
- Demo course metadata must not be inserted into Supabase.
- Preserve the existing empty state and completion control.
- Use TDD for every new mapping and validation function.

---

### Task 1: Medicine row mapping

**Files:**
- Modify: `src/data/medicines.ts`
- Create: `src/data/medicines.test.ts`

**Interfaces:**
- Consumes: Supabase rows shaped as `{ id, name, image_url, hospital_name }`.
- Produces: `fetchMedicinesForDate(date: Date): Promise<Medicine[]>`,
  `mapMedicineRows(rows: MedicineRow[]): Medicine[]`, and
  `getHospitalInitials(name: string): string`.

- [ ] **Step 1: Write failing tests**

Test that rows without `image_url` are removed, a row maps its database image
and hospital name, demo metadata is stable for the same id, and
`"SHANKAR GASTRO HOSPITAL"` produces `"SG"`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/data/medicines.test.ts`

Expected: FAIL because the asynchronous fetch and mapping exports do not exist.

- [ ] **Step 3: Implement the mapper and Supabase query**

Select `id,name,image_url,hospital_name` from `medicines`, reject empty image
URLs, derive stable demo values from a deterministic id hash, and return no
more than three cards.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/data/medicines.test.ts`

Expected: all medicine data tests pass.

- [ ] **Step 5: Commit**

Run:
`git add src/data/medicines.ts src/data/medicines.test.ts && git commit -m "feat: load dashboard medicines from medico"`

### Task 2: Compact card UI and dashboard loading

**Files:**
- Modify: `src/components/dashboard/MedicineCard.tsx`
- Modify: `app/home.tsx`

**Interfaces:**
- Consumes: `Medicine` including `imageUrl`, `tabletCount`,
  `hospitalName`, and `doctorName`.
- Produces: edge-to-edge compact card rendering and asynchronous refresh.

- [ ] **Step 1: Add the new fields to the mapper test**

Assert the mapped model contains a database `imageUrl`, tablet label, doctor
name, and hospital name.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/data/medicines.test.ts`

Expected: FAIL because the fields are absent from the current `Medicine` type.

- [ ] **Step 3: Implement the compact presentation**

Use `expo-image` with `contentFit="cover"`, a compact name band, and a
three-column strip for tablet count, hospital initials, and doctor. Change
`app/home.tsx` to load and refresh with `fetchMedicinesForDate`.

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck`

Expected: all tests and TypeScript checks pass.

- [ ] **Step 5: Commit**

Run:
`git add app/home.tsx src/components/dashboard/MedicineCard.tsx src/data/medicines.ts src/data/medicines.test.ts && git commit -m "feat: add compact medicine course cards"`

