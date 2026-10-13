import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Alert, StyleSheet, Text } from 'react-native';

import { dashboardColors, dashboardRadii } from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

export function CallButton({ label, number }: { label: string; number: string }) {
  const call = () => {
    void Linking.openURL(`tel:${number}`).catch(() => Alert.alert(label, number));
  };
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={call}
      style={[styles.button, styles.outline]}
    >
      <Ionicons color={dashboardColors.primary} name="call" size={20} />
      <Text style={styles.text}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  outline: {
    backgroundColor: dashboardColors.primaryTint,
  },
  text: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
});
