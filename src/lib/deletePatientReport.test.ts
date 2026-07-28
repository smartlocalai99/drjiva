import { describe, expect, it } from 'vitest';

import { deletePatientReportWithAdapter } from './deletePatientReport';

describe('deletePatientReportWithAdapter', () => {
  it('deletes the storage object before its database row', async () => {
    const calls: string[] = [];

    await deletePatientReportWithAdapter(
      {
        removeFile: async () => {
          calls.push('file');
          return null;
        },
        removeRow: async () => {
          calls.push('row');
          return null;
        },
      },
      { id: 'report-1', storagePath: 'user/patient/report.pdf' },
    );

    expect(calls).toEqual(['file', 'row']);
  });

  it('keeps the row when storage deletion fails', async () => {
    let rowCalls = 0;

    await expect(
      deletePatientReportWithAdapter(
        {
          removeFile: async () => new Error('storage failed'),
          removeRow: async () => {
            rowCalls += 1;
            return null;
          },
        },
        { id: 'report-1', storagePath: 'user/patient/report.pdf' },
      ),
    ).rejects.toThrow('storage failed');
    expect(rowCalls).toBe(0);
  });

  it('retries database deletion once', async () => {
    let rowCalls = 0;

    await deletePatientReportWithAdapter(
      {
        removeFile: async () => null,
        removeRow: async () => {
          rowCalls += 1;
          return rowCalls === 1 ? new Error('temporary') : null;
        },
      },
      { id: 'report-1', storagePath: null },
    );

    expect(rowCalls).toBe(2);
  });
});
