# Reminder Sound and Card Frame Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scheduled medicine reminders play the bundled custom sound on the connected iPhone and make only the image-side frame on reminder cards `#D6D6D6`.

**Architecture:** Keep `expo-notifications` as the single owner of medicine notification permissions, scheduling, and cancellation. Resolve the same `reminder.caf` filename through native plugin configuration and runtime notification content, remove the unused Notifee path, and preserve all existing medicine-event data flow.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, `expo-notifications`, Vitest, TypeScript, Xcode iOS device tooling.

## Global Constraints

- Read and follow Expo SDK 57 notifications documentation: `https://docs.expo.dev/versions/v57.0.0/sdk/notifications/`.
- The custom sound filename is exactly `reminder.caf`.
- The reminder card image-frame background is exactly `#D6D6D6`.
- The colored reminder details body, calendar, card geometry, stored event identifiers, scheduling dates, cancellation behavior, and notification copy remain unchanged.
- Native rebuilding and reinstalling are required because notification sound assets are build-time configuration.
- No subagents are used; the user approved inline execution.

---

### Task 1: Align Expo Native and Runtime Sound Configuration

**Files:**
- Create: `app.config.test.mjs`
- Modify: `app.config.js:1-90`
- Modify: `assets/sounds/README.md:1-6`

**Interfaces:**
- Consumes: Expo config object from `app.json` and `assets/sounds/reminder.caf`.
- Produces: resolved `extra.medicineReminderSound === "reminder.caf"` and an `expo-notifications` plugin entry containing `./assets/sounds/reminder.caf`.

- [ ] **Step 1: Write the failing config-resolution test**

```js
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const appJson = require('./app.json');
const createConfig = require('./app.config.js');

describe('app config medicine reminder sound', () => {
  it('exposes the bundled reminder.caf sound to the notification scheduler', () => {
    const config = createConfig({ config: appJson.expo });
    const notificationsPlugin = config.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    );

    expect(config.extra.medicineReminderSound).toBe('reminder.caf');
    expect(notificationsPlugin[1].sounds).toContain(
      './assets/sounds/reminder.caf',
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the existing wrong filename fails**

Run: `npx vitest run app.config.test.mjs`

Expected: FAIL because `config.extra.medicineReminderSound` is currently `false`.

- [ ] **Step 3: Make the config use the real sound**

In `app.config.js`, replace the nonexistent WAV constants with:

```js
const MEDICINE_REMINDER_SOUND_PATH = './assets/sounds/reminder.caf';
const MEDICINE_REMINDER_SOUND_FILE = 'reminder.caf';
```

Update `assets/sounds/README.md` to name `reminder.caf`, describe it as the
bundled custom reminder sound, retain the 30-second limit, and state that a
native rebuild is required after replacement.

- [ ] **Step 4: Run the config test**

Run: `npx vitest run app.config.test.mjs`

Expected: PASS with one test.

- [ ] **Step 5: Commit the aligned config**

```bash
git add app.config.test.mjs app.config.js assets/sounds/README.md
git commit -m "fix: configure bundled medicine reminder sound"
```

### Task 2: Prove Scheduled Medicine Notifications Use the Custom Sound

**Files:**
- Modify: `src/lib/medicineNotifications.test.ts:1-60`
- Verify: `src/lib/medicineNotifications.ts:25-150`

**Interfaces:**
- Consumes: `Constants.expoConfig.extra.medicineReminderSound`.
- Produces: an Expo `NotificationRequestInput` whose `content.sound` is `reminder.caf`.

- [ ] **Step 1: Add a failing scheduler-boundary test**

Hoist a `requireExpoNotifications` test double, configure the Expo constants
mock with `medicineReminderSound: 'reminder.caf'`, import
`scheduleDoseNotifications`, and add:

```ts
it('places the configured custom sound in scheduled notification content', async () => {
  const scheduledRequests: unknown[] = [];
  requireExpoNotifications.mockResolvedValue({
    scheduleNotificationAsync: async (request: unknown) => {
      scheduledRequests.push(request);
      return 'notification-custom-sound';
    },
  });

  await scheduleDoseNotifications(
    [{
      eventId: 'event-custom-sound',
      scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    }],
    {
      medicineName: 'Dolo 650',
      slot: 'Morning',
      slotKey: 'morning',
      tablets: 1,
    },
  );

  expect(scheduledRequests).toHaveLength(1);
  expect(scheduledRequests[0]).toMatchObject({
    content: { sound: 'reminder.caf' },
  });
});
```

- [ ] **Step 2: Verify the test fails against the prior runtime config**

Temporarily keep the constants mock at `medicineReminderSound: false`, run:
`npx vitest run src/lib/medicineNotifications.test.ts`

Expected: FAIL because scheduled content contains `sound: "default"`.

- [ ] **Step 3: Set the test runtime config to the resolved custom filename**

Change the constants mock to:

```ts
medicineReminderSound: 'reminder.caf',
```

Keep production scheduling code unchanged because it already forwards a valid
runtime filename into `content.sound`.

- [ ] **Step 4: Run the notification tests**

Run: `npx vitest run src/lib/medicineNotifications.test.ts`

Expected: PASS for partial-failure cleanup and custom-sound scheduling.

- [ ] **Step 5: Commit the scheduler regression coverage**

```bash
git add src/lib/medicineNotifications.test.ts
git commit -m "test: cover custom medicine notification sound"
```

### Task 3: Remove the Unused Duplicate Notification Owner

**Files:**
- Modify: `app/_layout.tsx:1-75`
- Delete: `src/lib/reminderNotifications.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the existing `expo-notifications` handler and medicine notification permission flow.
- Produces: one native notification library and no unused startup Notifee permission request.

