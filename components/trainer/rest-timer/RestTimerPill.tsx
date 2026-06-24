import React, { useEffect } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, shadow, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { useRestTimer } from './RestTimerProvider'
import { formatClock, useCountdownMs } from './restTimerUtils'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const PILL_WIDTH = 132
const PILL_HEIGHT = 60
const EDGE_MARGIN = 16
const RING = 36
const STROKE = 4
const R = (RING - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export default function RestTimerPill() {
  const { palette, resolved } = useTheme()
  const insets = useSafeAreaInsets()
  const { status, mode, totalSec, endsAt, expand } = useRestTimer()

  const visible = status !== 'idle' && mode === 'mini'
  const running = status === 'running'
  const finished = status === 'finished'
  const remainingMs = useCountdownMs(endsAt, running)
  const remainingSec = Math.ceil(remainingMs / 1000)

  const { width: screenW, height: screenH } = Dimensions.get('window')
  const minX = EDGE_MARGIN
  const maxX = screenW - PILL_WIDTH - EDGE_MARGIN
  const minY = insets.top + EDGE_MARGIN
  const maxY = screenH - PILL_HEIGHT - insets.bottom - 96

  const translateX = useSharedValue(maxX)
  const translateY = useSharedValue(maxY)
  const startX = useSharedValue(maxX)
  const startY = useSharedValue(maxY)

  const progress = useSharedValue(1)
  useEffect(() => {
    const next = finished
      ? 0
      : totalSec > 0
        ? Math.max(0, Math.min(1, remainingMs / (totalSec * 1000)))
        : 0
    progress.value = withTiming(next, { duration: 280 })
  }, [remainingMs, totalSec, finished, progress])

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((e) => {
      translateX.value = Math.min(
        maxX,
        Math.max(minX, startX.value + e.translationX),
      )
      translateY.value = Math.min(
        maxY,
        Math.max(minY, startY.value + e.translationY),
      )
    })
    .onEnd(() => {
      const center = translateX.value + PILL_WIDTH / 2
      translateX.value = withSpring(center < screenW / 2 ? minX : maxX, {
        damping: 18,
        stiffness: 220,
      })
    })

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(expand)()
  })

  const composed = Gesture.Race(pan, tap)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }))

  if (!visible) return null

  const ringColor = finished ? palette.success : palette.primary
  const pillShadow = resolved === 'dark' ? shadow.lg : shadow.md

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.pill,
          pillShadow,
          {
            backgroundColor: palette.bgElevated,
            borderColor: palette.border,
          },
          animatedStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Expand rest timer"
      >
        <View style={styles.ringWrap}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={palette.surfaceHigh}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={ringProps}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          {finished ? (
            <View style={styles.ringIcon} pointerEvents="none">
              <IconSymbol
                name="checkmark"
                size={16}
                color={palette.success}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: palette.textTertiary }]}>
            {finished ? 'Done' : 'Rest'}
          </Text>
          <Text style={[styles.time, { color: palette.textPrimary }]}>
            {finished ? '0:00' : formatClock(remainingSec)}
          </Text>
        </View>
        <Pressable
          onPress={expand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Expand rest timer"
          style={styles.expandHint}
        >
          <IconSymbol
            name="arrow.up.left.and.arrow.down.right"
            size={14}
            color={palette.textTertiary}
          />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    fontSize: 9,
  },
  time: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  expandHint: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
