import React, { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

interface CarouselDotProps {
  active: boolean
  activeColor: string
  inactiveColor: string
  onPress?: () => void
  index: number
  width?: { active: number; inactive: number }
}

const AnimatedView = Animated.createAnimatedComponent(View)

const SPRING = { damping: 14, stiffness: 180, mass: 0.6 }

/**
 * Pill-style carousel dot that smoothly morphs between inactive (small,
 * dim) and active (wide, vibrant). Uses one shared progress value so width
 * and color transition together for a clean "pump" feel.
 */
export function CarouselDot({
  active,
  activeColor,
  inactiveColor,
  onPress,
  index,
  width = { active: 28, inactive: 8 },
}: CarouselDotProps) {
  const progress = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, SPRING)
  }, [active, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [0, 1],
      [width.inactive, width.active],
    ),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
    transform: [
      {
        scale: interpolate(progress.value, [0, 0.5, 1], [1, 1.18, 1]),
      },
    ],
  }))

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Go to slide ${index + 1}`}
    >
      <AnimatedView style={[styles.dot, animatedStyle]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
  },
})
