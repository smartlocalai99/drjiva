import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureSessionMock, eqMock, fromMock } = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(async () => 'patient-user-id'),
  eqMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: ensureSessionMock,
}));

vi.mock('./supabase', () => ({
  supabase: { from: fromMock },
}));

import { fetchMedicineCatalogue } from './medicineCourses';

describe('medicine catalogue', () => {
  beforeEach(() => {
    ensureSessionMock.mockClear();
    eqMock.mockReset();
    fromMock.mockReset();
  });

  it('loads Dhruva medicines by hospital ID and preserves their images', async () => {
    const rows = [
      {
        hospital_id: 'dhruva-hospital-id',
        hospital_name: 'Dhruva Hospitals',
        id: 'dhruva-medicine-id',
        image_url: 'https://db.test/dhruva/medicine.jpg',
        name: 'AB NORM-100',
      },
    ];
    eqMock.mockResolvedValue({ data: rows, error: null });
    fromMock.mockReturnValue({
      select: () => ({
        order: () => ({
          limit: () => ({ eq: eqMock }),
        }),
      }),
    });

    await expect(
      fetchMedicineCatalogue('dhruva-hospital-id'),
    ).resolves.toEqual([
      {
        hospitalId: 'dhruva-hospital-id',
        hospitalName: 'Dhruva Hospitals',
        id: 'dhruva-medicine-id',
        imageUrl: 'https://db.test/dhruva/medicine.jpg',
        name: 'AB NORM-100',
      },
    ]);
    expect(eqMock).toHaveBeenCalledWith(
      'hospital_id',
      'dhruva-hospital-id',
    );
  });
});
