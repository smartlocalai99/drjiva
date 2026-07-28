import type { ReportType } from './documentClassifier';

export type PatientReportRow = {
  created_at: string;
  hospital_id: string | null;
  id: string;
  label: string | null;
  page_count: number;
  patient_id: string;
  report_type: ReportType | null;
  storage_path: string | null;
};

export type PatientReport = {
  createdAt: string;
  hospitalId: string | null;
  id: string;
  label: string | null;
  pageCount: number;
  patientId: string;
  reportType: ReportType | null;
  storagePath: string | null;
};

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function buildPatientReportInsert(input: {
  hospitalId: string;
  label: string;
  ownerUserId: string;
  pageCount: number;
  patientId: string;
  reportType: ReportType;
  storagePath: string;
}) {
  return {
    file_type: 'pdf',
    file_url: input.storagePath,
    hospital_id: input.hospitalId,
    label: input.label,
    owner_user_id: input.ownerUserId,
    page_count: input.pageCount,
    patient_id: input.patientId,
    report_type: input.reportType,
    storage_path: input.storagePath,
    uploaded_by: 'patient',
  } as const;
}

export function buildReportStoragePath(
  userId: string,
  patientId: string,
  documentId: string,
): string {
  const segments = [userId, patientId, documentId];
  if (segments.some((segment) => !SAFE_SEGMENT.test(segment))) {
    throw new Error('Invalid report storage segment.');
  }
  return `${userId}/${patientId}/${documentId}.pdf`;
}

export function mapPatientReportRow(row: PatientReportRow): PatientReport {
  return {
    createdAt: row.created_at,
    hospitalId: row.hospital_id,
    id: row.id,
    label: row.label,
    pageCount: row.page_count,
    patientId: row.patient_id,
    reportType: row.report_type,
    storagePath: row.storage_path,
  };
}
