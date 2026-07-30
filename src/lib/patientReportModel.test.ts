import { describe, expect, it } from 'vitest';

import {
  buildPatientReportInsert,
  buildReportStoragePath,
  groupPatientReportsByHospital,
  mapPatientReportRow,
  removePatientReport,
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
        hospital: { id: 'hospital-1', source: 'directory' },
        label: 'Blood work',
        ownerUserId: 'user-1',
        pageCount: 2,
        patientId: 'patient-1',
        reportType: 'Lab Report',
        storagePath: 'user-1/patient-1/document-1.pdf',
      }),
    ).toMatchObject({
      file_type: 'pdf',
      document_hospital_id: 'hospital-1',
      patient_document_hospital_id: null,
      uploaded_by: 'patient',
    });
  });

  it('uses only the private hospital column for a patient-created hospital', () => {
    expect(
      buildPatientReportInsert({
        hospital: { id: 'custom-hospital-1', source: 'patient' },
        label: 'Prescription',
        ownerUserId: 'user-1',
        pageCount: 1,
        patientId: 'patient-1',
        reportType: 'Prescription',
        storagePath: 'user-1/patient-1/document-1.pdf',
      }),
    ).toMatchObject({
      document_hospital_id: null,
      patient_document_hospital_id: 'custom-hospital-1',
    });
  });
});

describe('mapPatientReportRow', () => {
  it('maps report metadata without treating the storage path as a public URL', () => {
    expect(
      mapPatientReportRow({
        created_at: '2026-07-28T12:00:00.000Z',
        document_hospital_id: 'document-hospital-1',
        hospital_id: 'hospital-1',
        id: 'report-1',
        label: 'Blood work',
        page_count: 2,
        patient_id: 'patient-1',
        patient_document_hospital_id: null,
        report_type: 'Lab Report',
        storage_path: 'user-1/patient-1/document-1.pdf',
      }),
    ).toEqual({
      createdAt: '2026-07-28T12:00:00.000Z',
      hospitalId: 'document-hospital-1',
      hospitalSource: 'directory',
      id: 'report-1',
      label: 'Blood work',
      pageCount: 2,
      patientId: 'patient-1',
      reportType: 'Lab Report',
      storagePath: 'user-1/patient-1/document-1.pdf',
    });
  });

  it('prefers a patient-created hospital over curated and legacy IDs', () => {
    expect(
      mapPatientReportRow({
        created_at: '2026-07-28T12:00:00.000Z',
        document_hospital_id: 'directory-hospital',
        hospital_id: 'legacy-hospital',
        id: 'report-1',
        label: 'Prescription',
        page_count: 1,
        patient_document_hospital_id: 'patient-hospital',
        patient_id: 'patient-1',
        report_type: 'Prescription',
        storage_path: 'user-1/patient-1/document-1.pdf',
      }),
    ).toMatchObject({
      hospitalId: 'patient-hospital',
      hospitalSource: 'patient',
    });
  });
});

describe('groupPatientReportsByHospital', () => {
  it('groups reports into named hospital folders with newest first', () => {
    const base = {
      hospitalId: 'hospital-1',
      hospitalSource: 'directory',
      label: null,
      pageCount: 1,
      patientId: 'patient-1',
      reportType: null,
      storagePath: null,
    } as const;

    expect(
      groupPatientReportsByHospital(
        [
          {
            ...base,
            createdAt: '2026-07-27T12:00:00.000Z',
            id: 'older',
          },
          {
            ...base,
            createdAt: '2026-07-28T12:00:00.000Z',
            id: 'newer',
          },
        ],
        [
          {
            id: 'hospital-1',
            name: 'Medico Hospital',
            source: 'directory',
          },
        ],
      ),
    ).toEqual([
      {
        key: 'name:medico hospital',
        hospitalId: 'hospital-1',
        hospitalName: 'Medico Hospital',
        reports: [
          expect.objectContaining({ id: 'newer' }),
          expect.objectContaining({ id: 'older' }),
        ],
      },
    ]);
  });

  it('keeps reports with the same hospital name in one folder even when IDs differ', () => {
    const report = {
      createdAt: '2026-07-30T12:00:00.000Z',
      hospitalSource: 'patient',
      label: null,
      pageCount: 1,
      patientId: 'patient-1',
      reportType: 'Medical Bill',
      storagePath: null,
    } as const;

    const groups = groupPatientReportsByHospital(
      [
        { ...report, hospitalId: 'hospital-a', id: 'report-a' },
        { ...report, hospitalId: 'hospital-b', id: 'report-b' },
      ],
      [
        {
          id: 'hospital-a',
          name: 'Palla Hospitals',
          source: 'directory',
        },
        {
          id: 'hospital-b',
          name: 'PALLA   HOSPITALS',
          source: 'patient',
        },
      ],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      hospitalName: 'Palla Hospitals',
      key: 'name:palla hospitals',
      reports: [{ id: 'report-a' }, { id: 'report-b' }],
    });
  });
});

describe('removePatientReport', () => {
  it('removes only the selected report', () => {
    const reports = [
      { id: 'report-a' },
      { id: 'report-b' },
    ] as unknown as Parameters<typeof removePatientReport>[0];

    expect(removePatientReport(reports, 'report-a')).toEqual([
      expect.objectContaining({ id: 'report-b' }),
    ]);
    expect(removePatientReport(reports, 'unknown')).toEqual(reports);
  });
});
