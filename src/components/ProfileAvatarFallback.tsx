import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';

type ProfileAvatarFallbackProps = {
  size?: number;
};

export function ProfileAvatarFallback({
  size = 40,
}: ProfileAvatarFallbackProps) {
  return (
    <View
      style={[
        styles.container,
        { borderRadius: size / 2, height: size, width: size },
      ]}
    >
      <Ionicons
        color={dashboardColors.primary}
        name="person-outline"
        size={Math.round(size * 0.48)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    justifyContent: 'center',
  },
});
