import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { EmbodiWordmark } from '@/components/ui/embodi-wordmark'

interface LoadingScreenProps {
  message?: string
}

export default function LoadingScreen({
  message = 'Loading your experience',
}: LoadingScreenProps) {
  const { palette } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.content}>
        <EmbodiWordmark size="lg" align="center" />

        <View style={styles.dotsContainer}>
          <Dot delay={0} color={palette.primary} />
          <Dot delay={150} color={palette.primary} />
          <Dot delay={300} color={palette.primary} />
        </View>

        <Text style={[styles.loadingText, { color: palette.textTertiary }]}>
          {message}
        </Text>
      </View>
    </View>
  )
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    )
  }, [delay, opacity])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.huge,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingText: {
    ...typography.small,
  },
})
