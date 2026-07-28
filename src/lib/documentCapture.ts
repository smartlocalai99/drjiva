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
        break-after: page;
        display: flex;
        height: 842px;
        justify-content: center;
        overflow: hidden;
        page-break-after: always;
        width: 595px;
      }
      .page:last-child { break-after: auto; page-break-after: auto; }
      img { height: 100%; object-fit: contain; width: 100%; }
    </style>
  </head>
  <body>${pages}</body>
</html>`;
}
