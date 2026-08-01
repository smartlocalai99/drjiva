# Dispatcher, Custom Medicines, and Order UX Design

## Goal

Complete the DRJIVA cash-on-delivery workflow as a two-application system:

1. The DRJIVA mobile app lets a patient manage reminders, add private custom tablets, place COD orders, hear a clear success confirmation, and track delivery progress.
2. The existing `medisin_app` PWA becomes the owner's private DRJIVA Order Dispatch console. The owner manually shares prepared order text to a rider WhatsApp group, records the selected rider, and advances delivery status.

Riders do not need a separate application or account. WhatsApp group coordination remains manual and does not add a third-party messaging service.

## Confirmed product decisions

- Orders remain cash on delivery with no payment integration.
- The PWA is operated by the owner/dispatcher, not hospital pharmacy staff and not riders.
- New orders may include full customer and order details in the owner's lock-screen notification, as previously requested.
- The owner shares a prepared message to the rider WhatsApp group and manually records the rider who accepts it.
- Rider name and phone are saved on the order.
- Reminder duration choices are `1` through `7` days plus `Everyday`.
- `Everyday` is open-ended and continues until the patient stops or deletes the reminder.
- Open-ended adherence streaks are grouped into seven-day weeks.
- No TestFlight submission is part of this release.
- The Android APK is built and installed directly on the connected Android phone when an ADB-visible device is available.

## Chosen approach

Use the existing mobile app and dispatcher PWA with Supabase as their shared durable system of record. This keeps one customer interface and one owner interface. A separate rider application would add identity, assignment, and installation work that the confirmed WhatsApp workflow does not need. Direct WhatsApp Business automation is also excluded: the PWA prepares and opens/shares the message, while the owner chooses the group and sends it.

## Order and dispatch workflow

### Order states

The delivery state machine is:

`placed -> shared -> assigned -> collected -> out_for_delivery -> delivered`

An order may be cancelled before delivery. Existing legacy states are migrated safely: `confirmed` becomes `shared`, and `preparing` becomes `collected`. Delivered and cancelled rows retain their terminal states.

### Customer experience

After an atomic order placement succeeds, checkout:

- Clears the cart only after the server confirms the order.
- Plays the bundled success sound and a success haptic.
- Presents a clear receipt with order number, COD total, address, and the message “Order placed — finding a rider.”
- Schedules a local receipt notification using the configured success sound on the Android notification channel.

The Shop header's current cart/bag action becomes Orders. Its badge represents active orders rather than cart quantity. The existing bottom checkout bar remains the cart entry point. The medicine detail page removes its redundant “Go to cart” button.

A new Orders screen lists active and previous orders for the signed-in anonymous owner session. Each order detail shows items, COD amount, delivery address, rider details once assigned, and the same status progression used by dispatch. Patient order reads are exposed only through owner-scoped RPCs that compare `auth.uid()` with `orders.owner_user_id`; direct public table reads remain denied.

The active-order badge refreshes on screen focus, app foreground, relevant Realtime events, and a conservative polling fallback. Failure to refresh the badge never blocks shopping or checkout.

### Dispatcher experience

The PWA is renamed DRJIVA Order Dispatch. It retains the existing high-entropy owner access code and installed-PWA notification subscription, but replaces hospital-staff language and preparation controls.

Each order provides:

- Customer name, phone, complete address, medicines, quantities, and COD total.
- Hospital pickup name, address, and phone.
- A hospital-to-customer Google Maps route.
- Copy Order and Share on WhatsApp actions using one consistently formatted dispatch message.
- A rider assignment sheet requiring rider name and phone.
- Actions matching the dispatch state machine.

The formatted WhatsApp message contains the order number, pickup location, customer details, items, COD amount, and route. On supported devices the Web Share API opens the share sheet; otherwise the message is copied and WhatsApp can be opened separately. Sharing never silently claims that WhatsApp accepted or delivered a message.

Order status transitions are validated in a PostgreSQL RPC. Rider assignment and the transition to `assigned` occur atomically so partially saved rider data cannot appear. The dispatcher may correct rider name/phone before collection. Terminal delivered orders mark COD payment as collected.

## Database changes

### Orders

Add nullable `rider_name`, `rider_phone`, and `assigned_at` fields. Replace the status constraint and transition rules with the dispatch states. Add owner-scoped patient order list/detail RPCs and update dispatcher RPC payloads to return rider information.

Existing order snapshots remain immutable for customer, hospital, item, and price data. Push failure remains independent of order durability.

### Private custom medicines

Create `patient_custom_medicines` with:

- UUID id, `owner_user_id`, patient id, and either verified or patient-custom hospital provenance.
- Display name, normalized name, private image path, and timestamps.
- A uniqueness rule scoped to the authenticated owner and hospital source.
- RLS that permits only the owning authenticated anonymous user to read or mutate the row.

Create a private `patient-medicine-images` Storage bucket. Object paths begin with `auth.uid()` and Storage policies enforce that prefix. The mobile app stores the object path and generates a signed URL when rendering; it does not make patient-added tablet images public.

`patient_medicine_courses` gains a nullable custom-medicine reference. Exactly one of catalogue medicine or custom medicine must be selected. Existing catalogue courses remain unchanged.

