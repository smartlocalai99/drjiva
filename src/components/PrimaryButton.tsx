import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { colors, layout, radii, typography } from '../theme';
import { PressableScale } from './PressableScale';

export interface PrimaryButtonProps {
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PrimaryButton({
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  onPress,
  style,
  testID,
}: PrimaryButtonProps) {
  const interactionDisabled = disabled || loading;

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        busy: loading,
        disabled: interactionDisabled,
      }}
      backgroundColor={colors.primary}
      disabled={interactionDisabled}
      onPress={onPress}
      pressedBackgroundColor={colors.primaryDark}
      style={[styles.button, style, disabled && styles.disabled]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityElementsHidden
          color={colors.onPrimary}
        />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.button,
    height: layout.buttonHeight,
    justifyContent: 'center',
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...typography.button,
    color: colors.onPrimary,
    textAlign: 'center',
  },
});
