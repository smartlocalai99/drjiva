import { describe, expect, it } from 'vitest';

import { getReportDeletionMessageKey } from './reportDeletionCopy';

describe('getReportDeletionMessageKey', () => {
  it('warns when a legacy report has no storage object path', () => {
    expect(getReportDeletionMessageKey(null)).toBe(
      'deleteLegacyDocumentMessage',
    );
  });

  it('uses permanent PDF deletion copy for stored reports', () => {
    expect(getReportDeletionMessageKey('user/patient/report.pdf')).toBe(
      'deleteDocumentMessage',
    );
  });
});
