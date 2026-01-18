import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

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
  colorStart?: string
  colorEnd?: string
  showValue?: boolean
  delay?: number
}

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
  colorStart = '#10b981',
  colorEnd = '#ef4444',
  showValue = true,
  delay = 0,
}: CheckInSliderProps) {
  const sliderWidth = useSharedValue(0)
  const translateX = useSharedValue(0)
  const scale = useSharedValue(1)
  const isPressed = useSharedValue(false)

  // Calculate initial position from value
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
    [onChange]
  )

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      isPressed.value = true
      scale.value = withSpring(1.2)
    })
    .onUpdate((event) => {
      const newX = Math.max(0, Math.min(event.x, sliderWidth.value))
      translateX.value = newX

      // Calculate value
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
      isPressed.value = false
      scale.value = withSpring(1)
    })

  const tapGesture = Gesture.Tap().onEnd((event) => {
    const newX = Math.max(0, Math.min(event.x, sliderWidth.value))
    translateX.value = withSpring(newX)

    const percentage = newX / sliderWidth.value
    const rawValue = min + percentage * (max - min)
    const steppedValue = Math.round(rawValue / step) * step
    const clampedValue = Math.max(min, Math.min(max, steppedValue))

    runOnJS(hapticFeedback)()
    runOnJS(handleValueChange)(clampedValue)
  })

  const composedGesture = Gesture.Race(panGesture, tapGesture)

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - 14 }, { scale: scale.value }],
  }))

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value,
  }))

  const thumbColorStyle = useAnimatedStyle(() => {
    const percentage = sliderWidth.value > 0 ? translateX.value / sliderWidth.value : 0
    const backgroundColor = interpolateColor(
      percentage,
      [0, 1],
      [colorStart, colorEnd]
    )
    return { backgroundColor }
  })

  const valueTextStyle = useAnimatedStyle(() => {
    const percentage = sliderWidth.value > 0 ? translateX.value / sliderWidth.value : 0
    const opacity = interpolate(percentage, [0, 0.5, 1], [1, 0.8, 1])
    return { opacity }
  })

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {showValue && (
          <Animated.Text style={[styles.valueText, valueTextStyle]}>
            {value}/{max}
          </Animated.Text>
        )}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <GestureDetector gesture={composedGesture}>
        <View
          style={styles.sliderContainer}
          onLayout={(e) => {
            sliderWidth.value = e.nativeEvent.layout.width
            // Set initial position after layout
            const percentage = (value - min) / (max - min)
            translateX.value = percentage * e.nativeEvent.layout.width
          }}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]}>
              <LinearGradient
                colors={[colorStart, colorEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Animated.View style={[styles.thumb, thumbStyle, thumbColorStyle]} />
        </View>
      </GestureDetector>

      <View style={styles.labels}>
        <Text style={styles.label}>{minLabel}</Text>
        <Text style={styles.label}>{maxLabel}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4f46e5',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    marginTop: 8,
  },
  track: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    top: 6,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    color: '#9ca3af',
  },
})
