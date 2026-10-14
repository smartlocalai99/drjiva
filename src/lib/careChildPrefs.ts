import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------
// Reminder choices, kept on this phone: optional vaccines the parent turned
// on, and extra visits they asked to be reminded about.
// ---------------------------------------------------------------------

export type ChildReminderPrefs = { optional: string[]; visits: string[] };

const prefsKey = (phone: string) => `drjiva.care.childReminders.v1.${phone}`;

export async function readChildReminderPrefs(phone: string): Promise<ChildReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(prefsKey(phone));
    const parsed = raw ? (JSON.parse(raw) as Partial<ChildReminderPrefs>) : {};
    return {
      optional: Array.isArray(parsed.optional) ? parsed.optional.filter((id) => typeof id === 'string') : [],
      visits: Array.isArray(parsed.visits) ? parsed.visits.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return { optional: [], visits: [] };
  }
}

export async function writeChildReminderPrefs(phone: string, prefs: ChildReminderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(prefsKey(phone), JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable: the reminder simply stays off.
  }
}
