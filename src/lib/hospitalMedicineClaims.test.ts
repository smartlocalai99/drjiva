import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureSessionMock, getSettingsMock, insertMock, rpcMock, syncMock } =
  vi.hoisted(() => ({
    ensureSessionMock: vi.fn(async () => 'device-owner-id'),
    getSettingsMock: vi.fn(),
    insertMock: vi.fn(async (_rows: unknown) => ({ error: null })),
    rpcMock: vi.fn(),
    syncMock: vi.fn(async () => undefined),
  }));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: ensureSessionMock,
}));

vi.mock('./medicineCourses', () => ({
  getNotificationSettings: getSettingsMock,
}));

vi.mock('./medicineNotificationSync', () => ({
  syncPatientDoseNotifications: syncMock,
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ insert: insertMock })),
    rpc: rpcMock,
  },
}));

import { claimHospitalMedicineCourses } from './hospitalMedicineClaims';

const claimedCourse = {
  course_id: 'course-1',
  day_pattern: 'daily' as const,
  duration_days: 2,
  patient_id: 'patient-1',
  slots: ['morning' as const],
  start_date: '2026-08-17',
  tablets_per_dose: 1,
};

describe('claimHospitalMedicineCourses', () => {
  beforeEach(() => {
    ensureSessionMock.mockClear();
    getSettingsMock.mockReset();
    insertMock.mockClear();
    rpcMock.mockReset();
    syncMock.mockClear();
  });

  it('schedules dose events using the patient\'s own reminder times, not the universal default', async () => {
    getSettingsMock.mockResolvedValue({
      afternoonTime: '15:30',
      morningTime: '07:00',
      nightTime: '21:15',
      timezone: 'Asia/Kolkata',
    });
    rpcMock.mockResolvedValue({ data: [claimedCourse], error: null });

    await claimHospitalMedicineCourses('9866531011');

    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0]![0] as Array<{ scheduled_for: string }>;
    expect(inserted).toHaveLength(2); // 2-day daily course, morning only
    for (const event of inserted) {
      const hours = new Date(event.scheduled_for).getUTCHours();
      const minutes = new Date(event.scheduled_for).getUTCMinutes();
      // 07:00 IST == 01:30 UTC
      expect(`${hours}:${minutes}`).toBe('1:30');
    }
  });

  it('falls back to the universal 8am/1pm/8pm default when the patient never customized their times', async () => {
    getSettingsMock.mockResolvedValue({
      afternoonTime: '13:00',
      morningTime: '08:00',
      nightTime: '20:00',
      timezone: 'Asia/Kolkata',
    });
    rpcMock.mockResolvedValue({ data: [claimedCourse], error: null });

    await claimHospitalMedicineCourses('9866531011');

    const inserted = insertMock.mock.calls[0]![0] as Array<{ scheduled_for: string }>;
    const hours = new Date(inserted[0]!.scheduled_for).getUTCHours();
    const minutes = new Date(inserted[0]!.scheduled_for).getUTCMinutes();
    // 08:00 IST == 02:30 UTC
    expect(`${hours}:${minutes}`).toBe('2:30');
  });

  it('actually schedules phone notifications for the claimed course, not just database rows', async () => {
    getSettingsMock.mockResolvedValue({
      afternoonTime: '13:00',
      morningTime: '08:00',
      nightTime: '20:00',
      timezone: 'Asia/Kolkata',
    });
    rpcMock.mockResolvedValue({ data: [claimedCourse], error: null });

    await claimHospitalMedicineCourses('9866531011');

    expect(syncMock).toHaveBeenCalledWith('patient-1');
  });

  it('does nothing when there is nothing to claim', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await claimHospitalMedicineCourses('9866531011');

    expect(insertMock).not.toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('still schedules using the default times if fetching settings fails', async () => {
    getSettingsMock.mockRejectedValue(new Error('network down'));
    rpcMock.mockResolvedValue({ data: [claimedCourse], error: null });

    await claimHospitalMedicineCourses('9866531011');

    const inserted = insertMock.mock.calls[0]![0] as Array<{ scheduled_for: string }>;
    const hours = new Date(inserted[0]!.scheduled_for).getUTCHours();
    const minutes = new Date(inserted[0]!.scheduled_for).getUTCMinutes();
    expect(`${hours}:${minutes}`).toBe('2:30');
  });
});
