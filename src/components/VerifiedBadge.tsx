import { MaterialCommunityIcons } from '@expo/vector-icons';

import { dashboardColors } from '../dashboardTheme';

export function VerifiedBadge({ size = 17 }: { size?: number }) {
  return (
    <MaterialCommunityIcons
      accessibilityLabel="Verified phone number"
      color={dashboardColors.primary}
      name="check-decagram"
      size={size}
    />
  );
}
