import { ProfileCompletionBanner } from '@/components/profile-completion'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { memo, useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import { computeCycleStatus, type CyclePhase } from '@/convex/cycle'
import { WeeklyInsightsSection } from './weekly-insights'

const CYCLE_PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  unknown: 'Tracking',
}

const HEADER_DELAY = 0
const STAGGER = 70

type TodaysCheckin = {
  _id: Id<'daily_checkins'>
  energyLevel: number
  painLevel: number
  timeAvailable: string
  workoutType: string
} | null | undefined

type TodaysSession = {
  _id: Id<'workout_sessions'>
  status: 'generating' | 'generated' | 'in-progress' | 'completed' | 'failed'
  goal: string
  modality: string
  durationMin: number
  planCount: number
  setsLogged: number
  totalTargetSets: number
} | null | undefined

type TodayState =
  | { kind: 'loading' }
  | { kind: 'needs-checkin' }
  | { kind: 'checkin-orphan' }
  | { kind: 'generating'; sessionId: Id<'workout_sessions'> }
  | {
      kind: 'ready' | 'in-progress' | 'completed'
      session: NonNullable<TodaysSession>
    }

function deriveTodayState(
  checkin: TodaysCheckin,
  session: TodaysSession,
): TodayState {
  if (checkin === undefined || session === undefined) {
    return { kind: 'loading' }
  }
  if (session) {
    if (session.status === 'generating') {
      return { kind: 'generating', sessionId: session._id }
    }
    if (session.status === 'in-progress') {
      return { kind: 'in-progress', session }
    }
    if (session.status === 'completed') {
      return { kind: 'completed', session }
    }
    return { kind: 'ready', session }
  }
  if (checkin) {
    return { kind: 'checkin-orphan' }
  }
  return { kind: 'needs-checkin' }
}

