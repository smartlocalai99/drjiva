import { describe, expect, it } from 'vitest';

import {
  buildReportPdfHtml,
  scanReportPages,
  type DocumentScannerAdapter,
} from './documentCapture';

function scannerReturning(
  status: 'cancel' | 'success',
  scannedImages: string[],
): DocumentScannerAdapter {
  return {
    async scanDocument() {
      return { scannedImages, status };
    },
  };
}

describe('scanReportPages', () => {
  it('returns null when the patient cancels scanning', async () => {
    await expect(
      scanReportPages(scannerReturning('cancel', [])),
    ).resolves.toBeNull();
  });

  it('returns captured base64 pages', async () => {
    await expect(
      scanReportPages(scannerReturning('success', ['page-one', 'page-two'])),
    ).resolves.toEqual(['page-one', 'page-two']);
  });

  it('rejects an empty successful scan', async () => {
    await expect(
      scanReportPages(scannerReturning('success', [])),
    ).rejects.toThrow('No document pages were captured.');
  });

  it('places every captured image on its own PDF page', () => {
    const html = buildReportPdfHtml(['page-one', 'page-two']);

    expect(html.match(/data:image\/jpeg;base64,/g)).toHaveLength(2);
    expect(html).toContain('data:image/jpeg;base64,page-one');
    expect(html).toContain('data:image/jpeg;base64,page-two');
  });
});
