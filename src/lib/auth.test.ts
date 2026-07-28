import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: () => {
        throw new Error('The temporary OTP bypass must not call Supabase.');
      },
    },
  },
}));

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