export default function HomeContent() {
  const { palette, resolved, toggle } = useTheme()
  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const todaysCheckin = useQuery(api.checkin.getTodaysCheckin)
  const todaysSession = useQuery(api.trainer.getTodaysSession)
  const cycleEnabled = onboardingData?.trackPeriod === true
  const cycleData = useQuery(
    api.cycle.getRecentEntries,
    cycleEnabled ? { limit: 6 } : 'skip',
  )
  const startSessionFromCheckin = useMutation(
    api.checkin.startSessionFromTodaysCheckin,
  )
  const [isRecoveringSession, setIsRecoveringSession] = useState(false)

  const cycleStatus = useMemo(() => {
    if (!cycleEnabled || !cycleData) return null
    return computeCycleStatus(cycleData.entries, Date.now())
  }, [cycleEnabled, cycleData])

  const state = deriveTodayState(todaysCheckin, todaysSession)

  const navigateToSession = useCallback(
    (sessionId: Id<'workout_sessions'>) => {
      const sessionHref = {
        pathname: '/session',
        params: { sessionId: String(sessionId) },
      } as unknown as Href
      router.push(sessionHref)
    },
    [],
  )

  const handleTodayPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    switch (state.kind) {
      case 'loading':
        return
      case 'needs-checkin':
        router.push('/checkin')
        return
      case 'generating':
      case 'ready':
      case 'in-progress':
      case 'completed': {
        const sessionId =
          state.kind === 'generating' ? state.sessionId : state.session._id
        navigateToSession(sessionId)
        return
      }
      case 'checkin-orphan': {
        if (isRecoveringSession) return
        setIsRecoveringSession(true)
        try {
          const sessionId = await startSessionFromCheckin({})
          navigateToSession(sessionId)
        } catch (error) {
          console.error('Failed to start session from check-in', error)
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          )
        } finally {
          setIsRecoveringSession(false)
        }
        return
      }
    }
  }, [state, navigateToSession, startSessionFromCheckin, isRecoveringSession])

  const handleUpdateCheckIn = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/checkin')
  }, [])

  const handleStartProfileQuestions = useCallback(() => {
    router.push('/profile-questions')
  }, [])

  const handleOpenSettings = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/settings')
  }, [])

  const handleOpenCycle = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/cycle')
  }, [])

  const handleToggleTheme = useCallback(() => {
    Haptics.selectionAsync()
    toggle()
  }, [toggle])

  const userName = onboardingData?.name || 'there'
  const firstName = userName.split(' ')[0]

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
                color={resolved === 'dark' ? palette.white : palette.textPrimary}
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
              onPress={handleOpenSettings}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <IconSymbol
                name="gear"
                size={20}
                color={resolved === 'dark' ? palette.white : palette.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <ProfileCompletionBanner onStartQuestions={handleStartProfileQuestions} />

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER).duration(motion.duration.base)}
        >
          <TodayCard
            state={state}
            isRecovering={isRecoveringSession}
            onPress={handleTodayPress}
          />
        </Animated.View>

        {todaysCheckin && (
          <Animated.View
            entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 2).duration(motion.duration.base)}
            style={styles.checkInChipRow}
          >
            <TouchableOpacity
              onPress={handleUpdateCheckIn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Update today's check-in"
              style={styles.checkInChip}
            >
              <IconSymbol
                name="checkmark"
                size={14}
                color={palette.success}
              />
              <Text
                style={[styles.checkInChipText, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                Today&apos;s check-in · Energy {todaysCheckin.energyLevel}/10 · Pain{' '}
                {todaysCheckin.painLevel}/10 · {todaysCheckin.timeAvailable}m
              </Text>
              <Text style={[styles.checkInChipAction, { color: palette.primary }]}>
                Update
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {cycleEnabled && cycleData !== undefined && (
          <Animated.View
            entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 2.5).duration(motion.duration.base)}
            style={styles.checkInChipRow}
          >
            <TouchableOpacity
              onPress={handleOpenCycle}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open cycle tracker"
              style={styles.checkInChip}
            >
              <IconSymbol
                name="drop.fill"
                size={14}
                color={palette.primary}
              />
              <Text
                style={[styles.checkInChipText, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {cycleStatus && cycleStatus.hasData
                  ? `Cycle · ${CYCLE_PHASE_LABEL[cycleStatus.phase]}${cycleStatus.dayOfCycle && cycleStatus.phase !== 'unknown' ? ` · day ${cycleStatus.dayOfCycle}` : ''}`
                  : 'Cycle · Log your first period to start'}
              </Text>
              <Text style={[styles.checkInChipAction, { color: palette.primary }]}>
                {cycleStatus?.hasData ? 'Open' : 'Log'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(HEADER_DELAY + STAGGER * 3).duration(motion.duration.base)}
        >
          <WeeklyInsightsSection />
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

interface TodayCardProps {
  state: TodayState
  isRecovering: boolean
  onPress: () => void
}

type CardVariant = 'primary' | 'success' | 'muted'

interface CardContent {
  variant: CardVariant
  label: string
  title: string
  subtitle: string
  iconName: React.ComponentProps<typeof IconSymbol>['name']
  showSpinner: boolean
  progress?: number
}

function getCardContent(state: TodayState, isRecovering: boolean): CardContent {
  switch (state.kind) {
    case 'loading':
      return {
        variant: 'muted',
        label: 'TODAY',
        title: 'Loading',
        subtitle: 'Fetching your day',
        iconName: 'sparkles',
        showSpinner: true,
      }
    case 'needs-checkin':
      return {
        variant: 'primary',
        label: 'TODAY',
        title: 'Build today\u2019s session',
        subtitle: '4 quick questions, then your workout',
        iconName: 'sparkles',
        showSpinner: false,
      }
    case 'checkin-orphan':
      return {
        variant: 'primary',
        label: 'TODAY',
        title: isRecovering ? 'Starting' : 'Start today\u2019s session',
        subtitle: 'Built from your check-in',
        iconName: 'play.fill',
        showSpinner: isRecovering,
      }
    case 'generating':
      return {
        variant: 'primary',
        label: 'TODAY',
        title: 'Building your session',
        subtitle: 'Adapting to today\u2019s check-in',
        iconName: 'sparkles',
        showSpinner: true,
      }
    case 'ready': {
      const { session } = state
      return {
        variant: 'primary',
        label: 'TODAY',
        title: session.goal,
        subtitle: `${session.modality} \u00b7 ${session.durationMin} min \u00b7 ${session.planCount} exercises`,
        iconName: 'play.fill',
        showSpinner: false,
      }
    }
    case 'in-progress': {
      const { session } = state
      const pct = session.totalTargetSets
        ? Math.round((session.setsLogged / session.totalTargetSets) * 100)
        : 0
      return {
        variant: 'primary',
        label: 'IN PROGRESS',
        title: 'Continue session',
        subtitle: `${session.setsLogged} of ${session.totalTargetSets} sets \u00b7 ${pct}% done`,
        iconName: 'arrow.right',
        showSpinner: false,
        progress: pct,
      }
    }
    case 'completed':
      return {
        variant: 'success',
        label: 'DONE TODAY',
        title: 'Session complete',
        subtitle: 'View your recap and notes',
        iconName: 'checkmark',
        showSpinner: false,
      }
  }
}

const TodayCard = memo(function TodayCard({
  state,
  isRecovering,
  onPress,
}: TodayCardProps) {
  const { palette, resolved, shadows } = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const content = getCardContent(state, isRecovering)
  const isLoading = state.kind === 'loading'

  const backgroundColor =
    content.variant === 'success'
      ? palette.success
      : content.variant === 'muted'
        ? palette.surface
        : palette.primary

  const textOnSolid = '#FFFFFF'
  const titleColor = content.variant === 'muted' ? palette.textPrimary : textOnSolid
  const subtitleColor =
    content.variant === 'muted'
      ? palette.textSecondary
      : 'rgba(255,255,255,0.92)'
  const labelColor =
    content.variant === 'muted'
      ? palette.textTertiary
      : 'rgba(255,255,255,0.85)'
  const iconBgColor =
    content.variant === 'muted'
      ? palette.primaryMuted
      : 'rgba(255,255,255,0.22)'
  const iconColor = content.variant === 'muted' ? palette.primary : textOnSolid

  const cardShadow =
    content.variant === 'muted'
      ? undefined
      : resolved === 'dark'
        ? shadows.primaryDark
        : shadows.primary

  return (
    <Pressable
      onPressIn={() => {
        if (isLoading) return
        scale.value = withSpring(0.98, motion.spring)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring)
      }}
      onPress={onPress}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={content.title}
    >
      <Animated.View
        style={[
          styles.primaryAction,
          {
            backgroundColor,
            borderWidth: content.variant === 'muted' ? 1 : 0,
            borderColor: palette.border,
          },
          cardShadow,
          animatedStyle,
        ]}
      >
        <View style={styles.primaryActionInner}>
          <View style={styles.primaryActionTextWrap}>
            <Text style={[styles.primaryActionLabel, { color: labelColor }]}>
              {content.label}
            </Text>
            <Text
              style={[styles.primaryActionTitle, { color: titleColor }]}
              numberOfLines={2}
            >
              {content.title}
            </Text>
            <Text
              style={[styles.primaryActionSubtitle, { color: subtitleColor }]}
              numberOfLines={2}
            >
              {content.subtitle}
            </Text>
          </View>
          <View
            style={[styles.primaryActionIcon, { backgroundColor: iconBgColor }]}
          >
            {content.showSpinner ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <IconSymbol name={content.iconName} size={22} color={iconColor} />
            )}
          </View>
        </View>
        {content.progress !== undefined && (
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: 'rgba(255,255,255,0.25)' },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(0, Math.min(100, content.progress))}%`,
                  backgroundColor: textOnSolid,
                },
              ]}
            />
          </View>
        )}
      </Animated.View>
    </Pressable>
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
    overflow: 'hidden',
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
    marginBottom: 4,
  },
  primaryActionTitle: {
    ...typography.h2,
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    ...typography.small,
  },
  primaryActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  checkInChipRow: {
    marginTop: spacing.md,
  },
  checkInChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkInChipText: {
    ...typography.small,
    flex: 1,
  },
  checkInChipAction: {
    ...typography.smallStrong,
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
