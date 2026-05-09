import { Image } from 'expo-image'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { fonts } from '@/constants/fonts'
import { useThemedPalette } from '@/constants/theme-context'

const ACCENT_LINES = require('../../assets/onboarding/embody-lines.png')
const ACCENT_SQUIGGLE = require('../../assets/onboarding/embody-squiggle.png')

interface EmbodiWordmarkProps {
  size?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'center'
  showAccents?: boolean
}

const SIZES = {
  sm: 28,
  md: 40,
  lg: 52,
}

/**
 * The "Embody" wordmark. Renders the wordmark text in real Sora Bold (40px
 * in the Figma frame) and overlays the exact coral squiggle and three slash
 * lines exported from Figma (file Btvt6p53EA2NQ6Z4XrUKFE) as transparent
 * PNGs so they always read 1:1 with the design.
 *
 * Asset sources:
 *   - assets/onboarding/embody-lines.png    cropped from Vector1 / Vector6 / Vector3
 *   - assets/onboarding/embody-squiggle.png cropped from Vector5
 *
 * Both PNGs are pre-tinted coral (#FF6B6B) so they look right in light and
 * dark mode without further processing.
 */
export function EmbodiWordmark({
  size = 'md',
  align = 'left',
  showAccents = true,
}: EmbodiWordmarkProps) {
  const palette = useThemedPalette()
  const fontSize = SIZES[size]
  const scale = fontSize / 40

  // Lines block sits in the empty space to the right of the "y" descender.
  // Native asset is 34×46 px; we render at the exact Figma proportion.
  const linesWidth = 30 * scale
  const linesHeight = 40 * scale

  // Squiggle hugs the bottom of the wordmark and spans about half the text width.
  const squiggleWidth = 95 * scale
  const squiggleHeight = 11 * scale

  return (
    <View style={[styles.row, align === 'center' && styles.center]}>
      <View style={styles.markWrap}>
        <Text
          allowFontScaling={false}
          style={[
            styles.mark,
            {
              color: palette.textPrimary,
              fontSize,
              lineHeight: fontSize * 1.05,
            },
          ]}
        >
          Embody
        </Text>

        {showAccents ? (
          <Image
            source={ACCENT_SQUIGGLE}
            style={[
              styles.squiggle,
              {
                width: squiggleWidth,
                height: squiggleHeight,
                bottom: -squiggleHeight - 1,
              },
            ]}
            contentFit="contain"
            pointerEvents="none"
          />
        ) : null}
      </View>

      {showAccents ? (
        <Image
          source={ACCENT_LINES}
          style={[
            styles.accents,
            { width: linesWidth, height: linesHeight },
          ]}
          contentFit="contain"
          pointerEvents="none"
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  center: {
    alignSelf: 'center',
  },
  markWrap: {
    position: 'relative',
  },
  mark: {
    fontFamily: fonts.displayBold,
    letterSpacing: -0.4,
  },
  squiggle: {
    position: 'absolute',
    left: 1,
  },
  accents: {
    marginTop: 4,
  },
})
