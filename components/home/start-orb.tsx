import * as Haptics from 'expo-haptics'
import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { Chip, HeroOrb } from '@/components/ui/primitives'
import { motion, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'

export type OrbContent = {
  /** Big word inside the orb: Start, Continue, Check in, Done, Building. */
  word: string
  /** Small mono line under the word: "38 mins · 6 moves". */
  meta?: string
  /** Title under the orb: "Pull day, easy on shoulders". */
  title: string
  /** Secondary line under the title. */
  subtitle?: string
  /** Optional highlighted fragment appended to the subtitle. */
  subtitleAccent?: string
  spinning?: boolean
  progress?: number
}

/**
 * The gradient Start orb that anchors Home. One tap starts (or continues)
 * today's movement; the copy underneath explains what was built and why.
 */
export function StartOrb({
  content,
  onPress,
  disabled = false,
  adjustLabel,
  onAdjust,
}: {
  content: OrbContent
  onPress: () => void
  disabled?: boolean
  adjustLabel?: string
  onAdjust?: () => void
}) {
  const { palette } = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
          onPress()
        }}
        onPressIn={() => {
          if (disabled) return
          scale.value = withSpring(0.96, motion.spring)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring)
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${content.word}. ${content.title}${
          content.meta ? `. ${content.meta}` : ''
        }`}
        accessibilityState={{ disabled, busy: content.spinning }}
      >
        <Animated.View style={animatedStyle}>
          <HeroOrb size={156}>
            {content.spinning ? (
              <ActivityIndicator color={palette.white} style={styles.spinner} />
            ) : null}
            <Text style={styles.word} allowFontScaling={false}>
              {content.word}
            </Text>
            {content.meta ? (
              <Text style={styles.meta} allowFontScaling={false}>
                {content.meta}
              </Text>
            ) : null}
            {content.progress !== undefined ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(4, Math.min(100, content.progress))}%` },
                  ]}
                />
              </View>
            ) : null}
          </HeroOrb>
        </Animated.View>
      </Pressable>

      <Text
        style={[styles.title, { color: palette.textPrimary }]}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {content.title}
      </Text>
      {content.subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textPrimary }]} numberOfLines={2}>
          {content.subtitle}
          {content.subtitleAccent ? (
            <Text style={{ color: palette.primary, fontFamily: fonts.uiSemiBold }}>
              {' \u00b7 '}
              {content.subtitleAccent}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {adjustLabel && onAdjust ? (
        <Chip label={adjustLabel} onPress={onAdjust} style={styles.adjust} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  spinner: {
    marginBottom: 6,
  },
  word: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 24,
    lineHeight: 30,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  meta: {
    ...typography.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  progressTrack: {
    width: 72,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  title: {
    ...typography.h3,
    fontSize: 19,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.small,
    textAlign: 'center',
  },
  adjust: {
    marginTop: spacing.md,
    minHeight: 34,
    paddingHorizontal: 14,
  },
})
