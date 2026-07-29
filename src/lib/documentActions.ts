import { File, Paths } from 'expo-file-system';

// Loaded lazily (not at module scope) so importing this file can't crash
// app boot when the native module hasn't been compiled into the installed
// binary yet — see expoAddressLocation.ts for the same pattern and why it
// matters with expo-router's eager route loading.
function loadWebBrowser(): typeof import('expo-web-browser') | null {
  try {
    return require('expo-web-browser') as typeof import('expo-web-browser');
  } catch {
    return null;
  }
}

function loadSharing(): typeof import('expo-sharing') | null {
  try {
    return require('expo-sharing') as typeof import('expo-sharing');
  } catch {
    return null;
  }
}

export async function openDocumentInApp(url: string): Promise<boolean> {
  const WebBrowser = loadWebBrowser();
  if (!WebBrowser) {
    return false;
  }
  await WebBrowser.openBrowserAsync(url);
  return true;
}

export async function shareDocument(url: string): Promise<boolean> {
  const Sharing = loadSharing();
  if (!Sharing || !(await Sharing.isAvailableAsync())) {
    return false;
  }

  const file = await File.downloadFileAsync(url, Paths.cache);
  try {
    await Sharing.shareAsync(file.uri, { UTI: 'com.adobe.pdf' });
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
  return true;
}
