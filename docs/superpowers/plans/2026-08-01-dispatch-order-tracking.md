# Dispatch and Patient Order Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the hospital console into the owner's WhatsApp-assisted dispatch PWA and add secure patient order tracking, order badges, consistent cart controls, and audible order confirmation to the DRJIVA mobile app.

**Architecture:** Supabase remains the authoritative state machine and protects both dispatcher and patient views with constrained RPCs. The Next PWA formats and shares dispatch messages, records rider assignment, and updates delivery state; the Expo app displays owner-scoped order history and treats audio/local-notification confirmation as non-critical side effects after the order transaction succeeds.

**Tech Stack:** PostgreSQL/Supabase migrations and RPCs, Supabase Realtime and Edge Functions, Next.js 16.2/React 19 PWA, Expo SDK 57/React Native 0.86/Expo Router, Vitest, Jest, Web Share API, expo-audio, expo-notifications.

## Global Constraints

- Read the exact Expo SDK 57 documentation at `https://docs.expo.dev/versions/v57.0.0/` before writing Expo code.
- Orders remain cash on delivery; no payment integration is added.
- Riders have no application or login; the owner manually shares to WhatsApp and updates status.
- Full lock-screen order details remain enabled because the user explicitly requested them.
- Direct public reads of order/customer data remain denied.
- Do not submit to TestFlight, App Store, or Google Play.
- Preserve unrelated user changes in both repository roots.

---

### Task 1: Dispatch state machine and patient-order RPCs

**Files:**
- Create: `supabase/migrations/20260801150000_add_dispatch_and_patient_order_tracking.sql`
- Modify: `scripts/verify-order-backend.mjs`

**Interfaces:**
- Produces: `assign_order_rider(text, uuid, text, text) -> jsonb`
- Produces: `update_hospital_order_status(text, uuid, text) -> jsonb` with dispatch transitions
- Produces: `list_patient_orders(uuid) -> jsonb` and `get_patient_order(uuid, uuid) -> jsonb`
- Produces: order JSON fields `riderName`, `riderPhone`, and `assignedAt`

- [ ] **Step 1: Extend the live verifier with dispatch assertions before adding the migration**

```js
const assigned = await supabase.rpc('assign_order_rider', {
  p_access_code: dashboardAccessCode,
  p_order_id: first.data.id,
  p_rider_name: 'Test Rider',
  p_rider_phone: '9000000000',
});
assert.equal(assigned.error, null, assigned.error?.message);
assert.equal(assigned.data.status, 'assigned');
assert.equal(assigned.data.riderName, 'Test Rider');

const patientOrders = await supabase.rpc('list_patient_orders', {
  p_patient_id: patient.id,
});
assert.equal(patientOrders.error, null, patientOrders.error?.message);
assert.ok(patientOrders.data.some((order) => order.id === first.data.id));
```

Before assignment, transition the test order to `shared` with
`update_hospital_order_status`; assignment from `placed` must be rejected.

- [ ] **Step 2: Run the verifier to confirm the new RPC is missing**

Run: `set -a; source .env.local; test -n "$ORDER_DASHBOARD_ACCESS_CODE" && node scripts/verify-order-backend.mjs`

Expected: FAIL with `Could not find the function public.assign_order_rider`.

- [ ] **Step 3: Add the migration**

The migration must:

```sql
alter table public.orders
  add column rider_name text,
  add column rider_phone text,
  add column assigned_at timestamptz;

-- Allowed forward states:
-- placed -> shared -> assigned -> collected -> out_for_delivery -> delivered
-- placed/shared/assigned/collected/out_for_delivery -> cancelled
```

Normalize rider phone to the last ten digits, reject blank rider names/invalid phones, migrate `confirmed` to `shared` and `preparing` to `collected`, replace the status constraint, update order JSON construction, and make assignment plus status change one transaction. Patient RPCs must require `auth.uid() = orders.owner_user_id` and the requested patient id.

- [ ] **Step 4: Apply the migration and rerun security/integration verification**

Run: `npx supabase db push`

Run: `set -a; source .env.local; test -n "$ORDER_DASHBOARD_ACCESS_CODE" && node scripts/verify-order-backend.mjs`

Expected: one idempotent test order progresses through dispatch and is cancelled; wrong-owner patient reads and wrong dashboard codes return `42501`.

- [ ] **Step 5: Commit the database slice**

```bash
git add supabase/migrations/20260801150000_add_dispatch_and_patient_order_tracking.sql scripts/verify-order-backend.mjs
git commit -m "feat: add order dispatch state machine"
```

