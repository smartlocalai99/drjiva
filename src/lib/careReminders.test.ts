import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./expoNotifications', () => ({ loadExpoNotifications: vi.fn() }));

const { CARE_REMINDER_IDS, followupReminderTimes } = await import('./careReminders');

describe('follow-up reminder times', () => {
  it('fires at 6 PM the day before and 8 AM on the day (phone time)', () => {
    const { day, eve } = followupReminderTimes('2026-10-20', new Date(2026, 9, 13, 10, 0));
    expect(eve).toEqual(new Date(2026, 9, 19, 18, 0, 0, 0));
    expect(day).toEqual(new Date(2026, 9, 20, 8, 0, 0, 0));
  });

  it('skips a reminder whose time has passed', () => {
    const { day, eve } = followupReminderTimes('2026-10-20', new Date(2026, 9, 19, 19, 0));
    expect(eve).toBeNull();
    expect(day).toEqual(new Date(2026, 9, 20, 8, 0, 0, 0));
  });

  it('works across a month boundary', () => {
    expect(followupReminderTimes('2026-11-01', new Date(2026, 9, 13)).eve).toEqual(new Date(2026, 9, 31, 18, 0, 0, 0));
  });

  it('uses its own IDs, never the medicine reminder ones', () => {
    expect(Object.values(CARE_REMINDER_IDS).every((id) => id.startsWith('drjiva-care-followup-'))).toBe(true);
  });
});
