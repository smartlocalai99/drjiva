import type {
  HospitalOption,
  HospitalSource,
  ReportType,
} from './documentClassifier';

export type PatientReportRow = {
  created_at: string;
  document_hospital_id: string | null;
  hospital_id: string | null;
  id: string;
  label: string | null;
  page_count: number;
  patient_id: string;
  patient_document_hospital_id: string | null;
  report_type: ReportType | null;
  storage_path: string | null;
};

export type PatientReport = {
  createdAt: string;
  hospitalId: string | null;
  hospitalSource: HospitalSource | null;
  id: string;
  label: string | null;
  pageCount: number;
  patientId: string;
  reportType: ReportType | null;
  storagePath: string | null;
};

export type PatientReportHospitalGroup = {
  key: string;
  hospitalId: string | null;
  hospitalName: string;
  reports: PatientReport[];
};

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function buildPatientReportInsert(input: {
  hospital: Pick<HospitalOption, 'id' | 'source'>;
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
    document_hospital_id:
      input.hospital.source === 'directory' ? input.hospital.id : null,
    label: input.label,
    owner_user_id: input.ownerUserId,
    page_count: input.pageCount,
    patient_id: input.patientId,
    patient_document_hospital_id:
      input.hospital.source === 'patient' ? input.hospital.id : null,
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
  const hospitalId =
    row.patient_document_hospital_id ??
    row.document_hospital_id ??
    row.hospital_id;
  return {
    createdAt: row.created_at,
    hospitalId,
    hospitalSource: row.patient_document_hospital_id
      ? 'patient'
      : row.document_hospital_id
        ? 'directory'
        : null,
    id: row.id,
    label: row.label,
    pageCount: row.page_count,
    patientId: row.patient_id,
    reportType: row.report_type,
    storagePath: row.storage_path,
  };
}

export function removePatientReport(
  reports: PatientReport[],
  reportId: string,
): PatientReport[] {
  return reports.filter((report) => report.id !== reportId);
}

export function groupPatientReportsByHospital(
  reports: PatientReport[],
  hospitals: HospitalOption[],
  fallbackNames = {
    hospital: 'Hospital',
    otherHospital: 'Other hospital',
  },
): PatientReportHospitalGroup[] {
  const hospitalNames = new Map(
    hospitals.map((hospital) => [hospital.id, hospital.name]),
  );
  const groups = new Map<string, PatientReportHospitalGroup>();

  for (const report of reports) {
    const directoryName = report.hospitalId
      ? hospitalNames.get(report.hospitalId)
      : null;
    const hospitalName =
      directoryName ??
      (report.hospitalId ? fallbackNames.hospital : fallbackNames.otherHospital);
    const normalizedName = directoryName
      ?.normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const key = normalizedName
      ? `name:${normalizedName}`
      : report.hospitalId
        ? `id:${report.hospitalId}`
        : 'unknown';
    const group = groups.get(key) ?? {
      key,
      hospitalId: report.hospitalId,
      hospitalName,
      reports: [],
    };
    group.reports.push(report);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      reports: [...group.reports].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    }))
    .sort(
      (left, right) =>
        new Date(right.reports[0]!.createdAt).getTime() -
        new Date(left.reports[0]!.createdAt).getTime(),
    );
}
