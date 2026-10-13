import { StyleSheet } from 'react-native';

import { dashboardColors, dashboardRadii } from '../../dashboardTheme';

// Bigger, simpler text than the rest of the dashboard: many My Care
// readers are elderly.
export const careFonts = {
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const careShared = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderCurve: 'continuous',
    borderRadius: dashboardRadii.card,
    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    gap: 14,
    padding: 20,
  },
  cardTitle: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  body: {
    color: dashboardColors.text,
    fontFamily: careFonts.medium,
    fontSize: 17,
    lineHeight: 25,
  },
  muted: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
});
