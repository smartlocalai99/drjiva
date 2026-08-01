# COD Orders and Hospital PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DRJIVA medicine checkout create durable COD orders and turn `medisin_app` into an installable hospital order console with live/background notifications.

**Architecture:** A security-definer Supabase RPC validates and atomically snapshots each order from canonical catalogue data. The PWA uses an access-code-protected RPC boundary plus a non-sensitive Realtime event stream; a database trigger and Supabase Edge Function deliver Web Push independently of the open dashboard.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / TypeScript / Vitest, Supabase PostgreSQL 17 / RLS / RPC / Realtime / Edge Functions, Next.js 16 Pages Router / React 19 / Jest / Web Push / PWA, Vercel.

## Global Constraints

- All payments are `cod`; no payment provider or in-app purchase code.
- Fulfillment is restricted to `ASIAN MULTI SPECIALITY HOSPITALS`.
- Client-submitted prices and totals are never trusted; the database uses a positive catalogue price or the shop's existing ₹49 fallback.
- Order creation is idempotent by `(owner_user_id, client_request_id)`.
- `medisin_tablet_app` is untouched.
- Full customer/order details are allowed in hospital-device push notifications by explicit user choice.
- Private VAPID material and plaintext access credentials are never committed.
- Preserve the existing DRJIVA `MedicineCard.tsx` working-tree change.

---

### Task 1: Preserve prior web-app work and add the order backend

**Files:**
- Create: `supabase/migrations/20260801090000_add_cod_orders_and_hospital_console.sql`
- Create: `supabase/functions/notify-new-order/index.ts`
- Create: `scripts/verify-order-backend.mjs`

**Interfaces:**
- Produces: `place_cod_order(p_patient_id uuid, p_client_request_id uuid, p_address jsonb, p_items jsonb) -> jsonb`.
- Produces: `verify_order_dashboard_access(text)`, `list_hospital_orders(text,text)`, `get_hospital_order(text,uuid)`, `update_hospital_order_status(text,uuid,text)`, `update_order_pickup_location(text,text,text)`, and push-subscription RPCs.
- Produces: tables `orders`, `order_items`, `order_events`, `order_push_subscriptions`, `order_dashboard_config`.

- [x] Preserve all pre-existing tracked and untracked `medisin_app` changes in its original checkout; implement in the isolated `feat/order-console-pwa` worktree so no stash can hide or disturb them.
- [ ] Create `scripts/verify-order-backend.mjs` to authenticate anonymously, resolve an existing patient/medicine, call `place_cod_order` with a fixed request UUID twice, assert both calls return one order id, assert database pricing, then cancel/delete the test order through a test-cleanup RPC available only to the service role.
- [ ] Run the verifier and record the expected RED failure that `place_cod_order` does not exist.
- [ ] Add the migration with constrained tables, indexes, RLS, grants, access-code hash `2a4281c21b53e6b3b7d1baadab47bdaf5486178ce21574029b9068b591dd237c`, valid status transitions, canonical price calculation, idempotency, order-event triggers, Realtime publication membership, Vault webhook secret creation, and asynchronous `pg_net` trigger.
- [ ] Add the Edge Function that validates the Vault-backed secret via RPC, claims one notification, builds a full-detail payload, sends it with `npm:web-push`, removes `404`/`410` subscriptions, and marks the attempt.
- [ ] Run `npx supabase db lint --linked`, `npx supabase db push --dry-run`, apply with `npx supabase db push`, deploy the function with `--no-verify-jwt`, and rerun the verifier GREEN.
- [ ] Query the live tables/RPCs through the public key to confirm direct order reads fail while protected RPC reads require the correct access code.

### Task 2: Add tested mobile order placement helpers

**Files:**
- Create: `src/lib/orders.test.ts`
- Create: `src/lib/orders.ts`

**Interfaces:**
- Consumes: `ensureSecureReportSession()`, `supabase.rpc()`, `SavedAddress`, and cart product ids/quantities.
- Produces: `placeCodOrder(input): Promise<PlacedOrder>` and deterministic address/item RPC payload builders.

- [ ] Write failing Vitest cases proving whitespace is trimmed, phone/PIN are normalized, empty lines are removed, quantity bounds are rejected, the existing request id reaches the RPC, and Supabase errors become user-safe order errors.
- [ ] Run `npm test -- src/lib/orders.test.ts` and confirm RED because the module does not exist.
- [ ] Implement the smallest typed helper that ensures an authenticated anonymous session, maps the saved address/cart, calls `place_cod_order`, and validates the returned order shape.
- [ ] Run the focused tests GREEN, then run the full Expo test suite.

### Task 3: Make checkout submit safely and clear only a completed cart

**Files:**
- Modify: `src/lib/cart.tsx`
- Create or modify: `src/lib/cart.test.tsx`
- Modify: `app/checkout.tsx`

**Interfaces:**
- Produces: `clear(): void` on `CartContextValue`.
- Consumes: `placeCodOrder` from Task 2.

- [ ] Write a failing cart-provider test showing `clear()` removes quantities and product snapshots.
- [ ] Run the focused test RED, add the minimal `clear` callback, and rerun GREEN.
- [ ] Add checkout submission state, one generated request id per attempt, disabled/double-tap-safe action, COD wording, actionable database errors, and a successful-order receipt state.
- [ ] Clear the cart only after the RPC returns a valid order; retain it on all failures.
- [ ] Run Expo tests and `npm run typecheck`.

### Task 4: Replace the web-app data layer test-first

