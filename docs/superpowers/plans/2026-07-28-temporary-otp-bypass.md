# Temporary OTP Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept `1234` as the temporary OTP while leaving the surrounding login flow unchanged.

**Architecture:** Replace the external OTP send and verify calls at the existing `src/lib/auth.ts` boundary with deterministic local results. Existing screens continue consuming the same asynchronous function signatures.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 6, Vitest 4

## Global Constraints

- Read the exact Expo SDK 57 documentation before code changes.
- Do not change screens, navigation, Supabase Edge Functions, dependencies, or patient/session behavior.
- The temporary bypass applies to every build.

---

### Task 1: Implement the temporary OTP behavior

**Files:**
- Create: `src/lib/auth.test.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: `sendOtp(phone: string): Promise<{ ok: true }>` and `verifyOtp(phone: string, code: string): Promise<{ ok: boolean }>`
- Produces: The same function signatures with provider-independent temporary behavior.

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { sendOtp, verifyOtp } from './auth';

describe('temporary OTP bypass', () => {
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

Expected: FAIL because the current implementation requires Supabase environment configuration or calls the external provider instead of returning the temporary local results.

- [x] **Step 3: Implement the minimal bypass**

Remove the Supabase dependency from `src/lib/auth.ts`, retain phone validation,
make `sendOtp` return `{ ok: true }`, and make `verifyOtp` return whether the
submitted code is exactly `1234`.

- [x] **Step 4: Verify GREEN and regression safety**

Run: `npm test -- src/lib/auth.test.ts`

Expected: 3 tests pass.

Run: `npm test`

Expected: All tests pass.

Run: `npm run typecheck`

Expected: TypeScript exits successfully.

- [x] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts docs/superpowers
git commit -m "fix: add temporary OTP bypass"
```
