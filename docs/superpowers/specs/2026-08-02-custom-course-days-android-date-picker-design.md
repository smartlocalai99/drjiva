# Custom Course Days and Android Start-Date Fix

## Scope

Dr Jiva will support finite medicine courses from 1 through 365 calendar days and retain `Everyday` as the open-ended option. Tapping the course start date must open a stable native date picker on Android without changing the current iOS experience.

## Duration experience

The duration sheet keeps the fast `1 day` through `7 days` choices. It adds a `Custom` choice that reveals a numeric input in the same sheet. The input accepts whole numbers from 1 through 365, shows a clear inline validation message for blank, decimal, zero, negative, or greater-than-365 values, and applies the value only after the user confirms it. `Everyday` remains a separate choice and continues until the reminder is stopped or deleted.

The selected custom duration is displayed everywhere through the existing duration label, course-end preview, confirmation screen, saved course, dose events, and reminder scheduling flow. A finite custom value remains finite; it is never converted to `Everyday`.

## Data and validation

`CourseDuration` will represent any validated finite integer rather than the current 1–7 union. Shared validation will enforce the 1–365 limit so the picker, submit flow, event generator, and database agree. A Supabase migration will replace the current finite-course check constraint with the 1–365 range while preserving the existing rules for ongoing courses.

Finite courses continue to use the current event-generation path. Existing dashboard streak presentation stays capped to its current compact display and is not expanded into a 365-day strip.

## Android date picker

Android will continue using the library's recommended imperative API, but it will use the standard system picker instead of `design: "material"`. The current app theme does not inherit from the Material 3 theme required by that picker design, which can cause a native crash before JavaScript can handle an error. Material-only options (`title` and `initialInputMode`) will be removed from the Android invocation. The picker retains the current selected value and minimum/maximum dates. iOS keeps the inline picker unchanged.

## Error handling

The duration sheet will not close or change the saved duration when custom input is invalid. Submission retains a final shared validation guard. Android picker opening will use only options supported by the default design, avoiding the native theme failure rather than attempting to catch a process-level crash.

## Verification

Automated tests will first demonstrate failure for finite values above 7 and then verify acceptance through 365 and rejection outside the range. Component-level tests will cover custom-input parsing and the Android picker option builder so the incompatible Material design cannot regress. Existing schedule, calendar, repository, and type checks must continue to pass.

After automated verification, the Android app will be built and installed on the connected device when available. The manual acceptance flow is: open Add Medicine, choose `Custom`, save a value above 7, confirm the correct course-end date, tap Course start date without a crash, select another date, and save the reminder.
