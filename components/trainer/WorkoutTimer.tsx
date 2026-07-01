import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

type WorkoutTimerProps = {
  /**
   * Server-stored workout start (ms). Falls back to screen-mount time for
   * sessions created before the timer existed.
   */
  startedAt?: number | null
  /** Coach's planned session length, used by the "vs plan" view. */
  plannedDurationMin: number
}

type TimerView = 'elapsed' | 'plan'

const PLAN_TRACK_WIDTH = 72

export function formatElapsed(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const two = (n: number) => n.toString().padStart(2, '0')
  return hours > 0
    ? `${hours}:${two(minutes)}:${two(seconds)}`
    : `${minutes}:${two(seconds)}`
}

function useWorkoutElapsed(startedAt?: number | null): number {
  // Anchor once on mount so old sessions without startedAt still get a
  // stable timer instead of one that resets on every re-render.
  const fallbackAnchor = useRef(Date.now())
  const anchor = startedAt ?? fallbackAnchor.current
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, Date.now() - anchor),
  )

  useEffect(() => {
    setElapsedMs(Math.max(0, Date.now() - anchor))
    const interval = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - anchor))
    }, 1000)
    return () => clearInterval(interval)
  }, [anchor])

  return elapsedMs
}

function spokenDuration(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)
  return parts.join(' ')
}

export default function WorkoutTimer({
  startedAt,
  plannedDurationMin,
}: WorkoutTimerProps) {
  const { palette } = useTheme()
  const elapsedMs = useWorkoutElapsed(startedAt)
  const [view, setView] = useState<TimerView>('elapsed')

  const pulse = useSharedValue(1)
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [pulse])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.85 + pulse.value * 0.15 }],
  }))

  const plannedMs = plannedDurationMin * 60_000
  const overPlan = plannedMs > 0 && elapsedMs > plannedMs
  const planProgress =
    plannedMs > 0 ? Math.min(1, elapsedMs / plannedMs) : 0

  const accentColor = overPlan && view === 'plan' ? palette.success : palette.primary

  const label =
    view === 'elapsed'
      ? `Workout time ${spokenDuration(elapsedMs)}. Tap to compare with your plan.`
      : `Workout time ${spokenDuration(elapsedMs)} of a ${plannedDurationMin} minute plan. Tap to show elapsed time only.`

  return (
    <Pressable
      onPress={() => setView(v => (v === 'elapsed' ? 'plan' : 'elapsed'))}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.container}
    >
      <Animated.View key={view} entering={FadeIn.duration(180)} style={styles.inner}>
        <View style={styles.row}>
          <Animated.View
            style={[styles.dot, { backgroundColor: accentColor }, dotStyle]}
          />
          {view === 'elapsed' ? (
            <Text style={[styles.time, { color: palette.textSecondary }]}>
              {formatElapsed(elapsedMs)}
            </Text>
          ) : overPlan ? (
            <Text style={[styles.time, { color: palette.success }]}>
              +{formatElapsed(elapsedMs - plannedMs)} over
            </Text>
          ) : (
            <Text style={[styles.time, { color: palette.textSecondary }]}>
              {formatElapsed(elapsedMs)}
              <Text style={{ color: palette.textTertiary }}>
                {' '}/ {plannedDurationMin} min
              </Text>
            </Text>
          )}
        </View>
        {view === 'plan' ? (
          <View
            style={[styles.track, { backgroundColor: palette.surfaceHigh }]}
          >
            <View
              style={[
                styles.trackFill,
                {
                  backgroundColor: accentColor,
                  width: PLAN_TRACK_WIDTH * planProgress,
                },
              ]}
            />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  inner: {
    alignItems: 'center',
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  time: {
    ...typography.small,
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
  track: {
    width: PLAN_TRACK_WIDTH,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 1,
  },
  trackFill: {
    height: 3,
    borderRadius: 2,
  },
})
