# Temporary OTP Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route directly to OTP entry and accept `1234` as the temporary OTP.

**Architecture:** The login screen routes synchronously to `/otp` after local phone validation. Resend and verification use deterministic local results at the existing `src/lib/auth.ts` boundary.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 6, Vitest 4

## Global Constraints

- Read the exact Expo SDK 57 documentation before code changes.
- Do not change OTP-screen navigation, Supabase Edge Functions, dependencies, or patient/session behavior.
- The temporary bypass applies to every build.

---

### Task 1: Implement the temporary OTP behavior

**Files:**
- Create: `src/lib/auth.test.ts`
- Modify: `app/index.tsx`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: Expo Router's `useFocusEffect` and `router.push`.
- Produces: `getOtpScreenRoute(phone)`, single-flight `navigateToOtpOnce(...)`, provider-independent `sendOtp(...)`, and `verifyOtp(...)`.

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  getOtpScreenRoute,
  navigateToOtpOnce,
  sendOtp,
  verifyOtp,
} from './auth';

describe('temporary OTP bypass', () => {
  it('builds the direct OTP route', () => {
    expect(getOtpScreenRoute('9876543210')).toEqual({
      params: { phone: '9876543210' },
      pathname: '/otp',
    });
  });

  it('prevents duplicate navigation until focus resets the guard', () => {
    const guard = { current: false };
    const routes: ReturnType<typeof getOtpScreenRoute>[] = [];
    const push = (route: ReturnType<typeof getOtpScreenRoute>) => {
      routes.push(route);
    };

    expect(navigateToOtpOnce('9876543210', guard, push)).toBe(true);
    expect(navigateToOtpOnce('9876543210', guard, push)).toBe(false);
    guard.current = false;
    expect(navigateToOtpOnce('9876543210', guard, push)).toBe(true);
    expect(routes).toHaveLength(2);
  });

  it('allows login to proceed without sending an external OTP', async () => {
    await expect(sendOtp('9876543210')).resolves.toEqual({ ok: true });
  });

  it('accepts 1234 as the verification code', async () => {
    await expect(verifyOtp('9876543210', '1234')).resolves.toEqual({
      ok: true,
    });
  });

  it('rejects a different verification code', async () => {
    await expect(verifyOtp('9876543210', '5678')).resolves.toEqual({
      ok: false,
    });
  });
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/auth.test.ts`

Expected: FAIL because the direct route, navigation guard, and temporary provider-independent behavior do not exist yet.

- [x] **Step 3: Implement the minimal bypass**

Remove the initial `sendOtp` call and send/loading/error state from
`app/index.tsx`. Navigate synchronously with a single-flight ref that resets
through Expo Router's `useFocusEffect`. Keep resend provider-independent,
retain phone validation, and verify only `1234`.

- [x] **Step 4: Verify GREEN and regression safety**

Run: `npm test -- src/lib/auth.test.ts`

Expected: 5 tests pass.

Run: `npm test`

Expected: All tests pass.

Run: `npm run typecheck`

Expected: TypeScript exits successfully.

- [x] **Step 5: Commit**

```bash
git add app/index.tsx src/lib/auth.ts src/lib/auth.test.ts docs/superpowers
git commit -m "fix: add temporary OTP bypass"
```
