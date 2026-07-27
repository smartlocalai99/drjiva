# Documents, Profile, Addresses, and Cached Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver consistent document actions, local-first saved addresses, useful support details, blue verified badges, and instant cached-name rendering on Home.

**Architecture:** Pure address rules live separately from AsyncStorage access so validation and default-selection behavior are testable without React Native. New Expo Router screens consume that storage boundary. Session storage gains a phone-scoped name cache that screens read immediately and refresh from Supabase in the background.

**Tech Stack:** Expo SDK 57.0.8, React Native 0.86, React 19.2.3, Expo Router 57.0.8, AsyncStorage 2.2.0, TypeScript 6, Vitest, Ionicons.

## Global Constraints

- Use only Expo SDK 57-compatible APIs and import navigation from `expo-router`.
- Preserve unrelated existing work in the dirty working tree.
- Do not add a Supabase address migration or real document upload.
- Store addresses locally under a versioned, phone-scoped AsyncStorage key.
- Use `support@smartlocalai.in` for patient support.
- Keep the existing DrJiva colors, typography, cards, safe areas, and press feedback.

---

### Task 1: Test Harness and Address Domain Rules

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/addresses.ts`
- Create: `src/lib/addresses.test.ts`

**Interfaces:**
- Produces: `AddressLabel`, `SavedAddress`, `AddressDraft`, `AddressErrors`
- Produces: `validateAddress(draft: AddressDraft): AddressErrors`
- Produces: `normalizeAddress(draft: AddressDraft, id: string): SavedAddress`
- Produces: `upsertAddress(addresses: SavedAddress[], next: SavedAddress): SavedAddress[]`
- Produces: `removeAddress(addresses: SavedAddress[], id: string): SavedAddress[]`
- Produces: `setDefaultAddress(addresses: SavedAddress[], id: string): SavedAddress[]`
- Produces: `parseStoredAddresses(value: string | null): SavedAddress[]`

- [ ] **Step 1: Install the test runner**

Run: `npm install --save-dev vitest`

Expected: `package.json` contains a compatible `vitest` dev dependency and the lockfile updates without peer-dependency errors.

- [ ] **Step 2: Add the test script**

Add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write failing address-rule tests**

Cover these exact cases:

```ts
it('requires recipient, phone, building, area, city, state, and six-digit PIN', () => {
  expect(validateAddress(emptyDraft)).toEqual({
    area: 'Enter street or area',
    building: 'Enter house, flat, or building',
    city: 'Enter city',
    phone: 'Enter a valid 10-digit phone number',
    pinCode: 'Enter a valid 6-digit PIN code',
    recipientName: 'Enter recipient name',
    state: 'Enter state',
  });
});

it('makes the first address default and preserves one default', () => {
  const first = normalizeAddress(homeDraft, 'a1');
  const second = normalizeAddress(workDraft, 'a2');
  expect(upsertAddress([], first)[0]?.isDefault).toBe(true);
  expect(upsertAddress([first], second).filter((item) => item.isDefault)).toHaveLength(1);
});

it('promotes the next address when the default is deleted', () => {
  expect(removeAddress([defaultHome, work], defaultHome.id)[0]?.isDefault).toBe(true);
});

it('returns an empty list for malformed persisted data', () => {
  expect(parseStoredAddresses('{bad json')).toEqual([]);
});
```

- [ ] **Step 4: Run tests to verify RED**

Run: `npm test -- src/lib/addresses.test.ts`

Expected: FAIL because `src/lib/addresses.ts` and its exports do not exist.

- [ ] **Step 5: Implement minimal pure address rules**

Define the model with:

```ts
export type AddressLabel = 'Home' | 'Work' | 'Other';

export type SavedAddress = {
  id: string;
  label: AddressLabel;
  customLabel: string;
  recipientName: string;
  phone: string;
  building: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
};
```

Trim text fields, reduce phone to the last ten digits, validate exact phone/PIN lengths, keep default addresses first, preserve the existing default during ordinary upserts, and promote the first remaining entry when the default is deleted.

- [ ] **Step 6: Run tests to verify GREEN**

Run: `npm test -- src/lib/addresses.test.ts`

Expected: all address-rule tests PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/addresses.ts src/lib/addresses.test.ts
git commit -m "feat: add saved address domain rules"
```

### Task 2: Address Persistence

**Files:**
- Create: `src/lib/addressStorage.ts`
- Create: `src/lib/addressStorage.test.ts`

**Interfaces:**
- Consumes: `SavedAddress`, `parseStoredAddresses`
- Produces: `getAddressStorageKey(phone: string): string`
- Produces: `loadAddresses(phone: string): Promise<SavedAddress[]>`
- Produces: `saveAddresses(phone: string, addresses: SavedAddress[]): Promise<void>`

- [ ] **Step 1: Write failing persistence tests**

Mock AsyncStorage only at the storage boundary and assert:

