import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_PHONE_KEY = 'drjiva.session.phone';
const PATIENT_NAME_KEY_PREFIX = 'drjiva.patient-name.v1';
const PATIENT_AVATAR_KEY_PREFIX = 'drjiva.patient-avatar.v1';

function getPatientNameKey(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return `${PATIENT_NAME_KEY_PREFIX}.${normalizedPhone}`;
}

function getPatientAvatarKey(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return `${PATIENT_AVATAR_KEY_PREFIX}.${normalizedPhone}`;
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
}

export async function clearCachedAvatarUrl(phone: string): Promise<void> {
  await AsyncStorage.removeItem(getPatientAvatarKey(phone));
}
