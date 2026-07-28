export type AccountMenuItem = {
  key: 'profile' | 'notifications' | 'language';
};

const ACCOUNT_MENU_ITEMS: readonly AccountMenuItem[] = [
  { key: 'profile' },
  { key: 'notifications' },
  { key: 'language' },
];

export function getAccountMenuItems(): readonly AccountMenuItem[] {
  return ACCOUNT_MENU_ITEMS;
}
