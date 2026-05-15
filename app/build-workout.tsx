import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'

export default function BuildWorkoutScreen() {
  const { palette, resolved } = useTheme()

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const handleAskCoach = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace('/checkin')
  }, [])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={[
            styles.iconButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconSymbol
            name="arrow.left"
            size={18}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Animated.View
          entering={FadeInUp.duration(motion.duration.base)}
          style={[
            styles.iconCircle,
            { backgroundColor: palette.primaryMuted },
          ]}
        >
          <Text style={styles.emoji}>🏋️</Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.duration(motion.duration.base).delay(60)}
          style={[styles.title, { color: palette.textPrimary }]}
        >
          Build your own session
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.duration(motion.duration.base).delay(120)}
          style={[styles.subtitle, { color: palette.textSecondary }]}
        >
          A custom session builder is on the way. For now, your coach can put
          together something tailored to today in a few taps.
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.duration(motion.duration.base).delay(180)}
          style={styles.actions}
        >
          <Pressable
            onPress={handleAskCoach}
            style={({ pressed }) => [
              styles.primaryCta,
              {
                backgroundColor: palette.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ask coach to build today's session"
          >
            <Text style={styles.primaryCtaText}>Ask coach instead</Text>
            <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={handleBack}
            style={styles.secondaryCta}
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
          >
            <Text style={[styles.secondaryCtaText, { color: palette.textSecondary }]}>
              Maybe later
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.huge,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 44,
    lineHeight: 50,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: {
    width: '100%',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  primaryCta: {
    height: 54,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryCtaText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  secondaryCta: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaText: {
    ...typography.bodyStrong,
  },
})
