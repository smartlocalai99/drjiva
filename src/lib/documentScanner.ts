import TextRecognition from '@react-native-ml-kit/text-recognition';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

import {
  buildReportPdfHtml,
  scanReportPages,
  type DocumentScannerAdapter,
} from './documentCapture';

const nativeScanner: DocumentScannerAdapter = {
  async scanDocument(options) {
    const result = await DocumentScanner.scanDocument({
      croppedImageQuality: options.croppedImageQuality,
      maxNumDocuments: options.maxNumDocuments,
      responseType: ResponseType.Base64,
    });

    return {
      scannedImages: result.scannedImages ?? [],
      status:
        result.status === ScanDocumentResponseStatus.Cancel
          ? 'cancel'
          : 'success',
    };
  },
};

function temporaryImageName(): string {
  return `drjiva-ocr-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.jpg`;
}

export function scanDocuments(): Promise<string[] | null> {
  return scanReportPages(nativeScanner);
}

export async function recognizeFirstPage(base64Page: string): Promise<string> {
  const image = new File(Paths.cache, temporaryImageName());
  image.create({ intermediates: true, overwrite: true });
  image.write(base64Page, { encoding: 'base64' });

  try {
    const result = await TextRecognition.recognize(image.uri);
    return result.text;
  } finally {
    if (image.exists) {
      image.delete();
    }
  }
}

export async function createReportPdf(base64Pages: string[]): Promise<string> {
  const result = await Print.printToFileAsync({
    height: 842,
    html: buildReportPdfHtml(base64Pages),
    margins: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 595,
  });

  if (!result.uri) {
    throw new Error('Unable to create the report PDF.');
  }

  return result.uri;
}