```ts
expect(getAddressStorageKey('(987) 654-3210')).toBe(
  'drjiva.addresses.v1.9876543210',
);
```

Also verify `loadAddresses` parses valid arrays, converts malformed JSON to `[]`, and `saveAddresses` writes JSON to the phone-scoped key.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/lib/addressStorage.test.ts`

Expected: FAIL because `addressStorage.ts` does not exist.

- [ ] **Step 3: Implement AsyncStorage access**

Use:

```ts
const ADDRESS_KEY_PREFIX = 'drjiva.addresses.v1';

export function getAddressStorageKey(phone: string) {
  return `${ADDRESS_KEY_PREFIX}.${phone.replace(/\D/g, '').slice(-10)}`;
}
```

Read with `AsyncStorage.getItem`, parse with `parseStoredAddresses`, and write with `AsyncStorage.setItem`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/lib/addressStorage.test.ts`

Expected: all persistence tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/addressStorage.ts src/lib/addressStorage.test.ts
git commit -m "feat: persist saved addresses locally"
```

### Task 3: Cached Patient Name

**Files:**
- Modify: `src/lib/session.ts`
- Create: `src/lib/session.test.ts`
- Modify: `app/add-patient-details.tsx`
- Modify: `app/home.tsx`
- Modify: `app/more.tsx`
- Modify: `app/profile.tsx`

**Interfaces:**
- Produces: `getCachedPatientName(phone: string): Promise<string | null>`
- Produces: `saveCachedPatientName(phone: string, name: string): Promise<void>`
- Produces: `clearCachedPatientName(phone: string): Promise<void>`

- [ ] **Step 1: Write failing session-cache tests**

Assert the phone-scoped key, trimmed name write, blank-name removal, and read:

```ts
await saveCachedPatientName('98765 43210', '  Vardhan Reddy  ');
expect(AsyncStorage.setItem).toHaveBeenCalledWith(
  'drjiva.patient-name.v1.9876543210',
  'Vardhan Reddy',
);
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/lib/session.test.ts`

Expected: FAIL because cached-name exports do not exist.

- [ ] **Step 3: Implement cached-name storage**

Keep the existing session-phone functions and add the three phone-scoped cache functions. Update `clearSessionPhone` to read the current session phone, remove the phone and cached name together, and leave phone-scoped saved addresses intact.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/lib/session.test.ts`

Expected: all session tests PASS.

- [ ] **Step 5: Wire cache writes and reads**

- In onboarding, retain the `Patient` returned by `createPatient`, cache `patient.name`, then navigate.
- In Home, read `getCachedPatientName(phone)` immediately and independently call `getPatientByPhone`; keep cached text on server failure and cache the fresh server name on success.
- In More and Profile, seed visible name from cache before the full patient request resolves.
- After a successful profile update, cache the returned patient's name.

- [ ] **Step 6: Verify type safety and tests**

Run: `npm test -- src/lib/session.test.ts && npm run typecheck`

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts app/add-patient-details.tsx app/home.tsx app/more.tsx app/profile.tsx
git commit -m "feat: render patient name from local cache"
```

### Task 4: Saved Addresses List Screen

**Files:**
- Create: `app/saved-addresses.tsx`
- Modify: `app/more.tsx`

**Interfaces:**
- Consumes: `loadAddresses`, `saveAddresses`, `removeAddress`, `setDefaultAddress`
- Navigates to: `/address-editor?phone=...` and `/address-editor?phone=...&addressId=...`

- [ ] **Step 1: Add the More-row navigation**

Place `Saved Addresses` immediately after `Manage Profile`, using `location-outline`, and route with:

```ts
router.push({ params: { phone }, pathname: '/saved-addresses' });
```

- [ ] **Step 2: Build the list screen**

Create a safe-area screen with centered header title, back button, loading indicator, empty state, and address cards. Use `useFocusEffect(useCallback(...))` so the list reloads whenever the editor returns.

Each card must show:

```text
[Home icon] Home      DEFAULT
Recipient Name · +91 9876543210
Building, Area, Landmark
City, State - 500001
Set as default       Edit  Delete
```

Hide "Set as default" on the default card. Confirm before deletion.

- [ ] **Step 3: Add the bottom action**

Use `FloatingAddButton` with label `Add Address` and safe-area bottom offset:

```ts
const bottomOffset = insets.bottom + dashboardSpacing.gap;
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`

Expected: TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/more.tsx app/saved-addresses.tsx
git commit -m "feat: add saved addresses list"
```

### Task 5: Address Add/Edit Form

**Files:**
- Create: `app/address-editor.tsx`

**Interfaces:**
- Consumes: `AddressDraft`, `validateAddress`, `normalizeAddress`, `upsertAddress`
- Consumes: `loadAddresses`, `saveAddresses`
- Accepts query: `phone`, optional `addressId`

