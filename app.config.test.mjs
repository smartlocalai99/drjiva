import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const appJson = require('./app.json');
const createConfig = require('./app.config.js');

describe('app config medicine reminder sound', () => {
  it('exposes the bundled reminder.caf sound to the notification scheduler', () => {
    const config = createConfig({ config: appJson.expo });
    const notificationsPlugin = config.plugins.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    );

    expect(config.extra.medicineReminderSound).toBe('reminder.caf');
    expect(notificationsPlugin?.[1]?.sounds).toContain(
      './assets/sounds/reminder.caf',
    );
  });
});
