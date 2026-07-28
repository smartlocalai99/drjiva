# Profile Photo and Calendar Today Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public Supabase-backed patient profile photos, remove Address from Manage Profile, and render today's dashboard date on the existing streak icon.

**Architecture:** A versioned SQL migration owns the `patients.avatar_url` column, public Storage bucket, and insert-only upload policy. A focused profile-photo library validates and uploads Expo Image Picker assets, while the profile screen coordinates camera/gallery selection, preview, upload, and patient persistence. The calendar uses a pure marker-selection helper so today's streak treatment is independently testable.

**Tech Stack:** Expo SDK 57, Expo Router, React Native, `expo-image-picker ~57.0.6`, `expo-image`, Supabase JS 2.110.8, Supabase Postgres/Storage, TypeScript 6, Vitest 4.

## Global Constraints

- Follow the exact Expo SDK 57 ImagePicker API documented at `https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/`.
- Camera and Gallery must both be offered, with square cropping.
- Accept only JPEG or PNG images up to 5 MB.
- Store objects in the public `profile-pictures` bucket under `<patient-id>/<timestamp>-<random-suffix>.<extension>`.
- Never overwrite profile objects and do not grant anonymous update or delete permissions.
- Remove only the Address field from Manage Profile; preserve Saved Addresses.
- Today uses `assets/streaks.png` with the numeric date centered over it.
- A selected non-today date keeps the existing orange gradient treatment.
- Adding `expo-image-picker` requires a new native mobile build; an OTA update alone is insufficient for an older binary.

---

### Task 1: Supabase profile-photo schema and storage

**Files:**
- Create: `supabase/migrations/20260728000000_add_patient_profile_photos.sql`

**Interfaces:**
- Consumes: existing `public.patients(id)` records and Supabase Storage schema.
- Produces: nullable `public.patients.avatar_url text`, public bucket `profile-pictures`, and insert-only client upload policy.

- [ ] **Step 1: Write the migration**

```sql
alter table public.patients
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Client can create versioned profile pictures"
  on storage.objects;

create policy "Client can create versioned profile pictures"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'profile-pictures'
  and array_length(storage.foldername(name), 1) = 1
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png')
);
```

- [ ] **Step 2: Inspect the generated SQL before applying it**

Run: `sed -n '1,220p' supabase/migrations/20260728000000_add_patient_profile_photos.sql`

Expected: only the nullable patient column, bucket upsert, and insert policy are present; there is no update/delete policy.

- [ ] **Step 3: Apply the linked-project migration**

Run: `npx supabase@latest db push --include-all`

Expected: the linked project accepts `20260728000000_add_patient_profile_photos.sql`.

- [ ] **Step 4: Verify the remote migration list**

Run: `npx supabase@latest migration list`

Expected: `20260728000000` appears in both local and remote columns.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260728000000_add_patient_profile_photos.sql
git commit -m "feat: add profile photo storage"
```

### Task 2: Image-picker dependency and upload library

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Create: `src/lib/profilePhotos.ts`
- Create: `src/lib/profilePhotos.test.ts`

**Interfaces:**
- Consumes: `ImagePicker.ImagePickerAsset` and the shared Supabase client.
- Produces: `validateProfilePhoto(asset): string | null` and `uploadProfilePhoto(patientId, asset): Promise<string>`.

- [ ] **Step 1: Install the SDK-matched native dependency**

Run: `npx expo install expo-image-picker`

Expected: `expo-image-picker` resolves to the SDK 57-compatible `~57.0.6` range.

- [ ] **Step 2: Configure permission copy**

Add this plugin entry to `app.json`:

```json
[
  "expo-image-picker",
  {
    "photosPermission": "Allow DrJiva to choose your profile photo.",
    "cameraPermission": "Allow DrJiva to take your profile photo.",
    "microphonePermission": false
  }
]
```

- [ ] **Step 3: Write failing validation/path tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildProfilePhotoPath,
  validateProfilePhoto,
} from './profilePhotos';

describe('profile photos', () => {
  it('accepts JPEG and PNG files up to 5 MB', () => {
    expect(validateProfilePhoto({ fileSize: 5 * 1024 * 1024, mimeType: 'image/jpeg' })).toBeNull();
    expect(validateProfilePhoto({ fileSize: 1200, mimeType: 'image/png' })).toBeNull();
  });

  it('rejects oversized and unsupported files', () => {
    expect(validateProfilePhoto({ fileSize: 5 * 1024 * 1024 + 1, mimeType: 'image/jpeg' })).toMatch(/5 MB/);
    expect(validateProfilePhoto({ fileSize: 1200, mimeType: 'image/heic' })).toMatch(/JPEG or PNG/);
  });

  it('builds a unique object path below the patient folder', () => {
    expect(buildProfilePhotoPath('patient-1', 'image/png', 1234, 'abc')).toBe('patient-1/1234-abc.png');
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- src/lib/profilePhotos.test.ts`

