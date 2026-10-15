import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./expoNotifications', () => ({ loadExpoNotifications: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(async () => null), setItem: vi.fn() } }));

const { CARE_CHILD_REMINDER_IDS, CARE_CYCLE_REMINDER_IDS, CARE_REMINDER_IDS, CHILD_REMINDER_SLOTS, childReminders, cycleReminderDays, followupReminderTimes } =
  await import('./careReminders');

describe('follow-up reminder times', () => {
  it('fires at 8 PM the day before and 8 AM on the day (phone time)', () => {
    const { day, eve } = followupReminderTimes('2026-10-20', new Date(2026, 9, 13, 10, 0));
    expect(eve).toEqual(new Date(2026, 9, 19, 20, 0, 0, 0));
    expect(day).toEqual(new Date(2026, 9, 20, 8, 0, 0, 0));
  });

  it('skips a reminder whose time has passed', () => {
    const { day, eve } = followupReminderTimes('2026-10-20', new Date(2026, 9, 19, 21, 0));
    expect(eve).toBeNull();
    expect(day).toEqual(new Date(2026, 9, 20, 8, 0, 0, 0));
  });

  it('works across a month boundary', () => {
    expect(followupReminderTimes('2026-11-01', new Date(2026, 9, 13)).eve).toEqual(new Date(2026, 9, 31, 20, 0, 0, 0));
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

describe('child vaccine reminders', () => {
  const item = (code: string, fromDate: string, extra = {}) => ({
    code, conditional: false, doneOn: null, fromDate, id: code, labelEn: code.toUpperCase(), labelTe: code, nurseName: null, optional: false, status: null, toDate: fromDate, ...extra,
  });
  const visit = (code: string, fromDate: string, items: ReturnType<typeof item>[]) => ({ code, fromDate, id: code, items, titleEn: code, titleTe: code, toDate: fromDate });
  const plan = {
    birthDate: '2026-09-08', createdAt: '', doctorName: null, eddDate: null, gender: 'male' as const, hiddenByPatient: false, hospitalId: 'h', hospitalName: 'Dhruva Hospitals',
    id: 'arjun', lmpDate: null, personName: 'Arjun', startDate: '2026-09-08', startedByNurse: null, status: 'active' as const, type: 'child' as const,
    visits: [
      visit('birth', '2026-09-08', [item('dhruva_child_bcg_1', '2026-09-08')]),
      visit('6w', '2026-10-20', [item('dhruva_child_dtp_1', '2026-10-20')]),
      visit('10w', '2026-11-17', [item('dhruva_child_dtp_2', '2026-11-17')]),
      visit('9m', '2027-06-08', [item('dhruva_child_opt_mcv4_1', '2027-06-08', { conditional: true, optional: true })]),
    ],
  };
  const records = [{ batchNo: null, brand: null, expiry: null, givenOn: '2026-09-08', itemId: 'dhruva_child_bcg_1', photoPath: null, planId: 'arjun', site: null }];
  const care = (extra = {}) => ({ linked: true, plans: [plan], today: '2026-10-15', vaccineRecords: records, ...extra }) as never;
  const now = new Date(2026, 9, 15, 10, 0);
  const at = (list: { at: Date }[]) => list.map((r) => `${r.at.getMonth() + 1}/${r.at.getDate()} ${r.at.getHours()}:00`);

  it('reminds 3 days before (8 AM), the night before (8 PM), on the day (8 AM) and once overdue', () => {
    const list = childReminders(care(), 'en', now);
    expect(at(list)).toEqual(['10/17 8:00', '10/19 20:00', '10/20 8:00', '10/27 8:00']);
    expect(list[0]).toMatchObject({ body: '6w visit at Dhruva Hospitals: DHRUVA_CHILD_DTP_1', title: 'Arjun: vaccines in 3 days' });
    expect(list[3]!.title).toBe('Arjun: vaccines are overdue');
  });

  it('leaves the day before and the day to the hospital visit reminder on the same date', () => {
    const list = childReminders(care({ followup: { nextDate: '2026-10-20' } }), 'en', now);
    expect(at(list)).toEqual(['10/17 8:00', '10/27 8:00']);
  });

  it('reminds only about the next open visit, never optional vaccines', () => {
    const list = childReminders(care(), 'te', now);
    expect(list.every((reminder) => !reminder.body.includes('MCV4') && !reminder.body.includes('10w'))).toBe(true);
    expect(list[0]!.title).toBe('Arjun: 3 రోజుల్లో టీకాలు');
  });

  it('calls a child without a name "Child" / "బిడ్డ"', () => {
    const unnamed = care({ plans: [{ ...plan, personName: 'Child' }] });
    expect(childReminders(unnamed, 'te', now)[0]!.title).toBe('బిడ్డ: 3 రోజుల్లో టీకాలు');
  });

  it('never uses more than its fixed IDs', () => {
    expect(CARE_CHILD_REMINDER_IDS).toHaveLength(CHILD_REMINDER_SLOTS);
    expect(CARE_CHILD_REMINDER_IDS.every((id) => id.startsWith('drjiva-care-child-'))).toBe(true);
  });
});
