import { ProfileCompletionBanner } from '@/components/profile-completion'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { useAuth } from '@clerk/clerk-expo'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { memo, useCallback, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const HEADER_DELAY = 0
const STAGGER = 70

export default function HomeContent() {
  const { palette, resolved, toggle } = useTheme()
  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const todaysCheckin = useQuery(api.checkin.getTodaysCheckin)
  const deleteOnboarding = useMutation(api.onboarding.deleteOnboarding)
  const createPendingSession = useMutation(api.trainer.createPendingSession)
  const { signOut } = useAuth()
  const [isStarting, setIsStarting] = useState(false)

  const handleStartSession = useCallback(async () => {
    if (isStarting) return
    setIsStarting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const sessionId = await createPendingSession({})
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
  }, [createPendingSession, isStarting])

  const handleCheckIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/checkin')
  }, [])

  const handleStartProfileQuestions = useCallback(() => {
    router.push('/profile-questions')
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await deleteOnboarding()
      await signOut()
    } catch (err) {
      console.error('Sign out error', err)
    }
  }, [deleteOnboarding, signOut])

  const handleToggleTheme = useCallback(() => {
    Haptics.selectionAsync()
    toggle()
  }, [toggle])

  const userName = onboardingData?.name || 'there'
  const firstName = userName.split(' ')[0]
  const checkinDone = !!todaysCheckin

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          entering={FadeInUp.duration(motion.duration.base)}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: palette.textTertiary }]}>
              Welcome back
            </Text>
            <Text style={[styles.name, { color: palette.textPrimary }]}>
              {firstName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              onPress={handleToggleTheme}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
            >
              <IconSymbol
                name={resolved === 'dark' ? 'sun.max.fill' : 'moon.fill'}
                size={18}
                color={palette.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              onPress={handleSignOut}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <IconSymbol name="gear" size={20} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <ProfileCompletionBanner onStartQuestions={handleStartProfileQuestions} />

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER).duration(motion.duration.base)}
        >
          <PrimaryAction
            isStarting={isStarting}
            checkinDone={checkinDone}
            onPress={handleStartSession}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 2).duration(motion.duration.base)}
          style={styles.checkInRow}
        >
          <CheckInCard checkin={todaysCheckin} onPress={handleCheckIn} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 3).duration(motion.duration.base)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              This week
            </Text>
            <Text style={[styles.sectionMeta, { color: palette.textTertiary }]}>
              4 of 5 sessions
            </Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              label="Streak"
              value="7"
              unit="days"
              icon="flame.fill"
              tint={palette.warning}
            />
            <StatCard
              label="Sessions"
              value="12"
              unit="total"
              icon="dumbbell.fill"
              tint={palette.primary}
            />
            <StatCard
              label="Energy"
              value="8.5"
              unit="avg"
              icon="bolt.fill"
              tint={palette.accentTeal}
            />
            <StatCard
              label="Pain"
              value="2.1"
              unit="avg"
              icon="heart.fill"
              tint={palette.accentPink}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 4).duration(motion.duration.base)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Recommended
            </Text>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={[styles.linkText, { color: palette.primary }]}>
                See all
              </Text>
            </TouchableOpacity>
          </View>

          <RecommendedCard
            title="Hip mobility flow"
            meta="15 min · 6 moves"
            badge="Gentle"
            badgeTint={palette.success}
            description="Perfect for desk workers. Addresses lower back discomfort with gentle progressions."
            tags={['No equipment', 'Beginner']}
          />
          <RecommendedCard
            title="Breath & recovery"
            meta="10 min · 4 techniques"
            badge="Calm"
            badgeTint={palette.accentTeal}
            description="Active recovery for busy days. Helps manage stress and supports sleep quality."
            tags={['Anywhere', 'All levels']}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 5).duration(motion.duration.base)}
          style={[
            styles.safetyCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <IconSymbol name="info.circle" size={16} color={palette.textSecondary} />
          <Text style={[styles.safetyText, { color: palette.textSecondary }]}>
            Recommendations adapt to your check-ins. Not medical advice. Talk to a
            professional for concerns.
          </Text>
        </Animated.View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  )
}

interface PrimaryActionProps {
  isStarting: boolean
  checkinDone: boolean
  onPress: () => void
}

const PrimaryAction = memo(function PrimaryAction({
  isStarting,
  checkinDone,
  onPress,
}: PrimaryActionProps) {
  const { palette, resolved, shadows } = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const cardShadow = resolved === 'dark' ? shadows.primaryDark : shadows.primary

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.98, motion.spring)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring)
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Start today's session"
    >
      <Animated.View
        style={[
          styles.primaryAction,
          { backgroundColor: palette.primary },
          cardShadow,
          animatedStyle,
        ]}
      >
        <View style={styles.primaryActionInner}>
          <View style={styles.primaryActionTextWrap}>
            <Text style={styles.primaryActionLabel}>Today</Text>
            <Text style={styles.primaryActionTitle}>
              {isStarting ? 'Building your session' : 'Start workout'}
            </Text>
            <Text style={styles.primaryActionSubtitle}>
              {checkinDone
                ? 'Personalized to your check-in'
                : 'Personalized plan with live coaching'}
            </Text>
          </View>
          <View style={styles.primaryActionIcon}>
            <IconSymbol name="play.fill" size={22} color={palette.white} />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  )
})

