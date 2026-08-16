import type { NavTabKey } from '../components/dashboard/BottomNav';

export function getTabRoute(
  tab: NavTabKey,
): '/home' | '/documents' | '/health-feed' | '/camps' | '/shop' | null {
  switch (tab) {
    case 'today':
      return '/home';
    case 'documents':
      return '/documents';
    case 'healthFeed':
      return '/health-feed';
    case 'camps':
      return '/camps';
    case 'shop':
      return '/shop';
    default:
      return null;
  }
}