### Task 2: Dispatcher domain functions

**Files:**
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/lib/orderPresentation.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/lib/orders.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/lib/__tests__/orderPresentation.test.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/lib/__tests__/orders.test.js`

**Interfaces:**
- Produces: `buildDispatchMessage(order): string`
- Produces: `assignRider(accessCode, orderId, { name, phone }): Promise<Order>`
- Consumes: dispatch RPCs from Task 1

- [ ] **Step 1: Write failing formatting, transition, and rider RPC tests**

```js
expect(buildDispatchMessage(order)).toContain('Pickup: ASIAN MULTI SPECIALITY HOSPITALS');
expect(buildDispatchMessage(order)).toContain('COD: ₹147');
expect(nextOrderActions('assigned')).toContainEqual({
  label: 'Medicine collected', status: 'collected', tone: 'primary',
});
await assignRider('code', 'order-1', { name: 'Ravi', phone: '9876543210' });
expect(supabase.rpc).toHaveBeenCalledWith('assign_order_rider', expect.any(Object));
```

- [ ] **Step 2: Run focused Jest tests and confirm failures**

Run: `npm test -- --runInBand lib/__tests__/orderPresentation.test.js lib/__tests__/orders.test.js`

Expected: FAIL for missing dispatch formatter/assignment and legacy labels.

- [ ] **Step 3: Implement pure formatting and RPC adapters**

Use the exact state labels `New`, `Shared with riders`, `Rider assigned`, `Medicine collected`, `Out for delivery`, `Delivered`, and `Cancelled`. Keep Web Share orchestration in the component; the pure formatter returns the complete message and is independently testable.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --runInBand lib/__tests__/orderPresentation.test.js lib/__tests__/orders.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the dispatcher domain slice**

```bash
git add lib/orderPresentation.js lib/orders.js lib/__tests__/orderPresentation.test.js lib/__tests__/orders.test.js
git commit -m "feat: add rider dispatch order actions"
```

### Task 3: Dispatcher PWA redesign

**Files:**
- Create: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/RiderAssignment.js`
- Create: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/DispatchShare.js`
- Create: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/__tests__/RiderAssignment.test.js`
- Create: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/__tests__/DispatchShare.test.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/AccessGate.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/OrderConsole.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/OrderDetail.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/OrderQueue.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/components/orders/PickupSettings.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/pages/_document.js`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/public/manifest.webmanifest`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/styles/globals.css`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/README.md`

**Interfaces:**
- Consumes: Task 2 formatters and RPC adapters
- Produces: owner-only dispatch UI with WhatsApp sharing and rider assignment

- [ ] **Step 1: Add component tests for share fallback and assignment validation**

Use the existing Jest transform plus `react-dom/server` to verify the assignment form's required fields and action labels. Test the share controller with injected `share` and `copy` adapters: Web Share is used when present, clipboard fallback is used otherwise, and cancelled shares do not advance state.

- [ ] **Step 2: Run Jest and confirm the new component tests fail**

Run: `npm test -- --runInBand`

Expected: FAIL because the two components do not exist.

- [ ] **Step 3: Implement the dispatch-focused interface**

Replace all hospital-staff language with owner dispatch language. Place Share/Copy and Assign Rider before collection actions. Show saved rider details, preserve pickup settings, use the new progress states, update page title/manifest name to `DRJIVA Order Dispatch`, and keep keyboard/focus/error behavior accessible on mobile PWA widths.

- [ ] **Step 4: Run PWA checks**

Run: `npm test -- --runInBand && npm run lint && npm run build`

Expected: all tests pass, lint has zero warnings, and Next production build succeeds.

- [ ] **Step 5: Commit the PWA redesign**

```bash
git add components/orders pages/_document.js public/manifest.webmanifest styles/globals.css README.md
git commit -m "feat: redesign console for rider dispatch"
```

### Task 4: Patient order client and Orders screens

**Files:**
- Create: `src/lib/patientOrders.ts`
- Create: `src/lib/patientOrders.test.ts`
- Create: `app/orders.tsx`
- Create: `app/order/[id].tsx`
- Modify: `app/shop.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `listPatientOrders(patientId): Promise<PatientOrder[]>`
- Produces: `getPatientOrder(patientId, orderId): Promise<PatientOrder>`
- Produces: `countActiveOrders(orders): number`
- Consumes: patient-order RPCs from Task 1

- [ ] **Step 1: Write failing mapping and active-count tests**

```ts
expect(countActiveOrders([
  { status: 'placed' }, { status: 'assigned' }, { status: 'delivered' },
] as PatientOrder[])).toBe(2);
expect(mapPatientOrder(serverRow).riderName).toBe('Ravi');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run src/lib/patientOrders.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the patient order adapter and routes**

