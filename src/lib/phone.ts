const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;

export function toIndianE164(phone: string): string {
  const nationalNumber = phone.replace(/\D/g, '').slice(-10);

  if (!INDIAN_PHONE_PATTERN.test(nationalNumber)) {
    throw new Error('Invalid Indian mobile number.');
  }

  return `+91${nationalNumber}`;
}
