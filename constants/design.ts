/**
 * Embodi design system — Figma-aligned, theme-aware tokens.
 *
 * The exported `palette` is the LIGHT theme (matches the Figma onboarding screen).
 * Dark mode is provided through `darkPalette`; consumers that opt into theming
 * should read from `useThemedPalette()` (see `constants/theme-context.tsx`).
 *
 * Spacing, radius, typography, shadows, and motion are theme-agnostic.
 */

import { fonts } from './fonts'

/* ============================================================================
 * LIGHT THEME — matches the Figma "Embody" onboarding (warm off-white surfaces
 * with confident coral accent and bold dark navy headlines).
 * ============================================================================
 */
export const lightPalette = {
  bg: '#FAFAF8',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F0',
  surfaceHigh: '#EDEDE7',
  border: '#E6E4DE',
  borderStrong: '#79747E',
  divider: '#EFEDE7',

  textPrimary: '#1E2430',
  textSecondary: '#687083',
  textTertiary: '#9499A7',
  textMuted: '#B9BCC6',
  textInverse: '#FFFFFF',

  primary: '#FF6B6B',
  primaryHover: '#F2554F',
  primaryMuted: 'rgba(255, 107, 107, 0.12)',
  primaryBorder: 'rgba(255, 107, 107, 0.35)',

  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.16)',
  successSolid: '#DCF6E5',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.18)',
  danger: '#FF6B6B',
  dangerMuted: 'rgba(255, 107, 107, 0.14)',

  /* pain heat-map gradient pulled from the Figma Make rating page */
  painMild: '#5EEAD4',
  painModerate: '#C4B5FD',
  painSevere: '#FB7185',
  painMildSoft: 'rgba(94, 234, 212, 0.55)',
  painModerateSoft: 'rgba(196, 181, 253, 0.55)',
  painSevereSoft: 'rgba(251, 113, 133, 0.65)',

  accentPurple: '#8B5CF6',
  accentTeal: '#14B8A6',
  accentPink: '#EC4899',
  accentCoral: '#FF6B6B',

  white: '#FFFFFF',
  black: '#000000',
} as const

/* ============================================================================
 * DARK THEME — refined ink surfaces with the same coral accent so the brand
 * stays consistent across modes.
 * ============================================================================
 */
export const darkPalette = {
  bg: '#0E1014',
  bgElevated: '#161922',
  surface: '#1A1D27',
  surfaceAlt: '#22252F',
  surfaceHigh: '#2C2F3A',
  border: '#2D3140',
  borderStrong: '#3F4456',
  divider: '#1F2230',

  textPrimary: '#F5F6FA',
  textSecondary: '#A8ADBE',
  textTertiary: '#6F7488',
  textMuted: '#4A4E5E',
  textInverse: '#0E1014',

  primary: '#FF7A7A',
  primaryHover: '#FF6363',
  primaryMuted: 'rgba(255, 122, 122, 0.18)',
  primaryBorder: 'rgba(255, 122, 122, 0.45)',

  success: '#34D399',
  successMuted: 'rgba(52, 211, 153, 0.18)',
  successSolid: '#1B3A37',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.18)',
  danger: '#FF7A7A',
  dangerMuted: 'rgba(255, 122, 122, 0.18)',

  painMild: '#5EEAD4',
  painModerate: '#C4B5FD',
  painSevere: '#FB7185',
  painMildSoft: 'rgba(94, 234, 212, 0.45)',
  painModerateSoft: 'rgba(196, 181, 253, 0.4)',
  painSevereSoft: 'rgba(251, 113, 133, 0.55)',

  accentPurple: '#A78BFA',
  accentTeal: '#2DD4BF',
  accentPink: '#F472B6',
  accentCoral: '#FF7A7A',

  white: '#FFFFFF',
  black: '#000000',
} as const

export type Palette = { readonly [K in keyof typeof lightPalette]: string }

/**
 * Default static palette export used by the bulk of the codebase. We default to
 * LIGHT so that every screen that imports `palette` directly inherits the new
 * Figma-aligned look without per-screen refactoring. Screens that need true
 * theme awareness should switch to `useThemedPalette()`.
 */
export const palette: Palette = lightPalette

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const

/**
 * Typography presets aligned with the Figma design system. Sora is the
 * editorial / display face, Plus Jakarta Sans handles UI labels and buttons.
 * Each preset bakes the font family in so consumers can spread the preset
 * directly without tracking which family applies.
 */
export const typography = {
  display: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: fonts.uiRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    lineHeight: 22,
  },
  small: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  smallStrong: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  button: {
    fontFamily: fonts.uiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
} as const

/**
 * Static, low-cost shadows. Light mode uses warmer, softer shadows to keep
 * the surfaces airy; dark mode tones them down so they read on dark surfaces.
 */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#1E2430',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1E2430',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1E2430',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  primary: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  primaryDark: {
    shadowColor: '#FF7A7A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
} as const

export const motion = {
  duration: {
    quick: 180,
    base: 240,
    slow: 360,
  },
  spring: {
    damping: 18,
    stiffness: 220,
    mass: 0.6,
  },
} as const

export type Radius = typeof radius
export type Spacing = typeof spacing
export type Typography = typeof typography
