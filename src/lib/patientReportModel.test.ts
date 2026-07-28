import { describe, expect, it } from 'vitest';

import {
  buildPatientReportInsert,
  buildReportStoragePath,
  mapPatientReportRow,
} from './patientReportModel';

describe('buildReportStoragePath', () => {
  it('keeps every PDF inside the authenticated user folder', () => {
    expect(
      buildReportStoragePath('user-1', 'patient-1', 'document-1'),
    ).toBe('user-1/patient-1/document-1.pdf');
  });

  it('rejects path traversal characters', () => {
    expect(() =>
      buildReportStoragePath('user-1', '../patient', 'document-1'),
    ).toThrow('Invalid report storage segment.');
  });
});

describe('buildPatientReportInsert', () => {
  it('uses the database file and uploader values for patient PDFs', () => {
    expect(
      buildPatientReportInsert({
        hospitalId: 'hospital-1',
        label: 'Blood work',
        ownerUserId: 'user-1',
        pageCount: 2,
        patientId: 'patient-1',
        reportType: 'Lab Report',
        storagePath: 'user-1/patient-1/document-1.pdf',
      }),
    ).toMatchObject({
      file_type: 'pdf',
      uploaded_by: 'patient',
    });
  });
});

describe('mapPatientReportRow', () => {
  it('maps report metadata without treating the storage path as a public URL', () => {
    expect(
      mapPatientReportRow({
        created_at: '2026-07-28T12:00:00.000Z',
        hospital_id: 'hospital-1',
        id: 'report-1',
        label: 'Blood work',
        page_count: 2,
        patient_id: 'patient-1',
        report_type: 'Lab Report',
        storage_path: 'user-1/patient-1/document-1.pdf',
      }),
    ).toEqual({
      createdAt: '2026-07-28T12:00:00.000Z',
      hospitalId: 'hospital-1',
      id: 'report-1',
      label: 'Blood work',
      pageCount: 2,
      patientId: 'patient-1',
      reportType: 'Lab Report',
      storagePath: 'user-1/patient-1/document-1.pdf',
    });
  });
});
