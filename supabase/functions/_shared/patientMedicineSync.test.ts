import { describe, expect, it } from 'vitest';

describe('syncPatientMedicine', () => {
  it('copies the private photo and completes the shared hospital catalogue link', async () => {
    const module = await import('./patientMedicineSync.ts').catch(() => ({}));
    expect(module).toHaveProperty('syncPatientMedicine');

    const events: string[] = [];
    const body = new Blob(['patient medicine image'], { type: 'image/jpeg' });
    const result = await module.syncPatientMedicine(
      '6ed1c8d4-d655-4c43-8220-4dcd722ed121',
      {
        claim: async () => ({
          imagePath: 'owner-id/private-photo.jpg',
          sharedImagePath:
            'patient-submissions/6ed1c8d4-d655-4c43-8220-4dcd722ed121.jpg',
        }),
        complete: async (input: unknown) => {
          events.push(`complete:${JSON.stringify(input)}`);
          return {
            hospitalId: '44ac8e3e-df57-4eea-bba4-735fe7ead371',
            medicineId: '832499f2-2924-428a-bc5e-3e89f882422f',
          };
        },
        download: async (path: string) => {
          events.push(`download:${path}`);
          return body;
        },
        fail: async (message: string) => {
          events.push(`fail:${message}`);
        },
        getPublicUrl: (path: string) =>
          `https://example.supabase.co/storage/v1/object/public/medicine-images/${path}`,
        upload: async (path: string, uploaded: Blob) => {
          events.push(`upload:${path}:${uploaded.size}`);
        },
      },
    );

    expect(events).toEqual([
      'download:owner-id/private-photo.jpg',
      'upload:patient-submissions/6ed1c8d4-d655-4c43-8220-4dcd722ed121.jpg:22',
      'complete:{"customMedicineId":"6ed1c8d4-d655-4c43-8220-4dcd722ed121","sharedImagePath":"patient-submissions/6ed1c8d4-d655-4c43-8220-4dcd722ed121.jpg","sharedImageUrl":"https://example.supabase.co/storage/v1/object/public/medicine-images/patient-submissions/6ed1c8d4-d655-4c43-8220-4dcd722ed121.jpg"}',
    ]);
    expect(result).toEqual({
      duplicate: false,
      hospitalId: '44ac8e3e-df57-4eea-bba4-735fe7ead371',
      medicineId: '832499f2-2924-428a-bc5e-3e89f882422f',
    });
  });

  it('does not copy the photo when the webhook was already completed', async () => {
    const module = await import('./patientMedicineSync.ts').catch(() => ({}));
    expect(module).toHaveProperty('syncPatientMedicine');

    let copied = false;
    const result = await module.syncPatientMedicine('custom-medicine-id', {
      claim: async () => null,
      complete: async () => {
        throw new Error('complete must not run');
      },
      download: async () => {
        copied = true;
        return new Blob();
      },
      fail: async () => undefined,
      getPublicUrl: () => '',
      upload: async () => {
        copied = true;
      },
    });

    expect(copied).toBe(false);
    expect(result).toEqual({ duplicate: true });
  });
});
