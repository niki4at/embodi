import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { PHASE_META, type PhaseProgress } from './phases'

type MovementJourneyBarProps = {
  progress: PhaseProgress[]
  visible: boolean
  topInset: number
}

const PHASE_KEYS = ['warmup', 'main', 'cooldown'] as const

/**
 * Floating progress strip that surfaces the user's journey through warm-up,
 * strength, and recovery phases. Fades in on scroll, fades out when the user
 * settles on an exercise (controlled by `visible`).
 */
export function MovementJourneyBar({
  progress,
  visible,
  topInset,
}: MovementJourneyBarProps) {
  const { palette, shadows } = useTheme()
  const reveal = useSharedValue(0)

  useEffect(() => {
    reveal.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 220 : 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    })
  }, [visible, reveal])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      {
        translateY: interpolate(reveal.value, [0, 1], [-12, 0]),
      },
    ],
  }))

  const sessionComplete =
    progress.length > 0 &&
    progress.every(p => (p.total === 0 ? true : p.completed >= p.total))

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrap,
        animatedStyle,
        shadows.md,
        {
          top: topInset + spacing.sm,
          backgroundColor: palette.bgElevated,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.row}>
        {PHASE_KEYS.map((phase, idx) => {
          const meta = PHASE_META[phase]
          const stats = progress.find(p => p.phase === phase)
          const completed = stats?.completed ?? 0
          const total = stats?.total ?? 0
          const reached = completed > 0
          const fulfilled = total > 0 && completed >= total
          const empty = total === 0

          return (
            <React.Fragment key={phase}>
              <View style={styles.node}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: empty
                        ? palette.surfaceAlt
                        : fulfilled
                          ? palette.primary
                          : reached
                            ? palette.primaryMuted
                            : palette.surface,
                      borderColor: empty
                        ? palette.border
                        : fulfilled
                          ? palette.primary
                          : palette.primaryBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emoji,
                      empty ? styles.emojiMuted : null,
                    ]}
                  >
                    {meta.emoji}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: palette.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {meta.label}
                </Text>
                <Text
                  style={[
                    styles.count,
                    {
                      color: empty
                        ? palette.textTertiary
                        : fulfilled
                          ? palette.success
                          : palette.primary,
                    },
                  ]}
                >
                  {empty ? '–' : `${completed}/${total}`}
                </Text>
              </View>
              {idx < PHASE_KEYS.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: palette.border },
                  ]}
                />
              ) : null}
            </React.Fragment>
          )
        })}
        <View
          style={[
            styles.connector,
            { backgroundColor: palette.border },
          ]}
        />
        <View style={styles.node}>
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: sessionComplete
                  ? palette.primary
                  : palette.surface,
                borderColor: sessionComplete
                  ? palette.primary
                  : palette.border,
              },
            ]}
          >
            <IconSymbol
              name="checkmark"
              size={16}
              color={sessionComplete ? palette.white : palette.textTertiary}
            />
          </View>
          <Text
            style={[styles.label, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            Done
          </Text>
          <Text
            style={[
              styles.count,
              {
                color: sessionComplete
                  ? palette.success
                  : palette.textTertiary,
              },
            ]}
          >
            {sessionComplete ? '✓' : '–'}
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

const BUBBLE_SIZE = 40

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    zIndex: 50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  node: {
    alignItems: 'center',
    minWidth: 56,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  emojiMuted: {
    opacity: 0.45,
  },
  label: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  count: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  connector: {
    flex: 1,
    height: 1,
    marginBottom: 22,
  },
})
