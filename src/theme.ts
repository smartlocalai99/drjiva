import type { TextStyle } from 'react-native';

export const colors = {
  primary: '#2E7EBC',
  primaryDark: '#256596',
  onPrimary: '#FFFFFF',
  bg: '#FFFFFF',
  text: '#1B2D35',
  textMuted: '#667085',
  border: '#E2E8EC',
  borderFocus: '#2E7EBC',
  tileTint: '#EAF3F8',
  error: '#D92D20',
  success: '#12B76A',
  shadow: '#172B34',
  focusShadow: 'rgba(46, 126, 188, 0.18)',
  transparentWhite: 'rgba(255, 255, 255, 0)',
} as const;

export const radii = {
  tile: 26,
  input: 16,
  button: 16,
  logo: 24,
  otpBox: 16,
  round: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
  teluguRegular: 'NotoSansTelugu_400Regular',
  teluguBold: 'NotoSansTelugu_700Bold',
} as const;

export const typography = {
  headline: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  telugu: {
    fontFamily: fonts.teluguRegular,
    fontSize: 15,
    lineHeight: 24,
  },
  button: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  input: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  helper: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
} satisfies Record<string, TextStyle>;

export const layout = {
  contentPadding: spacing.xl,
  inputHeight: 58,
  buttonHeight: 56,
  logoSize: 116,
  backButtonSize: 40,
  marqueeSpeed: 28,
  tileGap: spacing.md,
  marqueeFadeHeight: 56,
} as const;