- [ ] **Step 1: Capture the clean baseline**

Run:
`npx vitest run src/lib/expoNotifications.test.ts src/lib/medicineNotifications.test.ts`

Expected: PASS before dependency removal.

- [ ] **Step 2: Remove the dead Notifee startup path**

Delete the `requestNotificationPermissions` import and its dedicated
`useEffect` call from `app/_layout.tsx`. Delete
`src/lib/reminderNotifications.ts`, whose scheduling exports have no callers.

- [ ] **Step 3: Remove the unused native dependency**

Run: `npm uninstall @notifee/react-native`

Expected: `package.json` and `package-lock.json` no longer contain
`@notifee/react-native`.

- [ ] **Step 4: Verify tests and types**

Run:
`npx vitest run src/lib/expoNotifications.test.ts src/lib/medicineNotifications.test.ts && npm run typecheck`

Expected: both test files pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the single-scheduler cleanup**

```bash
git add app/_layout.tsx package.json package-lock.json
git add -u src/lib/reminderNotifications.ts
git commit -m "fix: use one medicine notification scheduler"
```

### Task 4: Change Only the Reminder Image Frame Color

**Files:**
- Modify: `app/reminders.tsx:400-408`

**Interfaces:**
- Consumes: `ReminderCard` image-frame style.
- Produces: `imageWrap.backgroundColor === "#D6D6D6"` while `cardBody` retains its dose-slot tint.

- [ ] **Step 1: Change the visual constant**

In the `imageWrap` style, change:

```ts
backgroundColor: '#D9D9D9',
```

to:

```ts
backgroundColor: '#D6D6D6',
```

- [ ] **Step 2: Verify the change is isolated**

Run:
`git diff -- app/reminders.tsx`

Expected: the only reminder-screen change is the image-frame hex value.

- [ ] **Step 3: Run TypeScript validation**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 4: Commit the card frame**

```bash
git add app/reminders.tsx
git commit -m "style: adjust reminder image frame gray"
```

### Task 5: Full Verification, Native Rebuild, and Phone Installation

**Files:**
- Verify: `app.config.js`
- Verify: `app/reminders.tsx`
- Verify: `ios/DrJiva/reminder.caf`
- Verify: generated iOS app bundle

**Interfaces:**
- Consumes: all changes from Tasks 1-4 and connected device identifier `1CC30A7C-CEE1-58F6-B061-3FA5756D98F0`.
- Produces: signed DrJiva native app installed and launched on Vardhan's iPhone.

- [ ] **Step 1: Run all automated verification**

Run:

```bash
npm test
npm run typecheck
npx expo-doctor
npx expo config --type public
```

Expected: tests, type checking, and Expo Doctor pass; resolved config shows
`medicineReminderSound: "reminder.caf"` and the matching plugin sound path.

- [ ] **Step 2: Regenerate iOS native configuration**

Run: `npx expo prebuild --platform ios`

Expected: `ios/DrJiva/reminder.caf` exists and is listed in the Xcode project's
Resources build phase.

- [ ] **Step 3: Build, sign, install, and launch on the connected iPhone**

Run:

```bash
npx expo run:ios \
  --device 1CC30A7C-CEE1-58F6-B061-3FA5756D98F0 \
  --configuration Release \
  --no-bundler
```

Expected: Xcode build succeeds, `com.drjiva.patient` installs, and DrJiva
launches on Vardhan's iPhone.

- [ ] **Step 4: Inspect the built application**

Resolve the newest `DrJiva.app` under Xcode DerivedData and inspect it:

```bash
DRJIVA_APP_BUNDLE_PATH="$(
  find /Users/vardhanreddy/Library/Developer/Xcode/DerivedData \
    -type d -path '*/Build/Products/Release-iphoneos/DrJiva.app' \
    -print -quit
)"
test -n "$DRJIVA_APP_BUNDLE_PATH"
find "$DRJIVA_APP_BUNDLE_PATH" -maxdepth 1 -name reminder.caf -print
```

Expected: one `reminder.caf` path inside the signed app bundle.

- [ ] **Step 5: Verify device installation**

Run:

```bash
xcrun devicectl device info apps \
  --device 1CC30A7C-CEE1-58F6-B061-3FA5756D98F0
```

Expected: output includes bundle identifier `com.drjiva.patient`.

- [ ] **Step 6: Review the final diff and repository state**

Run:

```bash
git diff --check
git status --short
git log -6 --oneline
```

Expected: no uncommitted implementation changes and commits for config,
coverage, scheduler cleanup, and reminder frame styling.

- [ ] **Step 7: Push the verified commits**

Run:

```bash
git remote -v
git push
```

Expected: the configured upstream accepts the new commits without force.

- [ ] **Step 8: Confirm the audible device behavior**

On the installed app, create or resave a medicine reminder for a near-future
time. With iPhone Settings → Notifications → DrJiva → Sounds enabled and the
mute switch off, wait for delivery and confirm the bundled spoken
`reminder.caf` plays instead of the normal notification sound.