The list screen separates active and previous orders. Detail displays receipt, rider data when assigned, address, items, COD, and a seven-state timeline. Both screens handle loading, empty, retry, and missing order states. Shop resolves the patient from `phone`, refreshes active count on focus/foreground/Realtime, routes its top icon to `/orders`, and shows a badge only when count is positive. The active-state set is exactly `placed`, `shared`, `assigned`, `collected`, and `out_for_delivery`.

- [ ] **Step 4: Run mobile tests and typecheck**

Run: `npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit patient order tracking**

```bash
git add src/lib/patientOrders.ts src/lib/patientOrders.test.ts app/orders.tsx app/order app/shop.tsx app/_layout.tsx
git commit -m "feat: add patient order tracking"
```

### Task 5: Cart controls and checkout confirmation

**Files:**
- Create: `src/lib/orderConfirmation.ts`
- Create: `src/lib/orderConfirmation.test.ts`
- Modify: `app/checkout.tsx`
- Modify: `app/cart.tsx`
- Modify: `app/medicine/[id].tsx`
- Modify: `src/components/shop/product-quantity-control.tsx`
- Modify: `src/lib/cart.test.tsx`
- Modify: `app.config.js`
- Test: `app.config.test.mjs`

**Interfaces:**
- Produces: `confirmPlacedOrder(order): Promise<void>` that isolates sound/haptic/local-notification failures
- Consumes: existing `success.wav`, expo-audio, expo-haptics, and expo-notifications

- [ ] **Step 1: Write failing confirmation and cart presentation tests**

Assert that confirmation attempts audio, haptic, and notification independently; one rejected effect must not prevent the others. Assert quantity one renders a minus icon and decrement removes the item.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run src/lib/orderConfirmation.test.ts src/lib/cart.test.tsx app.config.test.mjs`

Expected: FAIL for the missing confirmation helper and inconsistent quantity-one presentation.

- [ ] **Step 3: Implement confirmation and consistent controls**

Call `confirmPlacedOrder` only after `placeCodOrder` resolves and before/alongside the visible receipt without awaiting it as part of transaction success. Change receipt copy to `Order placed — finding a rider.` Register the Android receipt channel with the bundled success sound. Remove the medicine-detail Go to cart action and use minus at quantity one everywhere.

- [ ] **Step 4: Run the full Expo checks**

Run: `npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the checkout UX slice**

```bash
git add app/checkout.tsx app/cart.tsx 'app/medicine/[id].tsx' src/components/shop/product-quantity-control.tsx src/lib/orderConfirmation.ts src/lib/orderConfirmation.test.ts src/lib/cart.test.tsx app.config.js app.config.test.mjs
git commit -m "feat: polish cart and order confirmation"
```

### Task 6: End-to-end order release

**Files:**
- Modify: `scripts/verify-order-backend.mjs`
- Modify: `/Users/vardhanreddy/Desktop/medislash/medisin_app/.worktrees/order-console/README.md`

**Interfaces:**
- Consumes: all prior dispatch/order tasks
- Produces: verified GitHub and Vercel production release

- [ ] **Step 1: Run a real complete order lifecycle**

Create one idempotent COD test order, verify it appears through patient and dispatcher RPCs, mark shared, assign a test rider, mark collected/out-for-delivery/delivered, and assert COD becomes collected.

- [ ] **Step 2: Run both complete project checks**

Run mobile: `npm test && npm run typecheck`

Run PWA: `npm test -- --runInBand && npm run lint && npm run build`

Expected: all checks pass.

- [ ] **Step 3: Verify responsive PWA behavior**

Run the production build locally and verify access unlock, queue/detail, copy/share fallback, rider assignment, status progression, long customer/medicine content, and narrow phone spacing with Playwright.

- [ ] **Step 4: Push and deploy**

Push the PWA commit to `origin/main` and its feature branch without force. Run `vercel --prod`, confirm `readyState: READY`, keep deployment protection disabled, and record the stable production alias. Push the mobile branch only after the user supplies its Git remote URL.

- [ ] **Step 5: Commit any verification documentation changes**

```bash
git add scripts/verify-order-backend.mjs
git commit -m "test: verify complete dispatch lifecycle"
```
