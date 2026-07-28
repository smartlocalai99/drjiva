# Temporary OTP Bypass Design

## Goal

Make login usable while the OTP provider is unavailable by treating `1234` as
the only valid verification code.

## Design

Keep the OTP input, success navigation, error presentation, session
persistence, and patient lookup unchanged. A valid phone number on the login
screen routes directly to `/otp` without starting a send request. Resending
returns success without an external request, `1234` returns `{ ok: true }`,
and every other code returns `{ ok: false }`. A focus-reset single-flight
guard prevents the automatic redirect and Continue button from pushing
duplicate OTP screens while still allowing a new attempt after returning.

No dependencies, UI components, Supabase Edge Functions, or database behavior
change. The bypass applies to every app build until this temporary
implementation is reverted.

## Verification

Unit tests will prove that the direct OTP route is built synchronously,
duplicate navigation is blocked until reset, resend succeeds without the
provider, `1234` verifies, and another four-digit code is rejected. The full
test suite and TypeScript typecheck must pass.
