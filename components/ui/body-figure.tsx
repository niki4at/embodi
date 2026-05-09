import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import React, { useCallback } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

const BODY_FIGURE = require('../../assets/onboarding/body-figure.png')

interface BodyFigureProps {
  width?: number
  height?: number
  onPress?: () => void
}

const AnimatedImage = Animated.createAnimatedComponent(Image)

/**
 * Renders the Figma onboarding body illustration. The asset already includes
 * the soft pain region overlays (teal shoulder, lavender torso, salmon hip)
 * and the small coral squiggle next to the head, so this component just
 * positions and scales the artwork.
 *
 * Tap to play a brief wiggle + haptic; the figure also has a subtle ambient
 * float to avoid feeling static.
 */
export function BodyFigure({
  width = 280,
  height = 420,
  onPress,
}: BodyFigureProps) {
  const scale = useSharedValue(1)
  const rotation = useSharedValue(0)
  const float = useSharedValue(0)

  React.useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(float)
    }
  }, [float])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: float.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}deg` },
    ],
  }))

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    scale.value = withSequence(
      withSpring(1.06, { damping: 10, stiffness: 240 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    )
    rotation.value = withSequence(
      withTiming(-3, { duration: 120 }),
      withTiming(3, { duration: 160 }),
      withTiming(0, { duration: 140 }),
    )
    onPress?.()
  }, [scale, rotation, onPress])

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.wrap, { width, height }]}
      accessibilityRole="imagebutton"
      accessibilityLabel="Tap the body figure"
    >
      <AnimatedImage
        source={BODY_FIGURE}
        style={[styles.image, animatedStyle]}
        contentFit="contain"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
})
