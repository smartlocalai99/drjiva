import { File } from 'expo-file-system';

import type {
  HospitalOption,
  ReportType,
} from './documentClassifier';
import {
  buildPatientReportInsert,
  buildReportStoragePath,
  mapPatientReportRow,
  type PatientReport,
  type PatientReportRow,
} from './patientReportModel';
import { deletePatientReportWithAdapter } from './deletePatientReport';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

const REPORT_COLUMNS =
  'id, patient_id, hospital_id, label, report_type, page_count, storage_path, created_at';
const MAX_REPORT_BYTES = 20 * 1024 * 1024;
const HOSPITALS_CACHE_TTL_MS = 5 * 60 * 1000;

let hospitalsCache: { expiresAt: number; hospitals: HospitalOption[] } | null =
  null;

function createDocumentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function fetchHospitals(): Promise<HospitalOption[]> {
  if (hospitalsCache && hospitalsCache.expiresAt > Date.now()) {
    return hospitalsCache.hospitals;
  }

  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name')
    .order('name');

  if (error) {
    throw error;
  }

  const hospitals = (data ?? []) as HospitalOption[];
  hospitalsCache = { expiresAt: Date.now() + HOSPITALS_CACHE_TTL_MS, hospitals };
  return hospitals;
}

export async function fetchPatientReports(
  patientId: string,
): Promise<PatientReport[]> {
  const { data, error } = await supabase
    .from('patient_reports')
    .select(REPORT_COLUMNS)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PatientReportRow[]).map(mapPatientReportRow);
}

export async function uploadPatientReport(input: {
  hospitalId: string;
  label: string;
  pageCount: number;
  patientId: string;
  pdfUri: string;
  reportType: ReportType;
}): Promise<PatientReport> {
  const userId = await ensureSecureReportSession();
  const storagePath = buildReportStoragePath(
    userId,
    input.patientId,
    createDocumentId(),
  );
  const pdf = new File(input.pdfUri);
  const fileInfo = pdf.info();

  if (!fileInfo.exists || !fileInfo.size) {
    throw new Error('The generated PDF is unavailable.');
  }
  if (fileInfo.size > MAX_REPORT_BYTES) {
    throw new Error('The report PDF must be smaller than 20 MB.');
  }

  const { error: uploadError } = await supabase.storage
    .from('patient-reports')
    .upload(storagePath, await pdf.arrayBuffer(), {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from('patient_reports')
    .insert(
      buildPatientReportInsert({
        hospitalId: input.hospitalId,
        label: input.label,
        ownerUserId: userId,
        pageCount: input.pageCount,
        patientId: input.patientId,
        reportType: input.reportType,
        storagePath,
      }),
    )
    .select(REPORT_COLUMNS)
    .single();

  if (insertError || !data) {
    await supabase.storage
      .from('patient-reports')
      .remove([storagePath])
      .catch(() => undefined);
    throw insertError ?? new Error('Unable to attach the report.');
  }

  return mapPatientReportRow(data as PatientReportRow);
}

export async function createPatientReportSignedUrl(
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('patient-reports')
    .createSignedUrl(storagePath, 10 * 60);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to open this report.');
  }

  return data.signedUrl;
}

export async function deletePatientReport(
  report: Pick<PatientReport, 'id' | 'storagePath'>,
): Promise<void> {
  await ensureSecureReportSession();
  await deletePatientReportWithAdapter(
    {
      removeFile: async (storagePath) => {
        const { error } = await supabase.storage
          .from('patient-reports')
          .remove([storagePath]);
        return error;
      },
      removeRow: async (reportId) => {
        const { error } = await supabase
          .from('patient_reports')
          .delete()
          .eq('id', reportId);
        return error;
      },
    },
    report,
  );
}
