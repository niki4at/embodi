import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg'

import { gradients } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'

/**
 * Bodfit mark. A gradient tile carrying a geometric lowercase "b": a stem, a
 * ring for the bowl, and a small offset "pulse" dot that reads as movement
 * without leaning on dumbbells or flexing arms. Built from primitives so it
 * renders crisply at any size on iOS, Android, and web.
 */
export function BodfitMark({
  size = 40,
  radius,
  monochrome = false,
  style,
}: {
  size?: number
  radius?: number
  monochrome?: boolean
  style?: ViewStyle
}) {
  const { palette } = useTheme()
  const r = radius ?? size * 0.28
  const ink = monochrome ? palette.textPrimary : '#FFFFFF'

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityRole="image"
      accessibilityLabel="Bodfit"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bodfit-tile" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradients.hero[0]} />
            <Stop offset="1" stopColor={gradients.hero[1]} />
          </LinearGradient>
        </Defs>
        {monochrome ? null : (
          <Rect
            x="0"
            y="0"
            width="100"
            height="100"
            rx={(r / size) * 100}
            fill="url(#bodfit-tile)"
          />
        )}
        <Rect x="27" y="20" width="14" height="60" rx="7" fill={ink} />
        <Circle
          cx="52"
          cy="61"
          r="15"
          stroke={ink}
          strokeWidth="12"
          fill="none"
        />
        <Circle cx="72" cy="27" r="6" fill={ink} />
      </Svg>
    </View>
  )
}

const HERO_SIZES = {
  sm: { mark: 26, text: 22 },
  md: { mark: 34, text: 30 },
  lg: { mark: 46, text: 40 },
} as const

/**
 * Bodfit wordmark. `hero` pairs the mark with a Sora ExtraBold lowercase
 * wordmark ("fit" picks up the brand blue). `header` is the small tracked mono
 * lockup that sits top-right on every screen in the Figma file.
 */
export function BodfitWordmark({
  variant = 'hero',
  size = 'md',
  align = 'left',
  showMark = true,
}: {
  variant?: 'hero' | 'header'
  size?: keyof typeof HERO_SIZES
  align?: 'left' | 'center'
  showMark?: boolean
}) {
  const { palette } = useTheme()

  if (variant === 'header') {
    return (
      <Text
        style={[styles.header, { color: palette.textPrimary }]}
        maxFontSizeMultiplier={1.4}
        accessibilityRole="header"
        accessibilityLabel="Bodfit"
      >
        BODFIT
      </Text>
    )
  }

  const dims = HERO_SIZES[size]
  return (
    <View
      style={[styles.row, align === 'center' && styles.center]}
      accessibilityRole="header"
      accessibilityLabel="Bodfit"
    >
      {showMark ? <BodfitMark size={dims.mark} /> : null}
      <Text
        allowFontScaling={false}
        style={[
          styles.hero,
          {
            color: palette.textPrimary,
            fontSize: dims.text,
            lineHeight: dims.text * 1.1,
          },
        ]}
      >
        bod
        <Text style={{ color: palette.primary }}>fit</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  center: {
    alignSelf: 'center',
  },
  hero: {
    fontFamily: fonts.displayExtraBold,
    letterSpacing: -1.2,
  },
  header: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
  },
})