Expected: FAIL because `profilePhotos.ts` does not exist.

- [ ] **Step 5: Implement validation, versioned paths, and upload**

Implement:

```ts
export const PROFILE_PHOTO_BUCKET = 'profile-pictures';
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateProfilePhoto(
  asset: Pick<ImagePicker.ImagePickerAsset, 'fileSize' | 'mimeType'>,
): string | null;

export function buildProfilePhotoPath(
  patientId: string,
  mimeType: string,
  timestamp?: number,
  randomSuffix?: string,
): string;

export async function uploadProfilePhoto(
  patientId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string>;
```

`uploadProfilePhoto` must validate first, fetch the local URI as an `ArrayBuffer`, upload with `{ contentType, upsert: false }`, and return `supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl`.

- [ ] **Step 6: Run focused tests and type checking**

Run: `npm test -- src/lib/profilePhotos.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json src/lib/profilePhotos.ts src/lib/profilePhotos.test.ts
git commit -m "feat: add profile photo picker support"
```

### Task 3: Patient avatar persistence

**Files:**
- Modify: `src/lib/patients.ts`
- Create: `src/lib/patients.test.ts`

**Interfaces:**
- Consumes: `patients.avatar_url`.
- Produces: `Patient.avatarUrl: string | null` and optional `PatientProfileUpdate.avatar_url`.

- [ ] **Step 1: Write failing patient mapping tests with a mocked Supabase query**

Cover a returned `avatar_url` mapping to `avatarUrl`, and verify `updatePatientProfile` sends the supplied `avatar_url` while no longer requiring an `address` property.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/patients.test.ts`

Expected: FAIL because `Patient` lacks `avatarUrl` and the update still requires `address`.

- [ ] **Step 3: Update the patient contract**

Use:

```ts
export type Patient = {
  patientId: string;
  name: string;
  phoneNumber: string;
  age: number | null;
  gender: string | null;
  address: string | null;
  avatarUrl: string | null;
};

export type PatientProfileUpdate = {
  name: string;
  age: number | null;
  gender: string | null;
  avatar_url?: string | null;
};
```

Include `avatar_url` in full and core selects, map it to `avatarUrl`, and remove the profile-update address fallback while preserving address reads for Saved Addresses compatibility.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm test -- src/lib/patients.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/patients.ts src/lib/patients.test.ts
git commit -m "feat: persist patient avatar urls"
```

### Task 4: Manage Profile photo UI

**Files:**
- Modify: `app/profile.tsx`

**Interfaces:**
- Consumes: `Patient.avatarUrl`, `uploadProfilePhoto`, and Expo ImagePicker camera/gallery APIs.
- Produces: camera/gallery selection, square preview, and save-time upload/persistence.

- [ ] **Step 1: Remove Address only from Manage Profile**

Delete `address` form state, loading assignment, save payload property, Address input markup, its preceding divider, and `addressInput` style. Do not change `app/more.tsx`, `app/saved-addresses.tsx`, or address persistence helpers.

- [ ] **Step 2: Add photo selection state and source actions**

Track:

```ts
const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
const [pendingPhoto, setPendingPhoto] =
  useState<ImagePicker.ImagePickerAsset | null>(null);
```

Load `patient.avatarUrl`. Tapping the avatar opens an alert with Camera, Gallery, and Cancel. Request the matching permission before launching:

```ts
await ImagePicker.launchCameraAsync({
  allowsEditing: true,
  aspect: [1, 1],
  mediaTypes: ['images'],
  quality: 0.85,
});
```

