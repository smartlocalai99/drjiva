import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';

export function VerifiedBadge({
  accessibilityLabel = 'Verified phone number',
  size = 17,
}: {
  accessibilityLabel?: string;
  size?: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{ alignItems: 'center', height: size, justifyContent: 'center', width: size }}
    >
      <MaterialCommunityIcons color={dashboardColors.primary} name="decagram" size={size} />
      <MaterialCommunityIcons
        color="#FFFFFF"
        name="check-bold"
        pointerEvents="none"
        size={Math.max(9, Math.round(size * 0.62))}
        style={{ position: 'absolute' }}
      />
    </View>
  );
}