interface CheckInCardProps {
  checkin:
    | {
        energyLevel: number
        painLevel: number
        timeAvailable: string
        workoutType: string
      }
    | null
    | undefined
  onPress: () => void
}

const CheckInCard = memo(function CheckInCard({
  checkin,
  onPress,
}: CheckInCardProps) {
  const { palette } = useTheme()
  const isDone = !!checkin
  return (
    <TouchableOpacity
      style={[
        styles.checkInCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={isDone ? 'Update check-in' : 'Start check-in'}
    >
      <View
        style={[
          styles.checkInIcon,
          {
            backgroundColor: isDone ? palette.successMuted : palette.primaryMuted,
          },
        ]}
      >
        <IconSymbol
          name={isDone ? 'checkmark' : 'sparkles'}
          size={18}
          color={isDone ? palette.success : palette.primary}
        />
      </View>
      <View style={styles.checkInContent}>
        <Text style={[styles.checkInTitle, { color: palette.textPrimary }]}>
          {isDone ? "Today's check-in" : 'Daily check-in'}
        </Text>
        <Text
          style={[styles.checkInSubtitle, { color: palette.textSecondary }]}
          numberOfLines={1}
        >
          {isDone && checkin
            ? `Energy ${checkin.energyLevel}/10 · Pain ${checkin.painLevel}/10 · ${checkin.timeAvailable}m`
            : 'Tell us how you feel today'}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={palette.textTertiary} />
    </TouchableOpacity>
  )
})

interface StatCardProps {
  label: string
  value: string
  unit: string
  icon: React.ComponentProps<typeof IconSymbol>['name']
  tint: string
}

const StatCard = memo(function StatCard({
  label,
  value,
  unit,
  icon,
  tint,
}: StatCardProps) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.statHeader}>
        <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
          {label}
        </Text>
        <View style={[styles.statIcon, { backgroundColor: tint + '22' }]}>
          <IconSymbol name={icon} size={12} color={tint} />
        </View>
      </View>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: palette.textPrimary }]}>
          {value}
        </Text>
        <Text style={[styles.statUnit, { color: palette.textTertiary }]}>
          {unit}
        </Text>
      </View>
    </View>
  )
})

interface RecommendedCardProps {
  title: string
  meta: string
  badge: string
  badgeTint: string
  description: string
  tags: string[]
}

const RecommendedCard = memo(function RecommendedCard({
  title,
  meta,
  badge,
  badgeTint,
  description,
  tags,
}: RecommendedCardProps) {
  const { palette } = useTheme()
  return (
    <TouchableOpacity
      style={[
        styles.recCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      activeOpacity={0.85}
    >
      <View style={styles.recHeader}>
        <View style={styles.recHeaderLeft}>
          <Text style={[styles.recTitle, { color: palette.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.recMeta, { color: palette.textTertiary }]}>
            {meta}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeTint + '22' }]}>
          <Text style={[styles.badgeText, { color: badgeTint }]}>{badge}</Text>
        </View>
      </View>
      <Text style={[styles.recDescription, { color: palette.textSecondary }]}>
        {description}
      </Text>
      <View style={styles.recTags}>
        {tags.map(t => (
          <View
            key={t}
            style={[styles.tag, { backgroundColor: palette.surfaceAlt }]}
          >
            <Text style={[styles.tagText, { color: palette.textSecondary }]}>
              {t}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  greeting: {
    ...typography.small,
    marginBottom: 2,
  },
  name: {
    ...typography.h1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryAction: {
    borderRadius: radius.xl,
    marginTop: spacing.lg,
  },
  primaryActionInner: {
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  primaryActionTextWrap: {
    flex: 1,
  },
  primaryActionLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  primaryActionTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.92)',
  },
  primaryActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInRow: {
    marginTop: spacing.md,
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  checkInIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInContent: {
    flex: 1,
  },
  checkInTitle: {
    ...typography.bodyStrong,
  },
  checkInSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
  },
  sectionMeta: {
    ...typography.small,
  },
  linkText: {
    ...typography.smallStrong,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '47.8%',
    flexGrow: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statLabel: {
    ...typography.smallStrong,
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statValue: {
    ...typography.metric,
  },
  statUnit: {
    ...typography.small,
  },
  recCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  recHeaderLeft: {
    flex: 1,
    paddingRight: spacing.md,
  },
  recTitle: {
    ...typography.bodyStrong,
    marginBottom: 2,
  },
  recMeta: {
    ...typography.small,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
  },
  recDescription: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  recTags: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  tagText: {
    ...typography.small,
    fontWeight: '600',
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
  },
  safetyText: {
    flex: 1,
    ...typography.small,
  },
  bottomSpacing: {
    height: spacing.huge,
  },
})