## Custom-tablet reminder flow

After the patient chooses a hospital, the medicine search step shows an Add New Tablet action when the desired medicine is absent. A sheet collects:

- Tablet name.
- Camera photo or photo-library image.
- The already-selected hospital association.

The image is compressed to a practical mobile size before upload. Creation is transactional from the user's perspective: if the database row fails after upload, the orphaned object is removed; if upload fails, no medicine row or course is created. The new tablet becomes selected immediately and proceeds through the existing dose setup.

## Finite and ongoing reminders

The free-text duration input becomes a dropdown with `1 day` through `7 days` and `Everyday`.

Courses gain an explicit schedule mode:

- `finite`: duration is an integer from one through seven.
- `ongoing`: duration/end date is null, the day pattern is daily, and the course remains active until `stopped_at` is set or the course is deleted.

For finite courses, the existing daily/alternate-day repeat choice remains. Selecting Everyday forces daily repetition and hides the alternate-day choice to avoid contradictory settings.

An ongoing course cannot create unlimited local notifications or database events at once. The app maintains a rolling notification/event horizon, replenished on course creation, app start, app foreground, and notification-settings changes. Replenishment is idempotent through unique course/slot/scheduled-time keys. Stopping or deleting the course cancels stored future notification identifiers and prevents further replenishment.

Finite courses keep their normal streak view. Ongoing courses group adherence into labelled seven-day weeks, with the current week first and earlier weeks available below. A day is complete only after all scheduled doses for that day are completed, matching existing adherence semantics.

## Android time selection and layout

Replace the current Android repeated-step time editor with a dedicated modal containing direct hour, minute, and AM/PM controls plus Cancel and Save. It must:

- Open with the current stored value.
- Permit exact minute selection without dozens of taps.
- Commit only on Save and leave the original value unchanged on Cancel.
- Use large touch targets, visible focus/selection state, and a readable 12-hour summary.
- Avoid the previously crashing imperative Android native picker path.

All changed screens receive a focused layout pass for narrow Android widths, keyboard avoidance, safe areas, long medicine/customer names, badge placement, and minimum touch targets. Unrelated screens are outside the redesign scope.

## Cart controls

Every cart/checkout/product quantity stepper uses the same visual pattern: `−  quantity  +`. Quantity one never changes to a trash icon. Pressing minus at one removes the line, preserving the existing cart behavior without displaying deletion imagery.

## Sound and notification behavior

The existing bundled success asset is used for immediate order confirmation and the Android order-receipt notification channel. Audio loading/unloading is guarded so checkout success cannot fail because sound playback fails. Notification permission denial does not change successful order placement; the visible receipt and haptic still occur.

Medicine reminder notifications keep their existing custom reminder sound. Dispatcher Web Push continues to use the PWA service worker and contains the full details previously approved.

## Error and recovery behavior

- Duplicate checkout requests return the existing order through the established client request id.
- Order-history or badge failures show retryable UI and never recreate an order.
- WhatsApp sharing failure leaves the order unchanged and offers Copy Order.
- Invalid status changes return the current server truth and refresh the PWA.
- A rider cannot be assigned without both a normalized name and phone.
- Custom image selection, compression, upload, row creation, and cleanup produce separate actionable errors.
- Ongoing-reminder replenishment can be safely retried without duplicate dose events or notifications.
- Android time changes are staged locally and are not persisted until Save.

## Testing and verification

Implementation follows test-first changes for:

- Dispatch transition rules, rider assignment, WhatsApp formatting, and presentation labels.
- Patient order list/detail mapping and active-order badge counts.
- Cart decrement-at-one behavior without trash presentation.
- Finite versus ongoing course validation, rolling horizon idempotency, stop/delete cleanup, and weekly streak grouping.
- Private custom-medicine normalization and image path rules.
- Android time-modal conversion, commit, and cancellation behavior.
- Checkout success side effects with sound/notification failure isolation.

Required release checks:

- Supabase migrations apply cleanly and RPC security is verified against correct/wrong users and access codes.
- A real test order is placed, appears in dispatch, receives a rider assignment, progresses through delivery, and appears in patient order history.
- Expo Vitest suite and TypeScript check pass.
- Next Jest suite, lint, and production build pass.
- Responsive PWA verification covers the dispatcher queue, WhatsApp fallback, assignment sheet, and status progression.
- Android verification covers custom-tablet image selection, duration dropdown, ongoing weekly streak, direct time selection, cart controls, order success sound, Orders badge/history, and checkout spacing.
- The dispatcher commit is pushed to `smartlocalai99/drjiva-riders` and Vercel production is redeployed.
- The mobile commit is pushed only after a mobile repository remote is supplied.
- An APK is built and installed directly when the target device is visible through ADB. No TestFlight action occurs.

## Non-goals

- Rider accounts, rider self-acceptance, or live rider GPS tracking.
- Automatic posting to a WhatsApp group or any WhatsApp Business API integration.
- Online payment or automatic COD settlement.
- Inventory reservation, hospital preparation workflows, or pharmacy staff accounts.
- Publishing to TestFlight, the App Store, or Google Play.
