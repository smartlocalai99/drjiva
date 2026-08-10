import * as Linking from 'expo-linking';

import { openDocumentInApp } from './documentActions';

export const TERMS_AND_CONDITIONS_URL =
  'https://smartlocalai99.github.io/drjiva/terms.html';
export const PRIVACY_POLICY_URL =
  'https://smartlocalai99.github.io/drjiva/privacy.html';
export const SUPPORT_URL =
  'https://smartlocalai99.github.io/drjiva/support.html';

export async function openLegalPage(url: string): Promise<void> {
  const openedInApp = await openDocumentInApp(url).catch(() => false);
  if (openedInApp) {
    return;
  }

  await Linking.openURL(url);
}

export function getAccountDeletionEmailUrl(phone: string): string {
  const subject = encodeURIComponent('Delete my Dr Jiva account');
  const body = encodeURIComponent(
    `Hello Dr Jiva Support,\n\nI want to delete my Dr Jiva account and associated data.\n\nRegistered mobile number: +91 ${phone}\n\nPlease tell me the verification steps.`,
  );

  return `mailto:support@smartlocalai.in?subject=${subject}&body=${body}`;
}
