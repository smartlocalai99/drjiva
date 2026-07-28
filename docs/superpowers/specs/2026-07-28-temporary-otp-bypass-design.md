# Temporary OTP Bypass Design

## Goal

Make login usable while the OTP provider is unavailable by treating `1234` as
the only valid verification code.

## Design

Keep the existing login, OTP input, success navigation, error presentation,
session persistence, and patient lookup unchanged. Isolate the temporary
bypass in `src/lib/auth.ts`: sending or resending returns success without an
external request, `1234` returns `{ ok: true }`, and every other code returns
`{ ok: false }`.

No Expo APIs, dependencies, UI components, Supabase Edge Functions, or database
behavior change. The bypass applies to every app build until this temporary
implementation is reverted.

## Verification

Unit tests will prove that send succeeds without the provider, `1234` verifies,
and another four-digit code is rejected. The full test suite and TypeScript
typecheck must pass.
