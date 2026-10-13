import { StyleSheet } from 'react-native';

import { dashboardColors, dashboardRadii } from '../../dashboardTheme';

// Bigger, simpler text than the rest of the dashboard: many My Care
// readers are elderly.
export const careFonts = {
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const careStateColors = {
  done: { dot: dashboardColors.success, text: '#15803D', tint: dashboardColors.successTint },
  due_now: { dot: dashboardColors.primary, text: dashboardColors.primary, tint: dashboardColors.primaryTint },
  pending: { dot: dashboardColors.warning, text: '#B45309', tint: dashboardColors.warningTint },
  upcoming: { dot: '#94A3B8', text: dashboardColors.textMuted, tint: '#F1F5F9' },
  not_needed: { dot: '#94A3B8', text: dashboardColors.textMuted, tint: '#F1F5F9' },
  optional: { dot: '#CBD5E1', text: dashboardColors.textMuted, tint: '#F8FAFC' },
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