**Files:**
- Create: `lib/orders.js`
- Create: `lib/orderPresentation.js`
- Create: `lib/__tests__/orders.test.js`
- Create: `lib/__tests__/orderPresentation.test.js`
- Modify: `utils/supabaseClient.js`

**Interfaces:**
- Produces: `verifyAccessCode`, `listOrders`, `getOrder`, `updateOrderStatus`, `savePickupLocation`, `registerPushSubscription`, `removePushSubscription`, and `subscribeToOrderEvents`.
- Produces: `formatOrderNumber`, `formatRupees`, `formatAddress`, `buildDirectionsUrl`, `buildNotificationBody`, and `nextOrderActions`.

- [ ] Write failing Jest cases for RPC names/arguments, error propagation, status-action ordering, INR formatting, complete address formatting, encoded Google Maps origin/destination, and full-detail notification copy.
- [ ] Run the focused Jest files RED because the modules do not exist.
- [ ] Implement thin Supabase adapters and pure presentation functions with no server secrets.
- [ ] Rerun focused tests GREEN and then all Jest tests.

### Task 5: Build the single-purpose responsive order console

**Files:**
- Replace: `pages/index.js`
- Replace: `pages/_app.js`
- Modify: `pages/_document.js`
- Replace: `styles/globals.css`
- Create: `components/orders/AccessGate.js`
- Create: `components/orders/OrderConsole.js`
- Create: `components/orders/OrderQueue.js`
- Create: `components/orders/OrderDetail.js`
- Create: `components/orders/NotificationSetup.js`
- Create: `components/orders/PickupSettings.js`

**Interfaces:**
- Consumes: Task 4 data/presentation functions.
- Produces: an access-gated dashboard with startup fetch, 15-second polling, focus refresh, Realtime event refresh, active/history filters, detail view, status changes, pickup configuration, and notification enrollment.

- [ ] Implement an access gate that verifies the high-entropy code before retaining it in versioned local storage.
- [ ] Implement the mobile-first queue/detail flow with the approved clinical palette, operational typography, vertical status rail, keyboard focus, and reduced-motion support.
- [ ] Add explicit empty, loading, offline/error, and stale-refresh states.
- [ ] Add pickup-address editing and disable directions until a real hospital origin is configured.
- [ ] Add installation guidance for iOS and a notification-permission control that never requests permission until the user taps it.
- [ ] Remove/redirect obsolete product routes so the deployed app is only the order console while leaving database migration history intact.
- [ ] Run Jest and lint.

### Task 6: Add installable PWA and browser push assets

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Create: `public/badge-96.png`
- Modify: `next.config.mjs`

**Interfaces:**
- Service worker consumes JSON `{title, body, icon, badge, tag, data:{url,orderId}}`.
- Service worker opens/focuses `/?order=<uuid>` on notification click.

- [ ] Add a standalone manifest using the DRJIVA hospital order-console identity and theme colors.
- [ ] Generate correctly sized PNG assets from the existing approved logo without changing its visual design.
- [ ] Add a no-cache service worker with push, notification click, same-origin URL validation, and client focus/open behavior.
- [ ] Add Next security and service-worker headers following the installed Next 16 PWA documentation.
- [ ] Validate manifest/icon dimensions and run a production build.

### Task 7: Configure VAPID and verify the full notification path

**Files:**
- Modify: the live Supabase Edge Function secrets only; no private-key file.
- Modify: `order_dashboard_config.vapid_public_key` in the linked database.

**Interfaces:**
- Produces: a standards-based VAPID key pair; only the public key is readable by the PWA.

- [ ] Generate a new VAPID pair without printing/committing the private key.
- [ ] Set `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` using `supabase secrets set`.
- [ ] Save only the public key in dashboard config and redeploy `notify-new-order`.
- [ ] Start the PWA over HTTPS, unlock it, enable notifications, and verify a subscription row is stored.
- [ ] Create a real test COD order and confirm the installed browser receives the full-detail notification and opens the matching order.
- [ ] Remove the test order/subscription if it was created solely for verification.

### Task 8: Visual and behavioral QA

**Files:**
- Modify only files implicated by observed defects.

- [ ] Run the Next dev server and inspect desktop and phone-sized layouts in the in-app browser.
- [ ] Verify access gate, install guidance, notification state, queue filters, detail panel, map directions, pickup settings, status transitions, offline recovery, and order deep linking.
- [ ] Capture screenshots, critique against the approved visual direction, and make one restrained refinement pass.
- [ ] Run fresh Expo tests/typecheck and Next tests/lint/build after the refinement.

### Task 9: Deploy, commit, and push

**Files:**
- Update: `.env.local.example` in `medisin_app` only if a public build variable remains necessary.
- Update: both repositories' documentation with setup/deployment notes and credential rotation commands.

**Interfaces:**
- Produces: an HTTPS PWA URL and two clean, verified commits.

- [ ] Deploy `medisin_app` to Vercel production if valid credentials are available; otherwise create the claimable live deployment and report the required account-claim step.
- [ ] Do not fetch the Vercel URL through shell after deployment, per deployment-skill guidance; use the browser flow only if further UI verification is required before the deploy command.
- [ ] Update the Edge Function notification click URL/config if the final origin differs from the tested origin.
- [ ] Review `git diff`, ensure no `.env`/private key/access code is tracked, and verify the pre-existing Expo `MedicineCard.tsx` edit remains intact.
- [ ] Run final verification commands immediately before committing.
- [ ] Commit the Expo/database changes and the rebuilt PWA separately with scoped messages.
- [ ] Push each repository only if its exact Git remote exists; otherwise report that no remote is configured and request the repository URL.