Use the equivalent `launchImageLibraryAsync` options for Gallery. Validate the returned asset and show a clear alert for permission or validation failures.

- [ ] **Step 3: Render photo preview with initials fallback**

Render `pendingPhoto?.uri ?? avatarUrl` using `expo-image`. Keep initials when neither exists. Wrap the avatar in an accessible button and add a small camera/edit badge.

- [ ] **Step 4: Upload before updating the patient record**

If `pendingPhoto` exists, call `uploadProfilePhoto(patient.patientId, pendingPhoto)`, then pass the returned URL as `avatar_url` to `updatePatientProfile`. On success, set `avatarUrl`, clear `pendingPhoto`, and preserve the existing Saved indicator. On failure, retain the pending preview and show the existing retry message.

- [ ] **Step 5: Verify the screen compiles**

Run: `npm run typecheck`

Expected: PASS with no Address references in `app/profile.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/profile.tsx
git commit -m "feat: add profile photo editing"
```

### Task 5: Dashboard streak marker

**Files:**
- Create: `src/lib/dateMarker.ts`
- Create: `src/lib/dateMarker.test.ts`
- Modify: `src/components/dashboard/DateTimeline.tsx`

**Interfaces:**
- Consumes: `isToday` and `isSelected`.
- Produces: `getDateMarker(isToday, isSelected): 'today-streak' | 'selected-gradient' | 'plain'`.

- [ ] **Step 1: Write the failing marker test**

```ts
import { describe, expect, it } from 'vitest';
import { getDateMarker } from './dateMarker';

describe('date marker', () => {
  it('prioritizes the today streak over selected styling', () => {
    expect(getDateMarker(true, true)).toBe('today-streak');
    expect(getDateMarker(true, false)).toBe('today-streak');
    expect(getDateMarker(false, true)).toBe('selected-gradient');
    expect(getDateMarker(false, false)).toBe('plain');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/dateMarker.test.ts`

Expected: FAIL because `dateMarker.ts` does not exist.

- [ ] **Step 3: Implement the pure marker selection**

```ts
export type DateMarker = 'today-streak' | 'selected-gradient' | 'plain';

export function getDateMarker(
  isToday: boolean,
  isSelected: boolean,
): DateMarker {
  if (isToday) return 'today-streak';
  if (isSelected) return 'selected-gradient';
  return 'plain';
}
```

- [ ] **Step 4: Render the streak as today's marker**

In `DateSlot`, use the helper. For `today-streak`, render `assets/streaks.png` sized to the date circle behind the numeric date. Do not render the orange gradient or bottom dot for today. Use white centered date text with a subtle shadow. Keep the orange gradient and dot only for `selected-gradient`.

- [ ] **Step 5: Run focused tests and type checking**

Run: `npm test -- src/lib/dateMarker.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dateMarker.ts src/lib/dateMarker.test.ts src/components/dashboard/DateTimeline.tsx
git commit -m "feat: show today on the streak icon"
```

### Task 6: Full verification and mobile delivery

**Files:**
- Modify only if verification exposes a defect in the files above.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified repository state, pushed commits, and a native Android build suitable for installation.

- [ ] **Step 1: Run the full automated checks**

Run: `npm test && npm run typecheck && npx expo-doctor`

Expected: all tests pass, TypeScript reports no errors, and Expo Doctor reports no blocking SDK compatibility issue.

- [ ] **Step 2: Verify configuration generation**

Run: `npx expo config --type public`

Expected: the ImagePicker plugin is present and Android/iOS identifiers are unchanged.

- [ ] **Step 3: Inspect the final diff and repository state**

Run: `git diff HEAD~5 --check && git status --short && git log --oneline -8`

Expected: no whitespace errors and no unintended files.

- [ ] **Step 4: Push the committed code**

Run: `git push`

Expected: the current branch is updated on its configured remote.

- [ ] **Step 5: Start a new installable Android build**

Run: `npx eas-cli@latest build --platform android --profile preview --non-interactive`

Expected: EAS accepts the build and returns a build URL. This native build is required because `expo-image-picker` was added.

- [ ] **Step 6: Report the build link and migration verification**

Provide the installable Android build URL, pushed commit, automated check results, and confirmation that migration `20260728000000` is remote.
