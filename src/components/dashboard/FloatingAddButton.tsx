import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text } from 'react-native';

import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardTypography,
} from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';

type FloatingAddButtonProps = {
  bottomOffset: number;
  onPress: () => void;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function FloatingAddButton({
  bottomOffset,
  icon = 'add',
  label = 'Add Medicine',
  onPress,
}: FloatingAddButtonProps) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );
    onPress();
  };

  return (
    <PressableScale
      accessibilityLabel={label}
      android_ripple={{ color: '#FFFFFF33' }}
      onPress={handlePress}
      pressedScale={0.95}
      style={[styles.wrapper, { bottom: bottomOffset }]}
    >
      <LinearGradient
        colors={[dashboardColors.primary, dashboardColors.primaryDark]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <Ionicons color="#FFFFFF" name={icon} size={22} />
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: dashboardRadii.button,
    height: dashboardLayout.floatingButtonHeight,
    position: 'absolute',
    right: 20,
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: dashboardColors.primary,
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
    }),
  },
  gradient: {
    alignItems: 'center',
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: 8,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  label: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
});
