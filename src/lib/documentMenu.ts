import type { ReportType } from './documentClassifier';
import type { TranslationKey } from './i18n';

const REPORT_TYPE_TRANSLATION_KEYS: Record<
  ReportType,
  TranslationKey
> = {
  'Discharge Summary': 'dischargeSummary',
  Imaging: 'imaging',
  'Lab Report': 'labReport',
  'OP Consultation': 'opConsultation',
  Other: 'other',
  Prescription: 'prescription',
};

export function getReportTypeTranslationKey(
  reportType: ReportType,
): TranslationKey {
  return REPORT_TYPE_TRANSLATION_KEYS[reportType];
}

export function getDocumentPrimaryAction(): {
  icon: 'scan-outline';
  label: 'Scan Document';
} {
  return {
    icon: 'scan-outline',
    label: 'Scan Document',
  };
}
