import { api } from '@/convex/_generated/api'
import { useAuth } from '@clerk/clerk-expo'
import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, type Href } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity)

export default function HomeContent() {
  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const deleteOnboarding = useMutation(api.onboarding.deleteOnboarding)
  const generatePlan = useAction(api.trainer.generatePlanAndInsights)
  const createSession = useMutation(api.trainer.createSessionFromPlan)
  const { signOut } = useAuth()
  const [isStarting, setIsStarting] = useState(false)

  const aiCardScale = useSharedValue(1)

  // Shadow opacity values - start at 0, fade in after position animations complete
  const headerShadowOpacity = useSharedValue(0)
  const aiCardShadowOpacity = useSharedValue(0)
  const statsShadowOpacity = useSharedValue(0)
  const actionsShadowOpacity = useSharedValue(0)
  const focusShadowOpacity = useSharedValue(0)

  useEffect(() => {
    // Fade in shadows after their respective entering animations complete
    // Header: FadeInUp 600ms
    headerShadowOpacity.value = withDelay(600, withTiming(1, { duration: 300 }))

    // AI Card: FadeInDown 100ms delay + 600ms duration = 700ms
    aiCardShadowOpacity.value = withDelay(700, withTiming(1, { duration: 300 }))

    // Stats: FadeInDown 200ms delay + 600ms duration = 800ms
    statsShadowOpacity.value = withDelay(800, withTiming(1, { duration: 300 }))

    // Actions: FadeInDown 300ms delay + 600ms duration = 900ms
    actionsShadowOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 300 })
    )

    // Focus: FadeInDown 400ms delay + 600ms duration = 1000ms
    focusShadowOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }))
  }, [
    headerShadowOpacity,
    aiCardShadowOpacity,
    statsShadowOpacity,
    actionsShadowOpacity,
    focusShadowOpacity,
  ])

  const aiCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: aiCardScale.value }],
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: aiCardShadowOpacity.value * 0.3,
    shadowRadius: 16,
    elevation: aiCardShadowOpacity.value * 12,
  }))

  const headerShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: headerShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: headerShadowOpacity.value * 2,
  }))

  const statsShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: statsShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: statsShadowOpacity.value * 2,
  }))

  const actionsShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: actionsShadowOpacity.value * 0.3,
    shadowRadius: 12,
    elevation: actionsShadowOpacity.value * 8,
  }))

  const secondaryActionShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: actionsShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: actionsShadowOpacity.value * 2,
  }))

  const focusShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: focusShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: focusShadowOpacity.value * 2,
  }))

  const handleAICardPressIn = () => {
    aiCardScale.value = withSpring(0.98)
  }

  const handleAICardPressOut = () => {
    aiCardScale.value = withSpring(1)
  }

  const handleStartSession = async () => {
    if (isStarting) return
    setIsStarting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const plan = await generatePlan({})
      const sessionId = await createSession({
        goal: plan.goal,
        modality: plan.modality,
        durationMin: plan.durationMin,
        plan: plan.plan,
        healthFacts: plan.healthFacts,
        citations: plan.citations,
      })
      const sessionHref = {
        pathname: '/session',
        params: { sessionId: String(sessionId) },
      } as unknown as Href
      router.push(sessionHref)
    } catch (error) {
      console.error('Failed to start session', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsStarting(false)
    }
  }

  const handleBodyMap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // TODO: Navigate to body map
  }

  const handleSignOut = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      // For testing: Delete onboarding data before signing out
      await deleteOnboarding()
      await signOut()
    } catch (err) {
      console.error('Sign out error', err)
    }
  }

  const userName = onboardingData?.name || 'there'
  const firstName = userName.split(' ')[0]

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#fef3f2', '#ffffff', '#ffffff']}
        style={styles.gradient}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInUp.duration(600).springify()}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <View style={styles.headerText}>
                <Text style={styles.greeting}>Welcome back,</Text>
                <Text style={styles.name}>{firstName}</Text>
                <Text style={styles.subtitle}>
                  Training that meets your body where it is
                </Text>
              </View>
              <AnimatedTouchableOpacity
                style={[styles.settingsButton, headerShadowStyle]}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <Text style={styles.settingsIcon}>⚙️</Text>
              </AnimatedTouchableOpacity>
            </View>
          </Animated.View>

          {/* AI Assistant Card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(600).springify()}
          >
            <Pressable
              onPressIn={handleAICardPressIn}
              onPressOut={handleAICardPressOut}
            >
              <Animated.View style={[styles.aiCard, aiCardAnimatedStyle]}>
                <LinearGradient
                  colors={['#f97316', '#ea580c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiGradient}
                >
                  <View style={styles.aiIconContainer}>
                    <Text style={styles.aiIcon}>✨</Text>
                  </View>
                  <Text style={styles.aiTitle}>Your AI Training Partner</Text>
                  <Text style={styles.aiDescription}>
                    Share how you&apos;re feeling today. Your data is private,
                    encrypted, and only used to create your safest, most
                    effective plan.
                  </Text>
                  <TouchableOpacity
                    style={styles.aiButton}
                    onPress={() =>
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }
                  >
                    <Text style={styles.aiButtonText}>Check in →</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* Stats Grid */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600).springify()}
            style={styles.statsContainer}
          >
            <Text style={styles.sectionTitle}>Your Progress</Text>
            <View style={styles.statsGrid}>
              <Animated.View style={[styles.statCard, statsShadowStyle]}>
                <LinearGradient
                  colors={['#eef2ff', '#e0e7ff']}
                  style={styles.statGradient}
                >
                  <Text style={styles.statValue}>7</Text>
                  <Text style={styles.statLabel}>Day Streak</Text>
                  <Text style={styles.statEmoji}>🔥</Text>
                </LinearGradient>
              </Animated.View>

              <Animated.View style={[styles.statCard, statsShadowStyle]}>
                <LinearGradient
                  colors={['#f0fdf4', '#dcfce7']}
                  style={styles.statGradient}
                >
                  <Text style={styles.statValue}>12</Text>
                  <Text style={styles.statLabel}>Sessions</Text>
                  <Text style={styles.statEmoji}>💪</Text>
                </LinearGradient>
              </Animated.View>

              <Animated.View style={[styles.statCard, statsShadowStyle]}>
                <LinearGradient
                  colors={['#fef3c7', '#fde68a']}
                  style={styles.statGradient}
                >
                  <Text style={styles.statValue}>8.5</Text>
                  <Text style={styles.statLabel}>Avg Energy</Text>
                  <Text style={styles.statEmoji}>⚡</Text>
                </LinearGradient>
              </Animated.View>

              <Animated.View style={[styles.statCard, statsShadowStyle]}>
                <LinearGradient
                  colors={['#fce7f3', '#fbcfe8']}
                  style={styles.statGradient}
                >
                  <Text style={styles.statValue}>2.1</Text>
                  <Text style={styles.statLabel}>Pain Score</Text>
                  <Text style={styles.statEmoji}>😊</Text>
                </LinearGradient>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(600).springify()}
            style={styles.actionsContainer}
          >
            <Text style={styles.sectionTitle}>Quick Start</Text>

            <AnimatedTouchableOpacity
              style={[styles.primaryAction, actionsShadowStyle]}
              onPress={handleStartSession}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6366f1', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryActionGradient}
              >
                <View style={styles.actionContent}>
                  <View>
                    <Text style={styles.primaryActionTitle}>
                      {isStarting
                        ? 'Building your session...'
                        : "Start Today's Session"}
                    </Text>
                    <Text style={styles.primaryActionSubtitle}>
                      Personalized plan with live coaching
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>→</Text>
                </View>
              </LinearGradient>
            </AnimatedTouchableOpacity>

            <View style={styles.secondaryActions}>
              <AnimatedTouchableOpacity
                style={[styles.secondaryAction, secondaryActionShadowStyle]}
                onPress={handleBodyMap}
                activeOpacity={0.8}
              >
                <View style={styles.secondaryActionContent}>
                  <Text style={styles.secondaryActionIcon}>🎯</Text>
                  <Text style={styles.secondaryActionTitle}>Body Map</Text>
                  <Text style={styles.secondaryActionSubtitle}>
                    Target specific areas
                  </Text>
                </View>
              </AnimatedTouchableOpacity>

              <AnimatedTouchableOpacity
                style={[styles.secondaryAction, secondaryActionShadowStyle]}
                activeOpacity={0.8}
              >
                <View style={styles.secondaryActionContent}>
                  <Text style={styles.secondaryActionIcon}>📊</Text>
                  <Text style={styles.secondaryActionTitle}>Progress</Text>
                  <Text style={styles.secondaryActionSubtitle}>
                    View your journey
                  </Text>
                </View>
              </AnimatedTouchableOpacity>
            </View>
          </Animated.View>

          {/* Today's Focus */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(600).springify()}
            style={styles.focusContainer}
          >
            <Text style={styles.sectionTitle}>Recommended for You</Text>

            <Animated.View style={[styles.capsuleCard, focusShadowStyle]}>
              <View style={styles.capsuleHeader}>
                <View>
                  <Text style={styles.capsuleTitle}>Hip Mobility Flow</Text>
                  <Text style={styles.capsuleTime}>15 min · 6 moves</Text>
                </View>
                <View style={styles.capsuleBadge}>
                  <Text style={styles.capsuleBadgeText}>Gentle</Text>
                </View>
              </View>
              <Text style={styles.capsuleDescription}>
                Perfect for desk workers. Addresses lower back discomfort with
                gentle progressions.
              </Text>
              <View style={styles.capsuleTags}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>No equipment</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Beginner-friendly</Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.capsuleCard, focusShadowStyle]}>
              <View style={styles.capsuleHeader}>
                <View>
                  <Text style={styles.capsuleTitle}>Breath & Recovery</Text>
                  <Text style={styles.capsuleTime}>10 min · 4 techniques</Text>
                </View>
                <View style={[styles.capsuleBadge, styles.capsuleBadgeCalm]}>
                  <Text style={styles.capsuleBadgeText}>Calm</Text>
                </View>
              </View>
              <Text style={styles.capsuleDescription}>
                Active recovery for busy days. Helps manage stress and supports
                sleep quality.
              </Text>
              <View style={styles.capsuleTags}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Anywhere</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>All levels</Text>
                </View>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Safety Message */}
          <Animated.View
            entering={FadeInDown.delay(500).duration(600).springify()}
            style={styles.safetyCard}
          >
            <Text style={styles.safetyIcon}>🔒</Text>
            <Text style={styles.safetyText}>
              All recommendations are based on your profile and adapt to your
              feedback. Not medical advice—consult a professional for concerns.
            </Text>
          </Animated.View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '400',
  },
  name: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '400',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  settingsIcon: {
    fontSize: 20,
  },
  aiCard: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  aiGradient: {
    padding: 24,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aiIcon: {
    fontSize: 24,
  },
  aiTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  aiDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
    marginBottom: 20,
  },
  aiButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  aiButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  statsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  statEmoji: {
    fontSize: 20,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  primaryAction: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  primaryActionGradient: {
    padding: 20,
  },
  actionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  actionArrow: {
    fontSize: 24,
    color: '#ffffff',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  secondaryActionContent: {
    padding: 16,
    alignItems: 'center',
  },
  secondaryActionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  secondaryActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  secondaryActionSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  focusContainer: {
    marginBottom: 32,
  },
  capsuleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  capsuleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  capsuleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  capsuleTime: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  capsuleBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  capsuleBadgeCalm: {
    backgroundColor: '#e0e7ff',
  },
  capsuleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  capsuleDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  capsuleTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  safetyCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  safetyIcon: {
    fontSize: 20,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 40,
  },
})
