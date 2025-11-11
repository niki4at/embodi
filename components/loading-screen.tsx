import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

export default function LoadingScreen() {
  const scale = useSharedValue(0.8)
  const opacity = useSharedValue(0.4)
  const rotate = useSharedValue(0)

  useEffect(() => {
    // Pulsing animation
    scale.value = withRepeat(
      withSequence(
        withSpring(1.2, { damping: 2, stiffness: 80 }),
        withSpring(0.8, { damping: 2, stiffness: 80 })
      ),
      -1,
      false
    )

    // Opacity animation
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )

    // Rotation animation
    rotate.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    )
  }, [scale, opacity, rotate])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }))

  const dot1Style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const dot2Style = useAnimatedStyle(() => ({
    opacity: 1 - opacity.value,
  }))

  const dot3Style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8f9fa', '#ffffff', '#f8f9fa']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Logo with animation */}
          <Animated.View style={[styles.logoContainer, animatedStyle]}>
            <Text style={styles.logo}>embodi</Text>
          </Animated.View>

          {/* Loading dots */}
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, dot1Style]} />
            <Animated.View style={[styles.dot, dot2Style]} />
            <Animated.View style={[styles.dot, dot3Style]} />
          </View>

          <Text style={styles.loadingText}>Loading your experience</Text>
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 32,
  },
  logo: {
    fontSize: 52,
    fontWeight: '700',
    color: '#dc2626',
    letterSpacing: -1.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '400',
  },
})
