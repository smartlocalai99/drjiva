import { describe, expect, it } from 'vitest';

import {
  classifyDocument,
  type HospitalOption,
  validateReportMetadata,
} from './documentClassifier';

const HOSPITALS: HospitalOption[] = [
  { id: 'hospital-1', name: 'City Hospital', source: 'directory' },
  {
    id: 'hospital-2',
    name: 'Shankar Gastro Hospital',
    source: 'patient',
  },
];

describe('classifyDocument', () => {
  it.each([
    ['Rx prescription tablet dosage', 'Prescription'],
    ['OP consultation chief complaint diagnosis', 'OP Consultation'],
    ['Laboratory blood haemoglobin result', 'Lab Report'],
    ['Radiology CT scan imaging report', 'Imaging'],
    ['Discharge summary admission discharged', 'Discharge Summary'],
    ['Hospital invoice medical bill amount paid', 'Medical Bill'],
  ] as const)('classifies "%s" as %s', (text, expectedType) => {
    expect(classifyDocument(text, []).reportType).toBe(expectedType);
  });

  it('requires manual type selection for unknown or tied text', () => {
    expect(classifyDocument('follow up document', []).reportType).toBeNull();
    expect(
      classifyDocument('prescription laboratory', []).reportType,
    ).toBeNull();
  });

  it('matches the longest hospital name in OCR text', () => {
    expect(
      classifyDocument(
        'SHANKAR GASTRO HOSPITAL patient report',
        HOSPITALS,
      ).hospital,
    ).toEqual(HOSPITALS[1]);
  });
});

describe('validateReportMetadata', () => {
  it('requires hospital and report type selections', () => {
    expect(
      validateReportMetadata({ hospitalId: null, reportType: null }),
    ).toBe('Choose a hospital.');
    expect(
      validateReportMetadata({
        hospitalId: 'hospital-1',
        reportType: null,
      }),
    ).toBe('Choose a report type.');
    expect(
      validateReportMetadata({
        hospitalId: 'hospital-1',
        reportType: 'Lab Report',
      }),
    ).toBeNull();
  });
});
