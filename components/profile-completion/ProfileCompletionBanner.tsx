import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useAction, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'

import { api } from '@/convex/_generated/api'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

interface ProfileCompletionBannerProps {
  onStartQuestions: () => void
}

export default function ProfileCompletionBanner({
  onStartQuestions,
}: ProfileCompletionBannerProps) {
  const { palette } = useTheme()
  const profileQuestions = useQuery(api.profileQuestions.getProfileQuestions)
  const retryGeneration = useAction(api.profileQuestions.retryGenerateQuestions)
  const [isRetrying, setIsRetrying] = useState(false)

  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onStartQuestions()
  }

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      await retryGeneration({})
    } catch (error) {
      console.error('Retry failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsRetrying(false)
    }
  }

  if (!profileQuestions || profileQuestions.status === 'completed') {
    return null
  }

  if (profileQuestions.status === 'failed') {
    return (
      <Animated.View
        entering={FadeInDown.duration(motion.duration.base)}
        style={styles.container}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.dangerMuted,
            },
          ]}
        >
          <View style={styles.row}>
            <View
              style={[styles.iconWrap, { backgroundColor: palette.dangerMuted }]}
            >
              <IconSymbol name="info.circle" size={18} color={palette.danger} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Generation timed out
              </Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                Tap to try again.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: palette.danger }]}
            onPress={handleRetry}
            disabled={isRetrying}
            activeOpacity={0.85}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <Text style={[styles.dangerButtonText, { color: palette.white }]}>
                Try again
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    )
  }

  if (profileQuestions.status === 'generating') {
    const questionsAvailable = profileQuestions.questions.length
    const hasQuestions = questionsAvailable > 0

    return (
      <Animated.View
        entering={FadeInDown.duration(motion.duration.base)}
        style={styles.container}
      >
        <Pressable
          onPressIn={() => {
            scale.value = withSpring(0.98, motion.spring)
          }}
          onPressOut={() => {
            scale.value = withSpring(1, motion.spring)
          }}
          onPress={handlePress}
        >
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
              animatedStyle,
            ]}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: palette.primaryMuted },
                ]}
              >
                <IconSymbol name="sparkles" size={18} color={palette.primary} />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: palette.textPrimary }]}>
                  {hasQuestions
                    ? `${questionsAvailable} question${questionsAvailable > 1 ? 's' : ''} ready`
                    : 'Personalizing your profile'}
                </Text>
                <Text
                  style={[styles.subtitle, { color: palette.textSecondary }]}
                >
                  {hasQuestions ? 'Start while more arrive' : 'Tap to continue'}
                </Text>
              </View>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    )
  }

  const progress =
    profileQuestions.totalCount > 0
      ? Math.round(
          (profileQuestions.answeredCount / profileQuestions.totalCount) * 100,
        )
      : 0
  const questionsRemaining =
    profileQuestions.totalCount - profileQuestions.answeredCount

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.duration.base)}
      style={styles.container}
    >
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, motion.spring)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring)
        }}
        onPress={handlePress}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
            animatedStyle,
          ]}
        >
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: palette.primaryMuted },
              ]}
            >
              <IconSymbol name="list.bullet" size={18} color={palette.primary} />
            </View>
            <View
              style={[styles.headerBadge, { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.headerBadgeText, { color: palette.white }]}>
                {questionsRemaining} left
              </Text>
            </View>
          </View>

          <Text style={[styles.bigTitle, { color: palette.textPrimary }]}>
            Complete your profile
          </Text>
          <Text style={[styles.bigSubtitle, { color: palette.textSecondary }]}>
            Answer {questionsRemaining} quick questions to unlock a plan built for
            you.
          </Text>

          <View style={styles.progressRow}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: palette.surfaceAlt },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: palette.primary, width: `${progress}%` },
                ]}
              />
            </View>
            <Text
              style={[styles.progressText, { color: palette.textSecondary }]}
            >
              {progress}%
            </Text>
          </View>

          <View style={[styles.cta, { backgroundColor: palette.primary }]}>
            <Text style={[styles.ctaText, { color: palette.white }]}>
              {profileQuestions.answeredCount > 0 ? 'Continue' : 'Get started'}
            </Text>
            <IconSymbol name="arrow.right" size={16} color={palette.white} />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.bodyStrong,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  bigTitle: {
    ...typography.h3,
    marginBottom: 4,
  },
  bigSubtitle: {
    ...typography.small,
    marginBottom: spacing.lg,
  },
  headerBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  headerBadgeText: {
    ...typography.caption,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    ...typography.smallStrong,
    minWidth: 36,
    textAlign: 'right',
  },
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.lg,
  },
  ctaText: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  dangerButton: {
    height: 48,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dangerButtonText: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
})
