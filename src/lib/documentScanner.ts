import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import {
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
} from 'react-native';

import {
  buildReportPdfHtml,
  scanReportPages,
  type DocumentScannerAdapter,
} from './documentCapture';
import {
  requestDocumentCameraPermission,
  type CameraPermissionResult,
} from './documentPermission';

const nativeScanner: DocumentScannerAdapter = {
  async scanDocument(options) {
    if (
      Platform.OS === 'web' ||
      TurboModuleRegistry.get('DocumentScanner') === null
    ) {
      throw new Error(
        'Document scanning requires the DrJiva development or production build.',
      );
    }

    // These two document packages are custom native modules and are not
    // included in Expo Go or web. Loading the scanner only when Scan is
    // pressed keeps the rest of the app usable in those environments.
    const {
      default: DocumentScanner,
      ResponseType,
      ScanDocumentResponseStatus,
    } = await import('react-native-document-scanner-plugin');
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

export function requestDocumentCameraAccess(): Promise<CameraPermissionResult> {
  return requestDocumentCameraPermission(Platform.OS, {
    request: () =>
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA),
  });
}

export async function recognizeFirstPage(base64Page: string): Promise<string> {
  const { default: TextRecognition } = await import(
    '@react-native-ml-kit/text-recognition'
  );
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
