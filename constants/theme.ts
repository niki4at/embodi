import { Platform } from 'react-native'

import { darkPalette, lightPalette } from './design'

export const Colors = {
  light: {
    text: lightPalette.textPrimary,
    background: lightPalette.bg,
    tint: lightPalette.primary,
    icon: lightPalette.textSecondary,
    tabIconDefault: lightPalette.textTertiary,
    tabIconSelected: lightPalette.primary,
  },
  dark: {
    text: darkPalette.textPrimary,
    background: darkPalette.bg,
    tint: darkPalette.primary,
    icon: darkPalette.textSecondary,
    tabIconDefault: darkPalette.textTertiary,
    tabIconSelected: darkPalette.primary,
  },
}

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})
