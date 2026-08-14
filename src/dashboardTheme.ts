import type { TextStyle } from 'react-native';

// Scoped to the post-login dashboard only. The auth flow (src/theme.ts) has
// its own established blue and is left untouched so this redesign doesn't
// regress already-shipped screens.
export const dashboardColors = {
  bg: '#F8F9FB',
  card: '#FFFFFF',
  productImageBg: '#DADAD9',
  primary: '#2A6BA5',
  primaryDark: '#225684',
  primaryTint: '#EAF2F8',
  success: '#22C55E',
  successTint: '#E9F9EF',
  warning: '#F59E0B',
  warningTint: '#FFF7E8',
  error: '#EF4444',
  errorTint: '#FEF0F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#6B7280',
  track: '#E2E5EA',
  shadow: '#0F172A',
} as const;

export const dashboardRadii = {
  card: 24,
  button: 28,
  pill: 999,
  toggleTrack: 15,
  bellButton: 24,
} as const;

export const dashboardSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  gap: 16,
  pagePadding: 20,
  xl: 24,
  xxl: 32,
} as const;

export const dashboardLayout = {
  bellButtonSize: 48,
  dateCircleSize: 52,
  dateItemGap: 18,
  medicineIconSize: 44,
  medicineCardMinHeight: 110,
  toggleWidth: 52,
  toggleHeight: 30,
  toggleKnobSize: 24,
  floatingButtonHeight: 56,
  bottomNavHeight: 58,
  navBottomGap: 6,
} as const;

// Loaded in app/_layout.tsx via @expo-google-fonts/inter — the brief calls
// for SF Pro Display/Inter specifically, distinct from the auth flow's
// Manrope, so the dashboard reads as its own premium surface.
export const dashboardFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const dashboardTypography = {
  largeTitle: {
    fontFamily: dashboardFonts.semiBold,
    fontSize: 34,
    lineHeight: 40,
  },
  title: {
    fontFamily: dashboardFonts.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  cardTitle: {
    fontFamily: dashboardFonts.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: dashboardFonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: dashboardFonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    fontFamily: dashboardFonts.semiBold,
    fontSize: 16,
    lineHeight: 20,
  },
} satisfies Record<string, TextStyle>;
