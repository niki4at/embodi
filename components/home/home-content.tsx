import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'

import { useFloatingTabBarInset } from '@/components/navigation/floating-tab-bar'
import {
  ContextEditorSheet,
  useForegroundPlaceMatch,
  type EquipmentIntent,
  type TrainingContextSelection,
  type TrainingEnvironment,
} from '@/components/training-context'
import { GradientText } from '@/components/ui/gradient-text'
import { Chip } from '@/components/ui/primitives'
import {
  energyDotFromLevel,
  energyLabelFromLevel,
  greetingForHour,
  painAreaLabel,
  SLEEP_LABEL,
  type SleepQuality,
} from '@/constants/checkin-labels'
import { motion, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { computeCycleStatus, type CyclePhase } from '@/convex/cycle'
import { labelForRegion } from '@/constants/flare-regions'

import { AdjustSheet } from './adjust-sheet'
import { FlareChip } from './flare-chip'
import { HomeHeader, type HomeTab } from './home-header'
import {
  CoachSection,
  ContextTiles,
  DeskSection,
  GoalsStrip,
  QuickActions,
  SuggestedCard,
  type ContextTile,
  type DeskMove,
  type GoalCard,
} from './home-sections'
import { StartOrb, type OrbContent } from './start-orb'
import { WeeklyInsightsSection } from './weekly-insights'

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

const CYCLE_PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  unknown: 'Cycle',
}

const DESK_MOVES: DeskMove[] = [
  { id: 'neck-reset', title: 'Neck reset', meta: '3 min \u00b7 seated', durationMin: 3 },
  { id: 'wrist-eyes', title: 'Wrist & eyes', meta: '5 min \u00b7 standing', durationMin: 5 },
]

type TodaysCheckin =
  | {
      _id: Id<'daily_checkins'>
      energyLevel: number
      painLevel: number
      painAreas?: string[]
      sleepQuality: SleepQuality
      timeAvailable: string
      workoutType: string
    }
  | null
  | undefined

type TodaysSession =
  | {
      _id: Id<'workout_sessions'>
      status:
        | 'generating'
        | 'generated'
        | 'in-progress'
        | 'completed'
        | 'discarded'
        | 'failed'
      goal: string
      modality: string
      durationMin: number
      source?: 'custom' | 'coach'
      planCount: number
      setsLogged: number
      totalTargetSets: number
    }
  | null
  | undefined

