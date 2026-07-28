const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;
const TEMPORARY_OTP = '1234';

function toMobile(phone: string): string {
  const mobile = phone.replace(/\D/g, '').slice(-10);

  if (!INDIAN_PHONE_PATTERN.test(mobile)) {
    throw new Error('Invalid Indian mobile number.');
  }

  return mobile;
}

export async function sendOtp(
  phone: string,
): Promise<{ ok: true }> {
  toMobile(phone);
  return { ok: true };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ ok: boolean }> {
  toMobile(phone);
  return { ok: code === TEMPORARY_OTP };
}
