import { requireOptionalNativeModule } from 'expo-modules-core';

// expo-*'s own native-module loaders (e.g. expo-location, expo-sharing,
// expo-web-browser, expo-image-manipulator) call expo-modules-core's
// *throwing* requireNativeModule internally, so wrapping `require('expo-x')`
// itself in try/catch still lets Metro/React Native surface an uncaught
// "Cannot find native module" error in dev before a native rebuild links it
// in — the throw happens, JS-level try/catch just isn't how that gets
// reported. requireOptionalNativeModule is the non-throwing variant these
// packages could have used; checking it first lets us skip calling
// `require('expo-x')` entirely when the module isn't linked yet, instead of
// triggering the throw at all.
export function isNativeModuleAvailable(nativeModuleName: string): boolean {
  try {
    return requireOptionalNativeModule(nativeModuleName) !== null;
  } catch {
    return false;
  }
}
