import React from 'react'
import Svg, { Circle, Path } from 'react-native-svg'

import { useTheme } from '@/constants/theme-context'

export type SocialBrand = 'apple' | 'google' | 'facebook'

interface SocialLogoProps {
  brand: SocialBrand
  size?: number
}

/**
 * Renders the official Apple, Google, or Facebook brand mark as an inline SVG.
 *
 * Apple uses the current theme's foreground colour so the silhouette stays
 * legible in both light and dark mode. Google uses its four-colour "G" mark.
 * Facebook uses the blue circle with a white "f" lock-up. All marks render at
 * a consistent visual weight inside a uniform container.
 */
export function SocialLogo({ brand, size = 20 }: SocialLogoProps) {
  const { palette } = useTheme()

  switch (brand) {
    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            fill={palette.textPrimary}
            d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
          />
        </Svg>
      )

    case 'google':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            fill="#4285F4"
            d="M23.06 12.25c0-.77-.07-1.53-.2-2.25H12v4.26h6.18c-.27 1.4-1.07 2.59-2.28 3.39v2.81h3.69c2.16-1.99 3.47-4.92 3.47-8.21z"
          />
          <Path
            fill="#34A853"
            d="M12 23c3.07 0 5.65-1.02 7.54-2.78l-3.69-2.81c-1.02.69-2.32 1.09-3.85 1.09-2.96 0-5.46-2-6.36-4.69H1.86v2.91A10.99 10.99 0 0 0 12 23z"
          />
          <Path
            fill="#FBBC05"
            d="M5.64 13.81c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18V6.54H1.86A10.99 10.99 0 0 0 1 12c0 1.79.43 3.48 1.18 4.98l3.46-3.17z"
          />
          <Path
            fill="#EA4335"
            d="M12 5.04c1.66 0 3.16.57 4.34 1.7l3.27-3.27C17.65 1.66 15.07 1 12 1 7.7 1 3.99 3.47 1.86 7.07l3.78 2.93C6.54 7.04 9.04 5.04 12 5.04z"
          />
        </Svg>
      )

    case 'facebook':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={11} fill="#1877F2" />
          <Path
            fill="#FFFFFF"
            d="M15.6 13.5l.5-3.2h-3.05V8.21c0-.88.43-1.74 1.81-1.74h1.4V3.74s-1.27-.22-2.49-.22c-2.54 0-4.2 1.54-4.2 4.32v2.46H6.78v3.2h2.79V21.5a11.18 11.18 0 0 0 3.48 0v-8z"
          />
        </Svg>
      )
  }
}