type CompletedTodaySession = {
  _id: Id<'workout_sessions'>
  goal: string
  modality: string
  durationMin: number
  actualDurationMin?: number | null
  setsLogged: number
  totalTargetSets: number
  completedAt: number
}

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
  completedToday: CompletedTodaySession[] | undefined,
): TodayState {
  if (
    checkin === undefined ||
    session === undefined ||
    completedToday === undefined
  ) {
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
  if (checkin && completedToday.length === 0) {
    return { kind: 'checkin-orphan' }
  }
  return { kind: 'needs-checkin' }
}

type Recommendation = {
  title: string
  durationMin: number
  moveCount: number
  modality: string
  description: string
  reasoning: string
  tags: string[]
}

type InsightShape = {
  status: 'generating' | 'ready' | 'failed'
  headline?: string
  alignedRecommendations: Recommendation[]
  explorationRecommendations: Recommendation[]
} | null

function recommendationSeedHref(
  rec: Recommendation,
  source: 'aligned' | 'exploration',
): Href {
  return {
    pathname: '/checkin',
    params: {
      rec: JSON.stringify({
        title: rec.title,
        modality: rec.modality,
        durationMin: rec.durationMin,
        moveCount: rec.moveCount,
        description: rec.description,
        reasoning: rec.reasoning,
        tags: rec.tags,
        source,
      }),
    },
  } as unknown as Href
}

export default function HomeContent() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()
  const [tab, setTab] = useState<HomeTab>('today')

  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const trainingPreferences = useQuery(api.trainingPreferences.get)
  const equipmentInventory = useQuery(api.equipment.listActive)
  const todaysCheckin = useQuery(api.checkin.getTodaysCheckin) as TodaysCheckin
  const todaysSession = useQuery(api.trainer.getTodaysSession) as TodaysSession
  const completedToday = useQuery(api.trainer.getTodaysCompletedSessions) as
    | CompletedTodaySession[]
    | undefined
  const flare = useQuery(api.flareUp.getFlareUp)
  const challenges = useQuery(api.challenges.listChallenges) as
    | GoalCard[]
    | undefined
  const insight = useQuery(api.weeklyInsights.getCurrentWeekInsight) as
    | InsightShape
    | undefined
  const overview = useQuery(api.profileSummary.getProfileOverview, {
    now: useMemo(() => Date.now(), []),
  })
  const cycleEnabled = onboardingData?.trackPeriod === true
  const cycleData = useQuery(
    api.cycle.getRecentEntries,
    cycleEnabled ? { limit: 6 } : 'skip',
  )
  const routines = useQuery(api.routines.listRoutines)
  const startSessionFromCheckin = useMutation(
    api.checkin.startSessionFromTodaysCheckin,
  )

  const [isRecoveringSession, setIsRecoveringSession] = useState(false)
  const [isStartingCoachSession, setIsStartingCoachSession] = useState(false)
  const [contextEditorOpen, setContextEditorOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [deskEnabled, setDeskEnabled] = useState(true)
  const [contextOverride, setContextOverride] =
    useState<TrainingContextSelection | null>(null)

  const cycleStatus = useMemo(() => {
    if (!cycleEnabled || !cycleData) return null
    return computeCycleStatus(cycleData.entries, Date.now())
  }, [cycleEnabled, cycleData])

  const { match: foregroundPlaceMatch } = useForegroundPlaceMatch(
    trainingPreferences?.locationEnabled === true,
  )
  const [suggestionNow] = useState(() => new Date())
  const contextSuggestion = useQuery(api.trainingContext.suggest, {
    foregroundPlaceMatch: foregroundPlaceMatch ?? undefined,
    goal: onboardingData?.goal,
    weekday: WEEKDAYS[suggestionNow.getDay()],
    timeOfDay: suggestionNow.getHours() < 12 ? 'morning' : 'evening',
  })
  const equipmentSnapshot = useMemo(
    () =>
      (equipmentInventory ?? []).map(({ equipment }) => ({
        catalogKey: equipment.catalogKey,
        label: equipment.label,
        details: equipment.details,
        capabilities: equipment.capabilities,
      })),
    [equipmentInventory],
  )
  const inferredEnvironment: TrainingEnvironment =
    contextSuggestion?.environment.value ??
    trainingPreferences?.defaultContext.trainingEnvironment ??
    'home'
  const inferredEquipmentIntent: EquipmentIntent =
    contextSuggestion?.equipmentIntent.value ??
    trainingPreferences?.defaultContext.equipmentIntent ??
    (inferredEnvironment === 'home' && equipmentSnapshot.length === 0
      ? 'bodyweight'
      : 'available')
  const likelyContext: TrainingContextSelection =
    contextOverride ?? {
      trainingEnvironment: inferredEnvironment,
      equipmentIntent:
        inferredEnvironment === 'home' &&
        inferredEquipmentIntent === 'available' &&
        equipmentSnapshot.length === 0
          ? 'bodyweight'
          : inferredEquipmentIntent,
      contextTags: [],
      suggestionSource:
        contextSuggestion?.environment.source ??
        contextSuggestion?.equipmentIntent.source ??
        'fallback',
      suggestionReason:
        contextSuggestion?.environment.reason ??
        'Uses your default training context',
      equipmentSnapshot,
      unavailableEquipment: [],
    }

  const state = deriveTodayState(todaysCheckin, todaysSession, completedToday)

  const navigateToSession = useCallback(
    (
      sessionId: Id<'workout_sessions'>,
      destination: 'ready' | 'logging' = 'logging',
    ) => {
      router.push({
        pathname: destination === 'ready' ? '/session/ready' : '/session',
        params: { sessionId: String(sessionId) },
      } as unknown as Href)
    },
    [],
  )

  const openFreshCheckin = useCallback(
    (extra?: Record<string, string>) => {
      const params: Record<string, string> = { ...(extra ?? {}) }
      if (contextOverride) {
        params.trainingEnvironment = contextOverride.trainingEnvironment
        params.equipmentIntent = contextOverride.equipmentIntent
        params.contextTags = JSON.stringify(contextOverride.contextTags)
        params.unavailableEquipment = JSON.stringify(
          contextOverride.unavailableEquipment,
        )
      }
      if (Object.keys(params).length === 0) {
        router.push('/checkin')
        return
      }
      router.push({ pathname: '/checkin', params } as unknown as Href)
    },
    [contextOverride],
  )

  const startReusingTodaysCheckin = useCallback(async () => {
    if (isStartingCoachSession) return
    setIsStartingCoachSession(true)
    try {
      const sessionId = await startSessionFromCheckin({ allowAdditional: true })
      navigateToSession(sessionId, 'ready')
    } catch (error) {
      console.error('Failed to start session from check-in', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsStartingCoachSession(false)
    }
  }, [isStartingCoachSession, startSessionFromCheckin, navigateToSession])

  const handleAskCoach = useCallback(() => {
    if (todaysCheckin) {
      Alert.alert(
        'Start another session',
        "Use today's check-in or start a fresh one?",
        [
          { text: 'Reuse check-in', onPress: () => void startReusingTodaysCheckin() },
          { text: 'New check-in', onPress: () => openFreshCheckin() },
          { text: 'Cancel', style: 'cancel' },
        ],
      )
      return
    }
    openFreshCheckin()
  }, [todaysCheckin, startReusingTodaysCheckin, openFreshCheckin])

  const handleOrbPress = useCallback(async () => {
    switch (state.kind) {
      case 'loading':
        return
      case 'needs-checkin':
        openFreshCheckin()
        return
      case 'generating':
        navigateToSession(state.sessionId, 'ready')
        return
      case 'ready': {
        const destination =
          state.session.source === 'custom' ? 'logging' : 'ready'
        navigateToSession(state.session._id, destination)
        return
      }
      case 'in-progress':
        navigateToSession(state.session._id, 'logging')
        return
      case 'completed':
        handleAskCoach()
        return
      case 'checkin-orphan': {
        if (isRecoveringSession) return
        setIsRecoveringSession(true)
        try {
          const sessionId = await startSessionFromCheckin({})
          navigateToSession(sessionId, 'ready')
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
      default: {
        const _exhaustive: never = state
        return _exhaustive
      }
    }
  }, [
    state,
    navigateToSession,
    startSessionFromCheckin,
    isRecoveringSession,
    openFreshCheckin,
    handleAskCoach,
  ])

  const handleOpenRecap = useCallback((sessionId: Id<'workout_sessions'>) => {
    router.push({
      pathname: '/session/recap',
      params: { sessionId: String(sessionId) },
    } as unknown as Href)
  }, [])

  /* ------------------------------------------------------------------ copy */

  const firstName = (onboardingData?.name || 'there').split(' ')[0]
  const greeting = greetingForHour(suggestionNow.getHours())

  const flareRegions = flare?.active ? flare.regions : []
  const painAreas = todaysCheckin?.painAreas ?? []

  const contextLine = useMemo(() => {
    if (flareRegions.length > 0) {
      return `Flare-up mode is on, so today eases off your ${flareRegions
        .map((r) => labelForRegion(r).toLowerCase())
        .join(' and ')}.`
    }
    if (painAreas.length > 0) {
      return `You logged ${painAreas
        .slice(0, 2)
        .map((a) => painAreaLabel(a).toLowerCase())
        .join(' and ')} soreness today, so this session goes easy there.`
    }
    if (state.kind === 'completed') {
      return 'Session done. Anything else today is a bonus.'
    }
    if (state.kind === 'needs-checkin') {
      return 'Check in and the coach builds today around how you feel.'
    }
    return 'Built from your check-in, not a fixed plan.'
  }, [flareRegions, painAreas, state.kind])

  const orbContent = useMemo<OrbContent>(() => {
    switch (state.kind) {
      case 'loading':
        return { word: '\u2026', title: 'Loading your day', spinning: true }
      case 'needs-checkin':
        return {
          word: 'Check in',
          meta: 'about 2 minutes',
          title: 'Start your movement',
          subtitle: 'The coach builds today from your sleep, energy, and body.',
        }
      case 'checkin-orphan':
        return {
          word: isRecoveringSession ? 'Starting' : 'Start',
          meta: `${todaysCheckin?.timeAvailable ?? 30} mins`,
          title: 'Build today\u2019s session',
          subtitle: 'From this morning\u2019s check-in',
          spinning: isRecoveringSession,
        }
      case 'generating':
        return {
          word: 'Building',
          meta: 'coach is planning',
          title: 'Coach is building today around you',
          spinning: true,
        }
      case 'ready':
        return {
          word: 'Start',
          meta: `${state.session.durationMin} mins \u00b7 ${state.session.planCount} moves`,
          title: state.session.goal,
          subtitle: state.session.modality,
          subtitleAccent: onboardingData?.goal
            ? `toward ${onboardingData.goal.toLowerCase()}`
            : undefined,
        }
      case 'in-progress': {
        const pct = state.session.totalTargetSets
          ? Math.round(
              (state.session.setsLogged / state.session.totalTargetSets) * 100,
            )
          : 0
        return {
          word: 'Continue',
          meta: `${state.session.setsLogged} of ${state.session.totalTargetSets} sets`,
          title: state.session.goal,
          subtitle: `${pct}% done`,
          progress: pct,
        }
      }
      case 'completed':
        return {
          word: 'Done',
          meta: `${state.session.setsLogged} sets logged`,
          title: state.session.goal,
          subtitle: 'Tap to start another session',
        }
      default: {
        const _exhaustive: never = state
        return _exhaustive
      }
    }
  }, [state, isRecoveringSession, todaysCheckin, onboardingData?.goal])

  const contextTiles = useMemo<ContextTile[]>(() => {
    const sleep = todaysCheckin
      ? SLEEP_LABEL[todaysCheckin.sleepQuality] ?? 'Logged'
      : 'Not logged'
    const energy = todaysCheckin
      ? energyLabelFromLevel(todaysCheckin.energyLevel)
      : 'Not logged'
    const recovery =
      painAreas.length > 0
        ? painAreas.slice(0, 2).map(painAreaLabel).join(', ')
        : flareRegions.length > 0
          ? flareRegions.map(labelForRegion).join(', ')
          : 'Feeling fresh'
    const week = overview?.stats
      ? `${overview.stats.workoutsThisWeek} of ${overview.stats.weeklyGoal} sessions`
      : '\u2014'
    return [
      {
        key: 'sleep',
        label: 'Sleep',
        value: sleep,
        dot: palette.primary,
        onPress: () => openFreshCheckin(),
      },
      {
        key: 'energy',
        label: 'Energy',
        value: energy,
        dot: todaysCheckin
          ? energyDotFromLevel(todaysCheckin.energyLevel, palette)
          : palette.energyOkay,
        onPress: () => openFreshCheckin(),
      },
      {
        key: 'recovery',
        label: 'Recovery',
        value: recovery,
        dot: palette.warning,
        onPress: () => openFreshCheckin({ step: '1' }),
      },
      {
        key: 'week',
        label: 'This week',
        value: week,
        dot: palette.accent,
        onPress: () => setTab('week'),
      },
    ]
  }, [todaysCheckin, painAreas, flareRegions, overview, palette, openFreshCheckin])

  const readyInsight = insight && insight.status === 'ready' ? insight : null
  const coachRec = readyInsight?.alignedRecommendations[0] ?? null
  const suggestedRec =
    readyInsight?.explorationRecommendations[0] ??
    (readyInsight?.alignedRecommendations[1] ?? null)

  const coachText =
    readyInsight?.headline ??
    (coachRec
      ? `${coachRec.reasoning} Want to try ${coachRec.title.toLowerCase()}?`
      : 'Every session is built from your check-in, so tell me how today feels and I\u2019ll take it from there.')

  const goals = useMemo<GoalCard[]>(
    () =>
      (challenges ?? []).filter(
        (c) => c.status === 'active' || c.status === 'generating',
      ),
    [challenges],
  )

  const quickActions = useMemo(() => {
    const actions: { label: string; onPress: () => void }[] = [
      { label: 'Log my own check in', onPress: () => openFreshCheckin() },
      {
        label: 'Take a breather',
        onPress: () =>
          router.push(
            recommendationSeedHref(
              {
                title: 'Take a breather',
                modality: 'recovery',
                durationMin: 10,
                moveCount: 4,
                description: 'Slow breathing and gentle mobility to reset.',
                reasoning: 'You asked for a breather.',
                tags: ['recovery', 'breath'],
              },
              'exploration',
            ),
          ),
      },
      { label: 'Build my own workout', onPress: () => router.push('/build-workout' as Href) },
    ]
    if (routines && routines.length > 0) {
      actions.push({
        label: 'Your routines',
        onPress: () => router.push('/routines' as Href),
      })
    }
    return actions
  }, [openFreshCheckin, routines])

  const handleStartDeskMove = useCallback((move: DeskMove) => {
    router.push(
      recommendationSeedHref(
        {
          title: move.title,
          modality: 'mobility',
          durationMin: move.durationMin,
          moveCount: 3,
          description: `${move.title}: a short desk reset you can do in work clothes.`,
          reasoning: 'Micro-session picked from the At your desk strip.',
          tags: ['desk', 'mobility'],
        },
        'exploration',
      ),
    )
  }, [])

  const cycleChipLabel =
    cycleEnabled && cycleStatus
      ? cycleStatus.hasData && cycleStatus.phase !== 'unknown'
        ? `${CYCLE_PHASE_LABEL[cycleStatus.phase]}${
            cycleStatus.dayOfCycle ? ` \u00b7 Day ${cycleStatus.dayOfCycle}` : ''
          }`
        : 'Log your cycle'
      : null

  const sessionForAdjust =
    state.kind === 'ready' ||
    state.kind === 'in-progress' ||
    state.kind === 'completed'
      ? state.session
      : null

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <HomeHeader tab={tab} onChange={setTab} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarInset },
        ]}
      >
        {tab === 'week' ? (
          <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
            <WeeklyInsightsSection />
          </Animated.View>
        ) : (
          <>
            <Animated.View
              entering={FadeInUp.duration(motion.duration.base)}
              style={styles.header}
            >
              <Text style={[styles.greeting, { color: palette.textPrimary }]}>
                {greeting},
              </Text>
              <GradientText
                fontFamily={fonts.displayBold}
                fontSize={28}
                lineHeight={34}
                letterSpacing={-0.6}
                accessibilityLabel={firstName}
              >
                {firstName}
              </GradientText>
              <Text style={[styles.contextLine, { color: palette.textSecondary }]}>
                {contextLine}
              </Text>
              <View style={styles.chipRow}>
                {cycleChipLabel ? (
                  <Chip
                    label={cycleChipLabel}
                    onPress={() => router.push('/cycle')}
                    style={[styles.smallChip, { backgroundColor: palette.surfaceAlt, borderColor: palette.surfaceAlt }]}
                    leading={<View style={[styles.chipDot, { backgroundColor: palette.accent }]} />}
                  />
                ) : null}
                <FlareChip />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(60).duration(motion.duration.base)}>
              <StartOrb
                content={orbContent}
                onPress={() => void handleOrbPress()}
                disabled={state.kind === 'loading'}
                adjustLabel={state.kind === 'loading' ? undefined : 'Adjust for today'}
                onAdjust={() => setAdjustOpen(true)}
              />
            </Animated.View>

            {completedToday && completedToday.length > 0 && state.kind !== 'completed' ? (
              <View style={styles.doneRow}>
                {completedToday.map((session) => (
                  <Chip
                    key={session._id}
                    label={`Done: ${session.goal} \u00b7 ${session.actualDurationMin ?? session.durationMin} min`}
                    onPress={() => handleOpenRecap(session._id)}
                    style={[styles.smallChip, { backgroundColor: palette.successMuted, borderColor: palette.successMuted }]}
                    leading={<View style={[styles.chipDot, { backgroundColor: palette.success }]} />}
                  />
                ))}
              </View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(120).duration(motion.duration.base)}>
              <ContextTiles tiles={contextTiles} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).duration(motion.duration.base)}>
              <CoachSection
                text={coachText}
                actionLabel={coachRec ? 'Build a session' : 'Check in'}
                onAction={() =>
                  coachRec
                    ? router.push(recommendationSeedHref(coachRec, 'aligned'))
                    : openFreshCheckin()
                }
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(motion.duration.base)}>
              <GoalsStrip
                goals={goals}
                onOpen={(id) =>
                  router.push({
                    pathname: '/challenge/[id]',
                    params: { id: String(id) },
                  } as unknown as Href)
                }
                onSeeAll={() => router.push('/(tabs)/challenges' as Href)}
              />
              {suggestedRec ? (
                <SuggestedCard
                  eyebrow={suggestionNow.getHours() >= 17 ? 'Suggested tonight' : 'Suggested today'}
                  title={`${suggestedRec.durationMin} min ${suggestedRec.title.toLowerCase()}`}
                  meta={`${suggestedRec.modality} \u00b7 ${suggestedRec.moveCount} moves`}
                  onPress={() =>
                    router.push(recommendationSeedHref(suggestedRec, 'exploration'))
                  }
                />
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(motion.duration.base)}>
              <QuickActions actions={quickActions} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(280).duration(motion.duration.base)}>
              <DeskSection
                enabled={deskEnabled}
                onToggle={setDeskEnabled}
                moves={DESK_MOVES}
                onStart={handleStartDeskMove}
              />
            </Animated.View>

            <Text style={[styles.footnote, { color: palette.textTertiary }]}>
              Sessions adapt to your check-ins. Not medical advice.
            </Text>
          </>
        )}
      </ScrollView>

      <AdjustSheet
        visible={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        checkin={todaysCheckin ?? null}
        planCount={sessionForAdjust?.planCount ?? 0}
        sessionStarted={
          sessionForAdjust !== null && sessionForAdjust.status !== 'generated'
        }
        onFullAdjustment={() => {
          setAdjustOpen(false)
          openFreshCheckin()
        }}
        onEditBodyMap={() => {
          setAdjustOpen(false)
          openFreshCheckin({ step: '1', bodyMap: '1' })
        }}
        onRetuned={(sessionId, regenerated) => {
          setAdjustOpen(false)
          if (regenerated && sessionId) navigateToSession(sessionId, 'ready')
        }}
      />

      <ContextEditorSheet
        visible={contextEditorOpen}
        value={likelyContext}
        onClose={() => setContextEditorOpen(false)}
        onSave={(value) => {
          setContextOverride(value)
          setContextEditorOpen(false)
        }}
        showTrainingSetupLink={
          likelyContext.trainingEnvironment === 'home' &&
          equipmentSnapshot.length === 0
        }
        onOpenTrainingSetup={() => {
          setContextEditorOpen(false)
          router.push('/training-setup' as Href)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: {
    gap: 2,
  },
  greeting: {
    ...typography.h1,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.displaySemiBold,
  },
  contextLine: {
    ...typography.small,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  smallChip: {
    minHeight: 30,
    paddingHorizontal: 12,
    gap: 6,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  doneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footnote: {
    ...typography.small,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
})
