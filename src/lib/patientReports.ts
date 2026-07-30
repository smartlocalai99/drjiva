import { File } from 'expo-file-system';

import type {
  HospitalOption,
  ReportType,
} from './documentClassifier';
import { normalizeMedicineSearch } from './medicineSearch';
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
  'id, patient_id, hospital_id, document_hospital_id, patient_document_hospital_id, label, report_type, page_count, storage_path, created_at';
const MAX_REPORT_BYTES = 20 * 1024 * 1024;
const HOSPITALS_CACHE_TTL_MS = 5 * 60 * 1000;
const SIGNED_URL_TTL_SECONDS = 10 * 60;
// Cached for less than the URL's real validity so a reopen never hands out
// one that's about to expire mid-view.
const SIGNED_URL_CACHE_TTL_MS = 8 * 60 * 1000;

let hospitalsCache: { expiresAt: number; hospitals: HospitalOption[] } | null =
  null;
const signedUrlCache = new Map<string, { expiresAt: number; url: string }>();

function createDocumentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function fetchDirectoryHospitals(): Promise<HospitalOption[]> {
  if (hospitalsCache && hospitalsCache.expiresAt > Date.now()) {
    return hospitalsCache.hospitals;
  }

  const { data, error } = await supabase
    .from('document_hospitals')
    .select('id, name')
    .order('sort_order');

  if (error) {
    throw error;
  }

  const hospitals = ((data ?? []) as Array<{ id: string; name: string }>).map(
    (hospital) => ({ ...hospital, source: 'directory' as const }),
  );
  hospitalsCache = { expiresAt: Date.now() + HOSPITALS_CACHE_TTL_MS, hospitals };
  return hospitals;
}

export async function fetchHospitals(
  patientId: string,
): Promise<HospitalOption[]> {
  await ensureSecureReportSession();
  const [directoryHospitals, { data, error }] = await Promise.all([
    fetchDirectoryHospitals(),
    supabase
      .from('patient_document_hospitals')
      .select('id, name')
      .eq('patient_id', patientId)
      .order('name'),
  ]);

  if (error) {
    throw error;
  }

  const patientHospitals = (
    (data ?? []) as Array<{ id: string; name: string }>
  ).map((hospital) => ({ ...hospital, source: 'patient' as const }));
  return [...patientHospitals, ...directoryHospitals];
}

export async function createPatientDocumentHospital(
  patientId: string,
  name: string,
): Promise<HospitalOption> {
  const ownerUserId = await ensureSecureReportSession();
  const displayName = name.trim().replace(/\s+/g, ' ');
  if (
    displayName.length < 2 ||
    displayName.length > 120 ||
    !normalizeMedicineSearch(displayName)
  ) {
    throw new Error('Enter a valid hospital name.');
  }

  const { data, error } = await supabase
    .from('patient_document_hospitals')
    .upsert(
      {
        name: displayName,
        owner_user_id: ownerUserId,
        patient_id: patientId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id,patient_id,normalized_name' },
    )
    .select('id, name')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to save hospital.');
  }

  return {
    id: data.id,
    name: data.name,
    source: 'patient',
  };
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
  hospital: HospitalOption;
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
        hospital: input.hospital,
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
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from('patient-reports')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to open this report.');
  }

  signedUrlCache.set(storagePath, {
    expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
    url: data.signedUrl,
  });
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
        const { data, error } = await supabase
          .from('patient_reports')
          .delete()
          .eq('id', reportId)
          .select('id');
        if (error) {
          return error;
        }
        // RLS lets a delete "succeed" with zero rows affected instead of
        // erroring when the current session no longer owns the row (e.g. a
        // stale session from before login persistence was fixed). Treat
        // that silent no-op as a real failure so the row doesn't reappear
        // after the UI already showed it as deleted.
        if (!data || data.length === 0) {
          return new Error('The document record could not be deleted.');
        }
        return null;
      },
    },
    report,
  );
  if (report.storagePath) {
    signedUrlCache.delete(report.storagePath);
  }
}
