const { existsSync } = require('node:fs');
const { join } = require('node:path');

const MEDICINE_REMINDER_CHANNEL = 'medicine-reminders';
// Android notification channels keep their original sound forever. A new id
// makes devices that already created the old channel adopt the bundled sound.
const MEDICINE_REMINDER_SOUND_CHANNEL = 'medicine-reminders-loud-v3';
const ORDER_SUCCESS_CHANNEL = 'order-success-v1';
// iOS plays the bundled sound file by its exact filename; Android plays it by
// the res/raw resource name the expo-notifications plugin derives from the
// filename minus its extension.
const IOS_SOUND_PATH = './assets/sounds/reminder.caf';
const IOS_SOUND_FILE = 'reminder.caf';
const ANDROID_SOUND_PATH = './assets/sounds/rec.wav';
const ANDROID_SOUND_RESOURCE = 'rec';
const ORDER_SUCCESS_SOUND_PATH = './assets/sounds/success.wav';
const ORDER_SUCCESS_SOUND_FILE = 'success.wav';
const ORDER_SUCCESS_SOUND_RESOURCE = 'success';

/** @param {import('expo/config').ConfigContext} context */
module.exports = ({ config }) => {
  const hasIOSSound = existsSync(join(__dirname, IOS_SOUND_PATH));
  const hasAndroidSound = existsSync(join(__dirname, ANDROID_SOUND_PATH));
  const hasOrderSuccessSound = existsSync(
    join(__dirname, ORDER_SUCCESS_SOUND_PATH),
  );
  const defaultChannel = hasAndroidSound
    ? MEDICINE_REMINDER_SOUND_CHANNEL
    : MEDICINE_REMINDER_CHANNEL;
  const soundPaths = [
    ...(hasIOSSound ? [IOS_SOUND_PATH] : []),
    ...(hasAndroidSound ? [ANDROID_SOUND_PATH] : []),
    ...(hasOrderSuccessSound ? [ORDER_SUCCESS_SOUND_PATH] : []),
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
        (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-video',
    )
  ) {
    plugins.push('expo-video');
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
      orderSuccessChannel: ORDER_SUCCESS_CHANNEL,
      orderSuccessSoundAndroid: hasOrderSuccessSound
        ? ORDER_SUCCESS_SOUND_RESOURCE
        : false,
      orderSuccessSoundIOS: hasOrderSuccessSound
        ? ORDER_SUCCESS_SOUND_FILE
        : false,
    },
    plugins,
  };
};
