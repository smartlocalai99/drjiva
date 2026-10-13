import type { NavTabKey } from '../components/dashboard/BottomNav';

export function getTabRoute(
  tab: NavTabKey,
): '/home' | '/my-care' | '/health-feed' | '/camps' | '/shop' | null {
  switch (tab) {
    case 'today':
      return '/home';
    case 'myCare':
      return '/my-care';
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
