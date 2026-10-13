import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Alert, StyleSheet, Text } from 'react-native';

import { dashboardColors, dashboardRadii } from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

export function CallButton({ label, number, tone = 'outline' }: { label: string; number: string; tone?: 'outline' | 'danger' }) {
  const call = () => {
    void Linking.openURL(`tel:${number}`).catch(() => Alert.alert(label, number));
  };
  const danger = tone === 'danger';
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={call}
      style={[styles.button, danger ? styles.danger : styles.outline]}
    >
      <Ionicons color={danger ? '#FFFFFF' : dashboardColors.primary} name="call" size={20} />
      <Text style={[styles.text, danger && styles.dangerText]}>{label}</Text>
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
  danger: {
    backgroundColor: '#DC2626',
  },
  text: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
  dangerText: {
    color: '#FFFFFF',
  },
});
