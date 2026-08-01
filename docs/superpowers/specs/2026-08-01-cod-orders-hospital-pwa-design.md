# COD Orders and Hospital PWA Design

## Goal

Turn the existing DRJIVA medicine cart into a working cash-on-delivery order flow and rebuild `/Users/vardhanreddy/Desktop/medislash/medisin_app` as a single-purpose hospital order console that can be installed as a PWA and receive background Web Push notifications.

## Confirmed product decisions

- All orders are cash on delivery. There is no payment gateway or app-store purchase flow.
- Orders are fulfilled by `ASIAN MULTI SPECIALITY HOSPITALS`, which is already the source of the mobile shop catalogue.
- The hospital PWA is dedicated to incoming orders; the old patient, medicine, dispense, report, and hospital-management screens are not part of its navigation.
- A push notification may contain the customer's name, phone, complete delivery address, medicine summary, and total. The hospital device owner accepts the lock-screen privacy exposure this creates.
- The installed PWA must still show orders that arrived while notifications were disabled or the device was offline.
- The exact rebuild target is `medisin_app`; `medisin_tablet_app` is untouched.

## Architecture

Supabase is the durable system of record. The mobile app calls one atomic PostgreSQL RPC to validate the authenticated anonymous session, canonical medicine prices, quantities, hospital, patient, and delivery address before inserting an `orders` row and its `order_items`. The mobile client never supplies trusted totals.

The hospital PWA reads and updates orders through access-code-protected security-definer RPCs. A small non-sensitive `order_events` table is published through Supabase Realtime so the open dashboard can refresh immediately without exposing order details through public RLS policies. The PWA also polls periodically and fetches the current queue on startup, making Realtime an acceleration rather than the sole delivery mechanism.

After an order insert, a database trigger makes an asynchronous `pg_net` request to a Supabase Edge Function. The function validates a database-held webhook secret, atomically claims the pending notification, loads registered push subscriptions, and sends an encrypted standards-based Web Push message using VAPID. Invalid/expired subscriptions are removed. The order remains visible even if push delivery fails.

## Database model

### `orders`

Each row stores:

- UUID primary key and a human-readable identity number displayed as `ORD-####`.
- `owner_user_id`, `patient_id`, and `hospital_id` provenance.
- `client_request_id` with a unique owner constraint for idempotent retries.
- COD payment method and `pending`/`collected` payment state.
- Order state: `placed`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, or `cancelled`.
- Canonical subtotal, zero delivery fee for this version, total, and INR currency.
- Customer name and phone snapshot.
- Structured delivery address fields plus a formatted address snapshot.
- Hospital name, address, and phone snapshot.
- Creation/update timestamps and notification claim/send timestamps.

### `order_items`

Each item snapshots the medicine id, name, image URL, category/pack display text, canonical unit price, quantity, and line total. Historical orders therefore remain accurate if catalogue data changes later.

### `order_push_subscriptions`

Stores the browser endpoint and encrypted Web Push keys for every enabled hospital device. Endpoint uniqueness makes subscription registration idempotent.

### `order_events`

Contains only event id, order id, event type, and timestamp. It does not contain customer or medicine details. Anonymous clients can subscribe to this table; protected RPC access is still required to fetch the order.

### `order_dashboard_config`

Stores only a SHA-256 digest of a high-entropy hospital access code and the public VAPID key. The plaintext access code and VAPID private key are not committed.

## Mobile checkout

The checkout resolves the current patient, requires a saved address and non-empty cart, and generates a request UUID once per placement attempt. It calls `place_cod_order` with product ids/quantities and the address snapshot. The database:

1. Resolves the Asian hospital and canonical medicines.
2. Uses the catalogue price when it is positive and otherwise the shop's existing ₹49 fallback, while rejecting invalid quantities, mismatched catalogue rows, and malformed addresses.
3. Calculates all money values using database numeric types.
4. Inserts the order and items within one transaction.
5. Returns the order id, number, total, status, and creation time.

The button is disabled while submitting. A safe retry with the same request id returns the original order. The cart is cleared only after confirmed success. The success state shows the order number, COD total, delivery address, and a route back to the shop.

## Hospital PWA

The first screen asks for the hospital access code and stores it only on that installed device. The order console then provides:

- New-order count and notification status.
- Filter tabs for active, delivered, cancelled, and all orders.
- A dense, touch-friendly order queue with order number, time, customer, total, items, and status.
- A detail sheet/page containing full customer, delivery, item, COD, and hospital pickup information.
- One-tap status progression plus cancellation.
- A Google Maps directions link with the hospital address as origin and customer address as destination.
- A hospital pickup settings panel, because the current live Asian hospital row has an empty address and phone. Orders cannot be reliably routed until staff saves the real pickup details.
- Clear iOS instructions to add the app to the Home Screen before enabling Web Push, plus standard install/notification controls on supporting browsers.

Visual direction: a calm clinical operations console rather than a generic admin template. Ink `#13231D`, hospital green `#176B4D`, urgent amber `#E58B2A`, alert red `#B64635`, paper `#F3F6F2`, and white surfaces. IBM Plex Sans handles readable operational copy and IBM Plex Mono handles order ids, times, and rupee totals. A vertical status rail is the signature element, making each order's progress visible at a glance.

## Access and privacy

Direct table access to orders, items, subscriptions, and dashboard configuration is denied to public clients. Mobile creation is available only through the atomic RPC to an authenticated Supabase user. Staff reads, subscription writes, pickup updates, and status changes require the high-entropy access code and constrained RPCs.

The access code is intentionally lighter than per-staff accounts but still prevents a public production URL from exposing patient information. It can be rotated in the database. Full lock-screen contents are an explicit user choice; operating-system notification previews can still be hidden by device settings.

## Error and recovery behavior

- Invalid cart/catalogue mismatches stop placement and tell the patient which item needs review; a missing catalogue price uses the same ₹49 fallback already displayed by the shop.
- Duplicate taps/network retries return the already-created order.
- Push failure never rolls back an order; it remains in the PWA queue and can be retried.
- The PWA performs startup fetch, Realtime-triggered refresh, focus refresh, and periodic refresh.
- Expired Web Push endpoints are removed after `404`/`410` responses.
- Unsupported browsers keep the complete dashboard but show notification setup guidance.
- Status RPCs enforce valid transitions and return the current server row after concurrent changes.

## Verification and release

- Database migration is applied to the linked Supabase project and checked with direct RPC calls.
- Mobile order helpers and cart clearing are built test-first with Vitest; the Expo TypeScript check and full test suite must pass.
- PWA order formatting, status transitions, access handling, and push payloads are built test-first with Jest; lint, tests, and the Next production build must pass.
- Browser verification covers access-code unlock, responsive queue/detail views, pickup settings, notification enrollment UI, order refresh, and status updates.
- The Supabase Edge Function is deployed with server-only VAPID secrets and invoked by a real inserted test order after at least one browser subscription exists.
- The PWA is deployed over HTTPS. A Vercel production deployment requires valid Vercel account authentication; otherwise a claimable live deployment is produced and the remaining account claim is reported.
- Each repository is pushed only when it has a configured Git remote. A missing remote is reported with the exact command/input needed rather than inventing a destination.

## Non-goals

- Online payment collection.
- Inventory reservation or stock decrementing.
- Delivery-driver assignment/tracking.
- Prescription validation or controlled-drug eligibility automation.
- Multiple fulfillment hospitals in the first release.
