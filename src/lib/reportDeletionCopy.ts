import type { TranslationKey } from './i18n';

export function getReportDeletionMessageKey(
  storagePath: string | null,
): TranslationKey {
  return storagePath
    ? 'deleteDocumentMessage'
    : 'deleteLegacyDocumentMessage';
}
