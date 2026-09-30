import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { BodfitMark, BodfitWordmark } from '@/components/ui/bodfit-logo'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

interface LoadingScreenProps {
  message?: string
}

export default function LoadingScreen({ message = 'Loading your day' }: LoadingScreenProps) {
  const { palette } = useTheme()
  const pulse = useSharedValue(1)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [pulse])

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }))

  return (
    <View
      style={[styles.container, { backgroundColor: palette.bg }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.content}>
        <Animated.View style={markStyle}>
          <BodfitMark size={72} />
        </Animated.View>
        <BodfitWordmark size="sm" showMark={false} />
        <Text style={[styles.loadingText, { color: palette.textTertiary }]}>{message}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    ...typography.small,
    marginTop: spacing.sm,
  },
})
