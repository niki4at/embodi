import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'

export const FLAME_LIT = '#FF9500'
export const FLAME_HOT = '#FF3B30'

const SIZES = {
  sm: { icon: 13, font: 12 },
  md: { icon: 16, font: 14 },
  lg: { icon: 22, font: 19 },
} as const

/**
 * Duolingo-style streak flame with the current week count. `lit` should be
 * false when this week's goal hasn't been met yet (greyed-out flame).
 */
export function StreakFlame({
  weeks,
  lit = true,
  size = 'md',
  style,
}: {
  weeks: number
  lit?: boolean
  size?: keyof typeof SIZES
  style?: ViewStyle
}) {
  const { palette } = useTheme()
  if (weeks <= 0) return null
  const dims = SIZES[size]
  const color = lit ? FLAME_LIT : palette.textTertiary
  return (
    <View style={[styles.row, style]}>
      <IconSymbol name="flame.fill" size={dims.icon} color={color} />
      <Text
        style={[
          styles.count,
          { color, fontSize: dims.font, fontFamily: fonts.uiBold },
        ]}
      >
        {weeks}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
})
