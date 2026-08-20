import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_PHONE_KEY = 'drjiva.session.phone';
const TERMS_ACCEPTED_KEY = 'drjiva.terms-accepted.v1';
const PATIENT_NAME_KEY_PREFIX = 'drjiva.patient-name.v1';
const PATIENT_AVATAR_KEY_PREFIX = 'drjiva.patient-avatar.v1';
const avatarListeners = new Map<
  string,
  Set<(avatarUrl: string | null) => void>
>();

function normalizeAvatarPhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

function getPatientNameKey(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return `${PATIENT_NAME_KEY_PREFIX}.${normalizedPhone}`;
}

function getPatientAvatarKey(phone: string): string {
  const normalizedPhone = normalizeAvatarPhone(phone);
  return `${PATIENT_AVATAR_KEY_PREFIX}.${normalizedPhone}`;
}

function notifyAvatarListeners(
  phone: string,
  avatarUrl: string | null,
): void {
  avatarListeners
    .get(normalizeAvatarPhone(phone))
    ?.forEach((listener) => listener(avatarUrl));
}

export function subscribeCachedAvatarUrl(
  phone: string,
  listener: (avatarUrl: string | null) => void,
): () => void {
  const normalizedPhone = normalizeAvatarPhone(phone);
  const phoneListeners = avatarListeners.get(normalizedPhone) ?? new Set();
  phoneListeners.add(listener);
  avatarListeners.set(normalizedPhone, phoneListeners);

  return () => {
    phoneListeners.delete(listener);
    if (phoneListeners.size === 0) {
      avatarListeners.delete(normalizedPhone);
    }
  };
}

export async function saveSessionPhone(phone: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_PHONE_KEY, phone);
}

export async function getSessionPhone(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_PHONE_KEY);
}

export async function clearSessionPhone(): Promise<void> {
  const phone = await getSessionPhone();
  const removals: Promise<void>[] = [AsyncStorage.removeItem(SESSION_PHONE_KEY)];

  if (phone) {
    removals.push(clearCachedPatientName(phone));
    removals.push(clearCachedAvatarUrl(phone));
  }

  await Promise.all(removals);
}

export async function hasAcceptedTerms(): Promise<boolean> {
  return (await AsyncStorage.getItem(TERMS_ACCEPTED_KEY)) === 'true';
}

export async function saveTermsAccepted(): Promise<void> {
  await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
}

export async function getCachedPatientName(
  phone: string,
): Promise<string | null> {
  return AsyncStorage.getItem(getPatientNameKey(phone));
}

export async function saveCachedPatientName(
  phone: string,
  name: string,
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    await clearCachedPatientName(phone);
    return;
  }

  await AsyncStorage.setItem(getPatientNameKey(phone), trimmedName);
}

export async function clearCachedPatientName(phone: string): Promise<void> {
  await AsyncStorage.removeItem(getPatientNameKey(phone));
}

export async function getCachedAvatarUrl(
  phone: string,
): Promise<string | null> {
  return AsyncStorage.getItem(getPatientAvatarKey(phone));
}

export async function saveCachedAvatarUrl(
  phone: string,
  avatarUrl: string | null,
): Promise<void> {
  if (!avatarUrl) {
    await clearCachedAvatarUrl(phone);
    return;
  }

  await AsyncStorage.setItem(getPatientAvatarKey(phone), avatarUrl);
  notifyAvatarListeners(phone, avatarUrl);
}

export async function clearCachedAvatarUrl(phone: string): Promise<void> {
  await AsyncStorage.removeItem(getPatientAvatarKey(phone));
  notifyAvatarListeners(phone, null);
}
