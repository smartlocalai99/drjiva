import { describe, expect, it } from 'vitest';

import {
  deletePatientReportWithAdapter,
  PatientReportDeletionError,
} from './deletePatientReport';

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

  it('identifies the failed deletion stage', async () => {
    try {
      await deletePatientReportWithAdapter(
        {
          removeFile: async () => null,
          removeRow: async () => new Error('row failed'),
        },
        { id: 'report-1', storagePath: null },
      );
      throw new Error('Expected deletion to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PatientReportDeletionError);
      expect((error as PatientReportDeletionError).stage).toBe('database');
    }
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
