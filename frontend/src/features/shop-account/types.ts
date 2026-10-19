export const ACCOUNT_TABS = [
  'overview',
  'orders',
  'bookings',
  'saved',
  'addresses',
  'profile',
  'settings',
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];
