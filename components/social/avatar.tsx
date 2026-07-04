import { Image } from 'expo-image'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/constants/theme-context'
import { fonts } from '@/constants/fonts'

const INITIALS_TINTS = [
  { bg: '#E5DEFB', fg: '#6D5BB8' },
  { bg: '#FBE3D5', fg: '#B06A3B' },
  { bg: '#D6EEDF', fg: '#3E8D63' },
  { bg: '#FBDEE3', fg: '#C05468' },
  { bg: '#D9E9F8', fg: '#3D6FA3' },
  { bg: '#F5E8CE', fg: '#A3813D' },
] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Circular avatar: remote photo when set, tinted initials otherwise. */
export function Avatar({
  url,
  name,
  size = 40,
}: {
  url: string | null | undefined
  name: string
  size?: number
}) {
  const { palette } = useTheme()
  const tint = INITIALS_TINTS[hashString(name || '?') % INITIALS_TINTS.length]

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
      />
    )
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint.bg,
          borderColor: palette.border,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.uiBold,
          fontSize: Math.max(10, size * 0.36),
          color: tint.fg,
        }}
      >
        {initialsFor(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
