export type DocumentScannerResult = {
  scannedImages: string[];
  status: 'cancel' | 'success';
};

export type DocumentScannerAdapter = {
  scanDocument: (options: {
    croppedImageQuality: number;
    maxNumDocuments: number;
    responseType: 'base64';
  }) => Promise<DocumentScannerResult>;
};

export async function scanReportPages(
  scanner: DocumentScannerAdapter,
): Promise<string[] | null> {
  const result = await scanner.scanDocument({
    croppedImageQuality: 90,
    maxNumDocuments: 10,
    responseType: 'base64',
  });

  if (result.status === 'cancel') {
    return null;
  }
  if (result.scannedImages.length === 0) {
    throw new Error('No document pages were captured.');
  }

  return result.scannedImages;
}

export function buildReportPdfHtml(base64Pages: string[]): string {
  if (base64Pages.length === 0) {
    throw new Error('No document pages were captured.');
  }

  const pages = base64Pages
    .map(
      (page) =>
        `<section class="page"><img src="data:image/jpeg;base64,${page}" /></section>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; size: A4; }
      html, body { margin: 0; padding: 0; }
      .page {
        align-items: center;
        background: #ffffff;
        box-sizing: border-box;
        break-after: page;
        display: flex;
        height: 297mm;
        justify-content: center;
        overflow: hidden;
        padding: 3mm;
        page-break-after: always;
        width: 210mm;
      }
      .page:last-child { break-after: auto; page-break-after: auto; }
      img {
        display: block;
        filter: contrast(1.16) brightness(1.06) saturate(0.35);
        height: auto;
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
        width: auto;
      }
    </style>
  </head>
  <body>${pages}</body>
</html>`;
}
