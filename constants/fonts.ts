/**
 * Font family tokens used across the app. Sora is the headline / wordmark
 * face from the Figma design; Plus Jakarta Sans handles UI labels and
 * buttons. The values here are the font names that `Font.loadAsync` registers
 * via `useFonts` in the root layout.
 */
export const fonts = {
  displayBold: 'Sora_700Bold',
  displayExtraBold: 'Sora_800ExtraBold',
  displaySemiBold: 'Sora_600SemiBold',
  displayRegular: 'Sora_400Regular',
  uiBold: 'PlusJakartaSans_700Bold',
  uiSemiBold: 'PlusJakartaSans_600SemiBold',
  uiMedium: 'PlusJakartaSans_500Medium',
  uiRegular: 'PlusJakartaSans_400Regular',
} as const

export type FontToken = (typeof fonts)[keyof typeof fonts]
