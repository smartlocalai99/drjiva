const { existsSync } = require('node:fs');
const { join } = require('node:path');

const MEDICINE_REMINDER_CHANNEL = 'medicine-reminders';
const MEDICINE_REMINDER_SOUND_CHANNEL = 'medicine-reminders-voice-v1';
const MEDICINE_REMINDER_SOUND_PATH =
  './assets/sounds/medicine-reminder.wav';
const MEDICINE_REMINDER_SOUND_FILE = 'medicine-reminder.wav';

/** @param {import('expo/config').ConfigContext} context */
module.exports = ({ config }) => {
  const hasMedicineReminderSound = existsSync(
    join(__dirname, MEDICINE_REMINDER_SOUND_PATH),
  );
  const defaultChannel = hasMedicineReminderSound
    ? MEDICINE_REMINDER_SOUND_CHANNEL
    : MEDICINE_REMINDER_CHANNEL;
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
        ...(hasMedicineReminderSound
          ? { sounds: [MEDICINE_REMINDER_SOUND_PATH] }
          : {}),
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
      medicineReminderSound: hasMedicineReminderSound
        ? MEDICINE_REMINDER_SOUND_FILE
        : false,
    },
    plugins,
  };
};
