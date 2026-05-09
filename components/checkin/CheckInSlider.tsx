import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { motion, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

interface CheckInSliderProps {
  title: string
  subtitle?: string
  value: number
  min: number
  max: number
  step?: number
  minLabel: string
  maxLabel: string
  onChange: (value: number) => void
  showValue?: boolean
  delay?: number
}

const THUMB_SIZE = 26
const TRACK_HEIGHT = 6

export default function CheckInSlider({
  title,
  subtitle,
  value,
  min,
  max,
  step = 1,
  minLabel,
  maxLabel,
  onChange,
  showValue = true,
  delay = 0,
}: CheckInSliderProps) {
  const { palette } = useTheme()
  const sliderWidth = useSharedValue(0)
  const translateX = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    if (sliderWidth.value > 0) {
      const percentage = (value - min) / (max - min)
      translateX.value = percentage * sliderWidth.value
    }
  }, [value, min, max, sliderWidth, translateX])

  const hapticFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const handleValueChange = useCallback(
    (newValue: number) => {
      onChange(newValue)
    },
    [onChange],
  )

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(1.15, motion.spring)
    })
    .onUpdate(event => {
      const newX = Math.max(0, Math.min(event.x, sliderWidth.value))
      translateX.value = newX

      const percentage = newX / sliderWidth.value
      const rawValue = min + percentage * (max - min)
      const steppedValue = Math.round(rawValue / step) * step
      const clampedValue = Math.max(min, Math.min(max, steppedValue))

      if (clampedValue !== value) {
        runOnJS(hapticFeedback)()
        runOnJS(handleValueChange)(clampedValue)
      }
    })
    .onFinalize(() => {
      scale.value = withSpring(1, motion.spring)
    })

  const tapGesture = Gesture.Tap().onEnd(event => {
    const newX = Math.max(0, Math.min(event.x, sliderWidth.value))
    translateX.value = withSpring(newX, motion.spring)

    const percentage = newX / sliderWidth.value
    const rawValue = min + percentage * (max - min)
    const steppedValue = Math.round(rawValue / step) * step
    const clampedValue = Math.max(min, Math.min(max, steppedValue))

    runOnJS(hapticFeedback)()
    runOnJS(handleValueChange)(clampedValue)
  })

  const composedGesture = Gesture.Race(panGesture, tapGesture)

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - THUMB_SIZE / 2 },
      { scale: scale.value },
    ],
  }))

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value,
  }))

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(motion.duration.base)}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
        {showValue && (
          <Text style={[styles.valueText, { color: palette.primary }]}>
            {value}
            <Text style={[styles.valueMax, { color: palette.textTertiary }]}>
              /{max}
            </Text>
          </Text>
        )}
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}

      <GestureDetector gesture={composedGesture}>
        <View
          style={styles.sliderContainer}
          onLayout={e => {
            sliderWidth.value = e.nativeEvent.layout.width
            const percentage = (value - min) / (max - min)
            translateX.value = percentage * e.nativeEvent.layout.width
          }}
        >
          <View
            style={[styles.track, { backgroundColor: palette.surfaceAlt }]}
          >
            <Animated.View
              style={[
                styles.fill,
                { backgroundColor: palette.primary },
                fillStyle,
              ]}
            />
          </View>
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.primary,
              },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>

      <View style={styles.labels}>
        <Text style={[styles.label, { color: palette.textTertiary }]}>
          {minLabel}
        </Text>
        <Text style={[styles.label, { color: palette.textTertiary }]}>
          {maxLabel}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  valueText: {
    ...typography.h2,
  },
  valueMax: {
    ...typography.small,
    fontWeight: '500',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    top: (40 - THUMB_SIZE) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  label: {
    ...typography.small,
  },
})
