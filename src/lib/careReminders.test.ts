import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./expoNotifications', () => ({ loadExpoNotifications: vi.fn() }));

const { CARE_CYCLE_REMINDER_IDS, CARE_REMINDER_IDS, cycleReminderDays, followupReminderTimes } = await import('./careReminders');

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

describe('fertility cycle reminders', () => {
  const step = (id: string, day: number, date: string, who: 'wife' | 'husband' | 'couple' = 'wife', status: 'done' | null = null) => ({
    baseDate: date, code: id, date, day, doneOn: null, id, labelEn: id, labelTe: `te-${id}`, noteEn: null, noteTe: null, nurseName: null, status, who,
  });
  const cycle = {
    anchorDate: '2026-10-06', doctorName: null, hospitalId: 'h1', hospitalName: 'Dhruva Hospital', id: 'c1', kind: 'cycle' as const, lengthDays: 31,
    partnerName: null, personName: 'A', protocol: 'oi_ti_iui', status: 'active' as const, titleEn: 'OI-TI / IUI', titleTe: 'OI-TI / IUI',
    steps: [
      step('Baseline scan', 2, '2026-10-07', 'wife', 'done'),
      step('Semen analysis', 2, '2026-10-07', 'husband'),
      step('Follicle scan', 9, '2026-10-14'),
      step('Follicle scan 2', 11, '2026-10-16'),
      step('Trigger injection', 13, '2026-10-18'),
      step('IUI', 14, '2026-10-19', 'couple'),
    ],
  };

  it('lists the next hospital days in words, skipping the follow-up date', () => {
    const care = { cycles: [cycle], followup: { nextDate: '2026-10-14' }, linked: true, today: '2026-10-07' } as never;
    expect(cycleReminderDays(care, 'en', '2026-10-07')).toEqual([
      { date: '2026-10-07', day: 2, hospital: 'Dhruva Hospital', steps: 'Semen analysis (Husband)' },
      { date: '2026-10-16', day: 11, hospital: 'Dhruva Hospital', steps: 'Follicle scan 2' },
      { date: '2026-10-18', day: 13, hospital: 'Dhruva Hospital', steps: 'Trigger injection' },
    ]);
    expect(cycleReminderDays(care, 'te', '2026-10-19')).toEqual([
      { date: '2026-10-19', day: 14, hospital: 'Dhruva Hospital', steps: 'te-IUI (మీరిద్దరూ)' },
    ]);
  });

  it('uses its own fixed IDs', () => {
    const ids = CARE_CYCLE_REMINDER_IDS.flatMap((pair) => [pair.eve, pair.day]);
    expect(ids).toHaveLength(6);
    expect(ids.every((id) => id.startsWith('drjiva-care-cycle-'))).toBe(true);
  });
});
