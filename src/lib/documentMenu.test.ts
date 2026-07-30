import { describe, expect, it } from 'vitest';

import {
  getDocumentPrimaryAction,
  getReportTypeTranslationKey,
} from './documentMenu';

describe('getDocumentPrimaryAction', () => {
  it('uses scanning language and iconography', () => {
    expect(getDocumentPrimaryAction()).toEqual({
      icon: 'scan-outline',
      label: 'Scan Document',
    });
  });
});

describe('getReportTypeTranslationKey', () => {
  it('maps canonical database values to localized copy keys', () => {
    expect(getReportTypeTranslationKey('Lab Report')).toBe('labReport');
    expect(getReportTypeTranslationKey('OP Consultation')).toBe(
      'opConsultation',
    );
    expect(getReportTypeTranslationKey('Medical Bill')).toBe('medicalBill');
  });
});
