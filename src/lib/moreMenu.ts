export type AccountMenuItem = {
  key: 'profile' | 'notificationTimings' | 'language';
};

const ACCOUNT_MENU_ITEMS: readonly AccountMenuItem[] = [
  { key: 'profile' },
  { key: 'notificationTimings' },
  { key: 'language' },
];

export function getAccountMenuItems(): readonly AccountMenuItem[] {
  return ACCOUNT_MENU_ITEMS;
}
