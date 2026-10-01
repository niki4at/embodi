/**
 * Font family tokens used across the app. Sora carries every headline and
 * body string (it is the only humanist face in the Bodfit Figma file); Intel
 * One Mono (the file's mono) handles the small uppercase eyebrow labels (TODAY'S CONTEXT, SLEEP,
 * WARM UP) that give the design its editorial rhythm; Archivo Black is used
 * once for the Challenges masthead. The values here are the font names that
 * `useFonts` registers in the root layout.
 */
export const fonts = {
  displayBold: 'Sora_700Bold',
  displayExtraBold: 'Sora_800ExtraBold',
  displaySemiBold: 'Sora_600SemiBold',
  displayRegular: 'Sora_400Regular',
  uiBold: 'Sora_700Bold',
  uiSemiBold: 'Sora_600SemiBold',
  uiMedium: 'Sora_500Medium',
  uiRegular: 'Sora_400Regular',
  mono: 'IntelOneMono_400Regular',
  monoMedium: 'IntelOneMono_500Medium',
  monoBold: 'IntelOneMono_700Bold',
  masthead: 'ArchivoBlack_400Regular',
} as const

export type FontToken = (typeof fonts)[keyof typeof fonts]
