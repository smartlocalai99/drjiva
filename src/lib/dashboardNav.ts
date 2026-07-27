import type { NavTabKey } from '../components/dashboard/BottomNav';

export function getTabRoute(
  tab: NavTabKey,
): '/home' | '/documents' | '/shop' | '/more' | null {
  switch (tab) {
    case 'today':
      return '/home';
    case 'documents':
      return '/documents';
    case 'shop':
      return '/shop';
    case 'more':
      return '/more';
    default:
      return null;
  }
}
