/**
 * Bodfit design system: theme-aware tokens lifted from the bodyfyt Figma file
 * (nODLRMV0kddwStwQFgtYfk).
 *
 * The exported `palette` is the LIGHT theme. Dark mode is provided through
 * `darkPalette`; consumers that opt into theming should read from
 * `useThemedPalette()` (see `constants/theme-context.tsx`).
 *
 * Spacing, radius, typography, shadows, and motion are theme-agnostic.
 */

import { fonts } from './fonts'

/* ============================================================================
 * LIGHT THEME. Pure white paper, near-black ink, a single cool blue accent and
 * a lavender partner used for gradients and the coach voice. Surfaces are
 * separated by tone, not borders.
 * ============================================================================
 */
export const lightPalette = {
  bg: '#FFFFFF',
  bgElevated: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceAlt: '#EDEDF0',
  surfaceHigh: '#E2E2E7',
  border: '#E4E4E8',
  borderStrong: '#868686',
  divider: '#ECECEF',

  textPrimary: '#0B0B0D',
  textSecondary: '#868686',
  textTertiary: '#A6A6AB',
  textMuted: '#C8C8CD',
  textInverse: '#FFFFFF',

  primary: '#4B9EFE',
  primaryHover: '#3B8EF0',
  primaryMuted: 'rgba(75, 158, 254, 0.16)',
  primaryBorder: '#4B9EFE',

  /* lavender partner colour and the coach voice */
  accent: '#C991F1',
  accentMuted: 'rgba(201, 145, 241, 0.2)',
  coach: '#B751FF',
  coachMuted: 'rgba(233, 211, 249, 0.6)',

  success: '#34982B',
  successMuted: 'rgba(184, 255, 166, 0.55)',
  successSolid: '#DDF7D6',
  warning: '#FEAD4B',
  warningMuted: 'rgba(254, 173, 75, 0.22)',
  warningSolid: '#FCE7CA',
  danger: '#FE4B4B',
  dangerMuted: 'rgba(254, 75, 75, 0.14)',
  flare: '#FE4B96',
  flareMuted: 'rgba(254, 75, 150, 0.3)',

  /* pain scale (body map badges): yellow -> orange -> red */
  painMild: '#F9D65C',
  painModerate: '#FE8B5A',
  painSevere: '#FE4B6C',
  painMildSoft: 'rgba(249, 214, 92, 0.6)',
  painModerateSoft: 'rgba(254, 139, 90, 0.55)',
  painSevereSoft: 'rgba(254, 75, 108, 0.55)',

  /* energy scale dots: drained -> charged */
  energyDrained: '#F6D33C',
  energyLow: '#FEAD4B',
  energyOkay: '#5AD15A',
  energyGood: '#C991F1',
  energyCharged: '#FF8BEC',

  accentPurple: '#B751FF',
  accentTeal: '#2FC7B7',
  accentPink: '#FF8BEC',
  accentCoral: '#FE4B4B',

  white: '#FFFFFF',
  black: '#000000',
} as const

/* ============================================================================
 * DARK THEME. Ink surfaces with the same blue and lavender so the brand reads
 * identically in both modes.
 * ============================================================================
 */
export const darkPalette = {
  bg: '#0B0B0F',
  bgElevated: '#13131A',
  surface: '#17171F',
  surfaceAlt: '#1F1F29',
  surfaceHigh: '#2A2A36',
  border: '#26262F',
  borderStrong: '#4A4A56',
  divider: '#1C1C24',

  textPrimary: '#F7F7FA',
  textSecondary: '#9C9CA6',
  textTertiary: '#6E6E79',
  textMuted: '#4A4A55',
  textInverse: '#0B0B0F',

  primary: '#5FA9FF',
  primaryHover: '#4B9EFE',
  primaryMuted: 'rgba(95, 169, 255, 0.2)',
  primaryBorder: '#5FA9FF',

  accent: '#CFA0F5',
  accentMuted: 'rgba(201, 145, 241, 0.22)',
  coach: '#C57AFF',
  coachMuted: 'rgba(183, 81, 255, 0.2)',

  success: '#5FD65A',
  successMuted: 'rgba(95, 214, 90, 0.2)',
  successSolid: '#1B3A1E',
  warning: '#FFB85C',
  warningMuted: 'rgba(254, 173, 75, 0.22)',
  warningSolid: '#3A2E1A',
  danger: '#FF6B6B',
  dangerMuted: 'rgba(255, 107, 107, 0.18)',
  flare: '#FF6FAE',
  flareMuted: 'rgba(254, 75, 150, 0.28)',

  painMild: '#F9D65C',
  painModerate: '#FE8B5A',
  painSevere: '#FE4B6C',
  painMildSoft: 'rgba(249, 214, 92, 0.5)',
  painModerateSoft: 'rgba(254, 139, 90, 0.5)',
  painSevereSoft: 'rgba(254, 75, 108, 0.5)',

  energyDrained: '#F6D33C',
  energyLow: '#FEAD4B',
  energyOkay: '#5AD15A',
  energyGood: '#C991F1',
  energyCharged: '#FF8BEC',

  accentPurple: '#C57AFF',
  accentTeal: '#3FD9C9',
  accentPink: '#FF9DEF',
  accentCoral: '#FF6B6B',

  white: '#FFFFFF',
  black: '#000000',
} as const

export type Palette = { readonly [K in keyof typeof lightPalette]: string }

/**
 * Default static palette export used by the bulk of the codebase. We default to
 * LIGHT so that every screen that imports `palette` directly inherits the new
 * look without per-screen refactoring. Screens that need true theme awareness
 * should switch to `useThemedPalette()`.
 */
export const palette: Palette = lightPalette

/**
 * Brand gradients. `hero` is the Start orb and the primary gradient CTA;
 * `name` colours the greeting name on Home.
 */
export const gradients = {
  hero: ['#4B9EFE', '#C991F1'] as const,
  heroSoft: ['rgba(75,158,254,0.85)', 'rgba(201,145,241,0.85)'] as const,
  name: ['#449FFF', '#FF8BEC'] as const,
} as const

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 15,
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
 * Typography presets. Sora everywhere; `eyebrow` is the small tracked mono
 * label that heads every section in the Figma file.
 */
export const typography = {
  display: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
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
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  metric: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  button: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
} as const

/**
 * Static, low-cost shadows. Bodfit leans on tone rather than depth, so these
 * are soft and used sparingly (floating sheets, the tab island).
 */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0B0B0D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#0B0B0D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0B0B0D',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 10,
  },
  primary: {
    shadowColor: '#4B9EFE',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  primaryDark: {
    shadowColor: '#5FA9FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
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
