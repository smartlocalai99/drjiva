const { existsSync } = require('node:fs');
const { join } = require('node:path');

const MEDICINE_REMINDER_CHANNEL = 'medicine-reminders';
const MEDICINE_REMINDER_SOUND_CHANNEL = 'medicine-reminders-voice-v1';
// iOS plays the bundled sound file by its exact filename; Android plays it by
// the res/raw resource name the expo-notifications plugin derives from the
// filename minus its extension.
const IOS_SOUND_PATH = './assets/sounds/reminder.caf';
const IOS_SOUND_FILE = 'reminder.caf';
const ANDROID_SOUND_PATH = './assets/sounds/rec.mp3';
const ANDROID_SOUND_RESOURCE = 'rec';

/** @param {import('expo/config').ConfigContext} context */
module.exports = ({ config }) => {
  const hasIOSSound = existsSync(join(__dirname, IOS_SOUND_PATH));
  const hasAndroidSound = existsSync(join(__dirname, ANDROID_SOUND_PATH));
  const defaultChannel = hasAndroidSound
    ? MEDICINE_REMINDER_SOUND_CHANNEL
    : MEDICINE_REMINDER_CHANNEL;
  const soundPaths = [
    ...(hasIOSSound ? [IOS_SOUND_PATH] : []),
    ...(hasAndroidSound ? [ANDROID_SOUND_PATH] : []),
  ];
  const plugins = (config.plugins ?? []).map((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    if (pluginName !== 'expo-notifications') {
      return plugin;
    }

    const currentOptions =
      Array.isArray(plugin) && typeof plugin[1] === 'object'
        ? plugin[1]
        : {};
    return [
      'expo-notifications',
      {
        ...currentOptions,
        defaultChannel,
        ...(soundPaths.length > 0 ? { sounds: soundPaths } : {}),
      },
    ];
  });
  if (
    !plugins.some(
      (plugin) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) ===
        '@react-native-community/datetimepicker',
    )
  ) {
    plugins.push('@react-native-community/datetimepicker');
  }
  if (
    !plugins.some(
      (plugin) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-audio',
    )
  ) {
    plugins.push('expo-audio');
  }
  if (
    !plugins.some(
      (plugin) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-asset',
    )
  ) {
    plugins.push('expo-asset');
  }
  if (
    !plugins.some(
      (plugin) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-dev-client',
    )
  ) {
    plugins.push([
      'expo-dev-client',
      {
        launchMode: 'launcher',
      },
    ]);
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      medicineReminderChannel: defaultChannel,
      medicineReminderSoundAndroid: hasAndroidSound
        ? ANDROID_SOUND_RESOURCE
        : false,
      medicineReminderSoundIOS: hasIOSSound ? IOS_SOUND_FILE : false,
    },
    plugins,
  };
};
