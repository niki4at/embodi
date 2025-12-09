import { api } from '@/convex/_generated/api'
import { useAction, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState } from 'react'
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
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface ProfileCompletionBannerProps {
  onStartQuestions: () => void
}

export default function ProfileCompletionBanner({
  onStartQuestions,
}: ProfileCompletionBannerProps) {
  const profileQuestions = useQuery(api.profileQuestions.getProfileQuestions)
  const retryGeneration = useAction(api.profileQuestions.retryGenerateQuestions)
  const [isRetrying, setIsRetrying] = useState(false)

  const bannerScale = useSharedValue(1)
  const pulseOpacity = useSharedValue(0.6)
  const shadowOpacity = useSharedValue(0)

  useEffect(() => {
    // Fade in shadow after entering animation
    shadowOpacity.value = withDelay(600, withTiming(1, { duration: 300 }))

    // Subtle pulse animation for the generating state
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.6, { duration: 1000 })
      ),
      -1,
      true
    )
  }, [shadowOpacity, pulseOpacity])

  const bannerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bannerScale.value }],
  }))

  const shadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: shadowOpacity.value * 0.2,
    shadowRadius: 12,
    elevation: shadowOpacity.value * 6,
  }))

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  const handlePressIn = () => {
    bannerScale.value = withSpring(0.98)
  }

  const handlePressOut = () => {
    bannerScale.value = withSpring(1)
  }

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

  // Don't render if no data yet or profile is completed
  if (!profileQuestions) {
    return null
  }

  if (profileQuestions.status === 'completed') {
    return null
  }

  // Failed state - show retry button
  if (profileQuestions.status === 'failed') {
    return (
      <Animated.View
        entering={FadeInDown.delay(100).duration(600).springify()}
        style={styles.container}
      >
        <Animated.View style={[styles.failedCard, shadowStyle]}>
          <LinearGradient
            colors={['#7f1d1d', '#991b1b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.failedGradient}
          >
            <View style={styles.failedContent}>
              <View style={styles.failedIconContainer}>
                <Text style={styles.failedIcon}>⚠️</Text>
              </View>
              <View style={styles.failedTextContainer}>
                <Text style={styles.failedTitle}>
                  Question generation timed out
                </Text>
                <Text style={styles.failedSubtitle}>
                  Our AI is busy. Tap to try again.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              disabled={isRetrying}
              activeOpacity={0.8}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.retryButtonText}>Try again</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    )
  }

  // Generating state - show loading indicator
  if (profileQuestions.status === 'generating') {
    return (
      <Animated.View
        entering={FadeInDown.delay(100).duration(600).springify()}
        style={styles.container}
      >
        <Animated.View style={[styles.generatingCard, shadowStyle]}>
          <LinearGradient
            colors={['#1e1b4b', '#312e81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.generatingGradient}
          >
            <View style={styles.generatingContent}>
              <Animated.View style={[styles.sparkleContainer, pulseStyle]}>
                <Text style={styles.sparkleIcon}>✨</Text>
              </Animated.View>
              <View style={styles.generatingTextContainer}>
                <Text style={styles.generatingTitle}>
                  Personalizing your profile...
                </Text>
                <Text style={styles.generatingSubtitle}>
                  Creating questions tailored to your goals
                </Text>
              </View>
              <ActivityIndicator size="small" color="#a5b4fc" />
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    )
  }

  // Ready state - show prompt to complete profile
  const progress = profileQuestions.totalCount > 0
    ? Math.round((profileQuestions.answeredCount / profileQuestions.totalCount) * 100)
    : 0
  const questionsRemaining = profileQuestions.totalCount - profileQuestions.answeredCount

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(600).springify()}
      style={styles.container}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View style={[styles.readyCard, bannerAnimatedStyle, shadowStyle]}>
          <LinearGradient
            colors={['#1e1b4b', '#312e81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.readyGradient}
          >
            <View style={styles.readyHeader}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconEmoji}>📋</Text>
              </View>
              <View style={styles.progressBadge}>
                <Text style={styles.progressText}>
                  {questionsRemaining} left
                </Text>
              </View>
            </View>

            <Text style={styles.readyTitle}>Complete your profile</Text>
            <Text style={styles.readySubtitle}>
              Answer {questionsRemaining} quick questions to unlock a plan built for you
            </Text>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { width: `${progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercentage}>{progress}%</Text>
            </View>

            <View style={styles.ctaContainer}>
              <Text style={styles.ctaText}>
                {profileQuestions.answeredCount > 0 ? 'Continue' : 'Get started'} →
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  // Failed state styles
  failedCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  failedGradient: {
    padding: 16,
  },
  failedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  failedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(254, 202, 202, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedIcon: {
    fontSize: 20,
  },
  failedTextContainer: {
    flex: 1,
  },
  failedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fecaca',
    marginBottom: 2,
  },
  failedSubtitle: {
    fontSize: 13,
    color: '#fca5a5',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Generating state styles
  generatingCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  generatingGradient: {
    padding: 16,
  },
  generatingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparkleContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(165, 180, 252, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleIcon: {
    fontSize: 20,
  },
  generatingTextContainer: {
    flex: 1,
  },
  generatingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e7ff',
    marginBottom: 2,
  },
  generatingSubtitle: {
    fontSize: 13,
    color: '#a5b4fc',
  },
  // Ready state styles
  readyCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  readyGradient: {
    padding: 20,
  },
  readyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(165, 180, 252, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  progressBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  readyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  readySubtitle: {
    fontSize: 15,
    color: '#c7d2fe',
    lineHeight: 22,
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e7ff',
    minWidth: 40,
  },
  ctaContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
})

