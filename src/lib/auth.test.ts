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

import {
  getOtpScreenRoute,
  navigateToOtpOnce,
  sendOtp,
  verifyOtp,
} from './auth';

describe('temporary OTP bypass', () => {
  it('builds the OTP screen route synchronously from the submitted phone', () => {
    expect(getOtpScreenRoute('9876543210')).toEqual({
      params: { phone: '9876543210' },
      pathname: '/otp',
    });
  });

  it('allows only one OTP navigation until the login screen resets', () => {
    const navigationStarted = { current: false };
    const routes: ReturnType<typeof getOtpScreenRoute>[] = [];
    const push = (route: ReturnType<typeof getOtpScreenRoute>) => {
      routes.push(route);
    };

    expect(
      navigateToOtpOnce('9876543210', navigationStarted, push),
    ).toBe(true);
    expect(
      navigateToOtpOnce('9876543210', navigationStarted, push),
    ).toBe(false);
    navigationStarted.current = false;
    expect(
      navigateToOtpOnce('9876543210', navigationStarted, push),
    ).toBe(true);
    expect(routes).toEqual([
      {
        params: { phone: '9876543210' },
        pathname: '/otp',
      },
      {
        params: { phone: '9876543210' },
        pathname: '/otp',
      },
    ]);
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
