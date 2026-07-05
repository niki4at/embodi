import * as Haptics from 'expo-haptics'
import React, { useEffect } from 'react'
import { Modal, Pressable, StyleSheet, Text } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { FLAME_LIT } from '@/components/streak/streak-flame'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { fonts } from '@/constants/fonts'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

const MILESTONES: Record<number, string> = {
  4: 'One month strong!',
  12: 'Three months of showing up!',
  26: 'Half a year of consistency!',
  52: 'A full year. Unstoppable.',
}

/**
 * Full-screen streak celebration shown on the recap screen when completing a
 * workout extends the weekly streak. Milestone weeks get extra fanfare.
 */
export function StreakCelebration({
  visible,
  weeks,
  onClose,
}: {
  visible: boolean
  weeks: number
  onClose: () => void
}) {
  const { palette } = useTheme()
  const scale = useSharedValue(0.3)
  const wiggle = useSharedValue(0)
  const isMilestone = weeks in MILESTONES

  useEffect(() => {
    if (!visible) return
    scale.value = 0.3
    scale.value = withSpring(1, { damping: 9, stiffness: 120 })
    wiggle.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 260, easing: Easing.inOut(Easing.quad) }),
          withTiming(4, { duration: 260, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    )
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [visible, scale, wiggle])

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${wiggle.value}deg` }],
  }))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.content}>
          {isMilestone ? (
            <Animated.View entering={FadeInDown.delay(250).duration(300)}>
              <IconSymbol name="party.popper.fill" size={34} color="#FFD54F" />
            </Animated.View>
          ) : null}

          <Animated.View style={flameStyle}>
            <IconSymbol name="flame.fill" size={128} color={FLAME_LIT} />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(150).duration(300)}
            style={styles.weeksText}
          >
            {weeks}-week streak!
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(300).duration(300)}
            style={styles.subtitle}
          >
            {isMilestone
              ? MILESTONES[weeks]
              : 'You hit your weekly goal. Keep the flame alive.'}
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(450).duration(300)}>
            <Pressable
              onPress={onClose}
              style={[styles.button, { backgroundColor: palette.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.buttonText}>Keep it going</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 14, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  weeksText: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 36,
    lineHeight: 42,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  button: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  buttonText: {
    ...typography.button,
    color: '#FFFFFF',
  },
})