- [ ] **Step 1: Build add/edit initialization**

Load the address list by phone. When `addressId` exists, populate the matching address; otherwise initialize:

```ts
{
  label: 'Home',
  customLabel: '',
  recipientName: '',
  phone,
  building: '',
  area: '',
  landmark: '',
  city: '',
  state: '',
  pinCode: '',
}
```

- [ ] **Step 2: Build the form**

Use `KeyboardAvoidingView`, `ScrollView`, labeled `TextInput` fields, and Home/Work/Other chips. Show the custom-label input only for Other. Use phone and numeric keyboard types for phone and PIN.

- [ ] **Step 3: Add validation and save**

On save, call `validateAddress`, show each returned string beneath its field, and focus/scroll to the first invalid section. For valid input:

```ts
const id = addressId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const next = normalizeAddress(draft, id);
await saveAddresses(phone, upsertAddress(addresses, next));
router.back();
```

Disable double submission and show an alert if storage write fails.

- [ ] **Step 4: Verify**

Run: `npm test -- src/lib/addresses.test.ts src/lib/addressStorage.test.ts && npm run typecheck`

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/address-editor.tsx
git commit -m "feat: add address editor"
```

### Task 6: Support Screen and Verified Badge

**Files:**
- Create: `src/components/VerifiedBadge.tsx`
- Create: `app/support.tsx`
- Modify: `app/more.tsx`
- Modify: `app/profile.tsx`

**Interfaces:**
- Produces: `VerifiedBadge({ size?: number })`
- Support email: `support@smartlocalai.in`

- [ ] **Step 1: Add a native blue verified badge**

Render `Ionicons` `checkmark-circle` with primary blue plus a small four-point badge silhouette behind it, or use the closest filled native badge glyph available in the installed icon set. The resulting component must be filled blue, accessible, and visually comparable to `RiVerifiedBadgeFill` without importing `react-icons`.

- [ ] **Step 2: Replace both phone checks**

Use `<VerifiedBadge size={17} />` in More and Profile beside the verified phone.

- [ ] **Step 3: Replace Help Center navigation**

Change the More row label to `Support`, use `headset-outline`, and navigate to `/support`.

- [ ] **Step 4: Build Support**

Show DrJiva, `We're here to help with your DrJiva experience.`, email, app version, and an "Email Support" button. Launch:

```ts
const url = 'mailto:support@smartlocalai.in?subject=DrJiva%20Support';
if (await Linking.canOpenURL(url)) await Linking.openURL(url);
else Alert.alert('Contact support', 'Email us at support@smartlocalai.in');
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`

Expected: TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/VerifiedBadge.tsx app/support.tsx app/more.tsx app/profile.tsx
git commit -m "feat: add profile support experience"
```

### Task 7: Documents Floating Action

**Files:**
- Modify: `app/documents.tsx`

**Interfaces:**
- Consumes: existing `FloatingAddButton`

- [ ] **Step 1: Remove top and inline actions**

Remove the header `add-circle-outline` pressable, replace it with a fixed-size spacer, remove `onAdd` from `EmptyDocuments`, and delete the inline `addPill`.

- [ ] **Step 2: Always render the floating action**

Replace the conditional render with:

```tsx
<FloatingAddButton
  bottomOffset={addButtonBottomOffset}
  icon="cloud-upload-outline"
  label={t('addDocument')}
  onPress={handleAddDocument}
/>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`

Expected: TypeScript exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/documents.tsx
git commit -m "fix: align document action with medicine action"
```

### Task 8: Full Verification and Mobile Release

**Files:**
- Modify only files required by verification findings.

**Interfaces:**
- Consumes: all completed feature tasks

- [ ] **Step 1: Run automated verification**

Run:

```bash
npm test
npm run typecheck
npx expo install --check
npx expo export --platform web
```

Expected: tests have zero failures, TypeScript exits 0, Expo reports compatible dependencies, and web export exits 0.

- [ ] **Step 2: Inspect the app**

Start Expo web, then use the in-app browser to inspect Home, Documents, More, Profile, Saved Addresses empty/list states, address add/edit, and Support at a mobile viewport. Confirm safe-area spacing, keyboard reachability, floating-action placement, back navigation, readable cards, verified badge color, and immediate cached-name rendering.

- [ ] **Step 3: Review the feature diff**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -10
```

Expected: no whitespace errors and only intended feature files are included in feature commits.

- [ ] **Step 4: Publish the mobile update**

Confirm Expo login with `npx eas-cli whoami`, then publish to the installed build's channel using:

```bash
npx eas-cli update --channel preview --message "Add saved addresses and profile improvements"
```

If the user's installed build uses `production`, publish to `production` instead. Record the update group URL and runtime version.

- [ ] **Step 5: Push Git if a remote is available**

Run `git remote -v`. If a remote exists, run `git push <remote> main`. If none exists, report that a remote URL is required and do not invent one.
