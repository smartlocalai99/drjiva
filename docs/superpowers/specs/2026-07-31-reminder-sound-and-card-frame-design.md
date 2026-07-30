# Reminder Sound and Card Frame Fix

## Goal

Make scheduled medicine reminders play the bundled custom `reminder.caf`
sound on the connected iPhone, and change only the empty left/right background
around the medicine image on the Reminders screen to `#D6D6D6`.

## Root Cause

The production reminder workflow schedules notifications through
`expo-notifications`. The dynamic Expo config currently checks for
`assets/sounds/medicine-reminder.wav`, which does not exist, so the runtime
configuration tells that scheduler to use the phone's `default` sound. The
actual `assets/sounds/reminder.caf` file is valid, is listed in the
`expo-notifications` config plugin, and is present in the generated iOS
project.

The recently added Notifee scheduling helpers are not called by the medicine
workflow. Only their permission request runs, so they cannot change the sound
of existing medicine notifications.

## Design

Use `expo-notifications` as the single notification implementation:

- Make the dynamic app config reference `assets/sounds/reminder.caf` and expose
  `reminder.caf` as the runtime medicine reminder sound.
- Keep the existing dated medicine-event scheduling, cancellation, stored
  notification identifiers, message text, and foreground behavior.
- Remove the unused Notifee-only scheduler and its startup permission request
  to avoid two notification libraries owning the same permission and schedule.
- Keep the existing custom sound in the Expo config plugin so iOS embeds it
  during the native rebuild.
- Rebuild and reinstall the native app because bundled notification sounds are
  build-time configuration and cannot be delivered by a JavaScript-only update.

On the Reminders screen, change only the medicine image container background
from `#D9D9D9` to `#D6D6D6`. The colored information section, calendar, spacing,
card borders, and medicine image sizing remain unchanged.

## Verification

- Add a configuration regression test proving the resolved Expo config exposes
  `reminder.caf` and retains the sound plugin entry.
- Add or extend notification scheduling tests to prove scheduled content uses
  the configured custom sound rather than `default`.
- Run targeted tests, the full test suite, TypeScript type checking, and Expo
  Doctor.
- Inspect the resolved Expo config and generated iOS project for
  `reminder.caf`.
- Build and install the app on the connected iPhone.
- Schedule a near-future notification on the phone and confirm the notification
  request names `reminder.caf`; final audible confirmation must be observed on
  the physical phone with notification sounds enabled and the phone not muted.

## Reference

Expo SDK 57 requires a custom sound file to be listed in the
`expo-notifications` config plugin and the filename, including its extension,
to be supplied in notification content. Native rebuilding is required for
config-plugin changes:
https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
