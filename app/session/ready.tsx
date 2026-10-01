import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import CitationsPanel from '@/components/trainer/CitationsPanel'
import { DraggableExerciseList } from '@/components/trainer/DraggableExerciseList'
import ExercisePreviewSheet from '@/components/trainer/ExercisePreviewSheet'
import {
  buildExerciseMeta,
  groupPlanByPhase,
  PHASE_META,
  type ExercisePhase,
} from '@/components/trainer/phases'
import type { ExercisePlan } from '@/components/trainer/types'
import { BodfitWordmark } from '@/components/ui/bodfit-logo'
import { GradientText } from '@/components/ui/gradient-text'
import { PillButton } from '@/components/ui/pill-button'
import {
  CoachNote,
  Eyebrow,
  HeroOrb,
  SummaryRows,
} from '@/components/ui/primitives'
import { painAreaLabel } from '@/constants/checkin-labels'
import { gradients, motion, radius, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { buildCheckinSummary } from '@/utils/checkin-summary'

type SessionParams = {
  sessionId?: string
  view?: string
  from?: string
}

const ROW_HEIGHT = 56
const ROW_SPACING = 0

const PHASE_DOT: Record<ExercisePhase, keyof ReturnType<typeof useTheme>['palette']> = {
  warmup: 'energyOkay',
  main: 'energyLow',
  cooldown: 'flare',
}

function estimatePhaseMinutes(exercises: ExercisePlan[]): number {
  return Math.max(
    1,
    Math.round(
      exercises.reduce((total, exercise) => {
        if (exercise.durationMin) return total + exercise.durationMin
        const perSet = (exercise.restSec || 60) / 60 + 0.75
        return total + exercise.targetSets * perSet
      }, 0),
    ),
  )
}

export default function SessionReadyScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<SessionParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined

  const sessionData = useQuery(
    api.trainer.getSessionWithSets,
    sessionId ? { sessionId } : 'skip',
  )
  const todaysCheckin = useQuery(api.checkin.getTodaysCheckin)
  const reorderPlan = useMutation(api.trainer.reorderSessionPlan)

  const [view, setView] = useState<'summary' | 'list'>(
    params.view === 'list' || params.from === 'adjust' ? 'list' : 'summary',
  )
  const [showCitations, setShowCitations] = useState(false)
  const [previewState, setPreviewState] = useState<{
    exercise: ExercisePlan
    phase: ExercisePhase
    positionLabel: string
  } | null>(null)

  const session = sessionData?.session
  const isGenerating = session?.status === 'generating'
  const isFailed = session?.status === 'failed'

  // A session that was already opened once goes straight to the list.
  useEffect(() => {
    if (session && session.status !== 'generating' && session.status !== 'generated') {
      setView('list')
    }
  }, [session])

  const planExercises = useMemo<ExercisePlan[]>(() => {
    if (!session) return []
    return session.plan.map((exercise) => ({
      ...exercise,
      targetReps: Array.isArray(exercise.targetReps)
        ? exercise.targetReps
        : [exercise.targetReps ?? 0],
    }))
  }, [session])

  const groups = useMemo(() => groupPlanByPhase(planExercises), [planExercises])
  const totalSets = useMemo(
    () => planExercises.reduce((acc, ex) => acc + (ex.skipped ? 0 : ex.targetSets), 0),
    [planExercises],
  )

  const summaryRows = useMemo(
    () => buildCheckinSummary(todaysCheckin, session, palette),
    [todaysCheckin, session, palette],
  )

  const basisLine = useMemo(() => {
    const parts: string[] = []
    if (todaysCheckin?.painAreas?.length) {
      parts.push(
        `${todaysCheckin.painAreas.slice(0, 2).map((a) => painAreaLabel(a).toLowerCase()).join(' and ')} sore`,
      )
    }
    if (session?.durationMin) parts.push(`${session.durationMin} minutes`)
    if (session?.equipmentIntent === 'bodyweight') parts.push('bodyweight only')
    else if (session?.equipmentSnapshot && session.equipmentSnapshot.length > 0) {
      parts.push(
        `${session.equipmentSnapshot.slice(0, 2).map((i) => i.label.toLowerCase()).join(' and ')} only`,
      )
    }
    return parts.length > 0
      ? `Built from today\u2019s check-in: ${parts.join(', ')}.`
      : 'Built from today\u2019s check-in.'
  }, [todaysCheckin, session])

  const coachAdvice = useMemo(() => {
    if (session?.healthFacts?.[0]?.text) return session.healthFacts[0].text
    if (todaysCheckin?.painAreas?.length) {
      return `I\u2019ve steered around your ${painAreaLabel(todaysCheckin.painAreas[0]).toLowerCase()}. Keep the breath light and stay in control.`
    }
    return 'Move with intent. Stop a rep or two before form breaks down.'
  }, [session, todaysCheckin])

  const handleStart = useCallback(async () => {
    if (!sessionId) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace({
      pathname: '/session',
      params: { sessionId: String(sessionId) },
    })
  }, [sessionId])

  const handleHome = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [])

  const handleAdjustAgain = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
    router.replace({ pathname: '/', params: { adjust: '1' } } as unknown as Href)
  }, [])

  const handleChangeAnswer = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
    if (isGenerating) {
      Alert.alert(
        'Change an answer?',
        'The coach is still building. Changing answers starts a fresh check-in and a new session.',
        [
          { text: 'Keep building', style: 'cancel' },
          { text: 'Change answers', onPress: () => router.replace('/checkin' as Href) },
        ],
      )
      return
    }
    router.replace('/checkin' as Href)
  }, [isGenerating])

  const handleSwap = useCallback(() => {
    if (!sessionId) return
    Haptics.selectionAsync().catch(() => {})
    Alert.alert('Swap a move or shorten it', undefined, [
      {
        text: 'Swap a move',
        onPress: () =>
          router.replace({
            pathname: '/session',
            params: { sessionId: String(sessionId), intent: 'swap' },
          } as unknown as Href),
      },
      {
        text: 'Shorten it (adjust time)',
        onPress: () => router.replace('/' as Href),
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [sessionId])

  const handlePhaseReorder = useCallback(
    async (phasePlanIndices: number[], newOrderedIds: string[]) => {
      if (!sessionId) return
      const fullOrder = planExercises.map((ex) => ex.id)
      phasePlanIndices.forEach((slot, i) => {
        fullOrder[slot] = newOrderedIds[i]
      })
      const unchanged = fullOrder.every((id, idx) => id === planExercises[idx]?.id)
      if (unchanged) return
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        await reorderPlan({ sessionId, orderedIds: fullOrder })
      } catch (err) {
        console.error('reorder error', err)
      }
    },
    [planExercises, reorderPlan, sessionId],
  )

  const handleOpenPreview = useCallback(
    (exercise: ExercisePlan, phase: ExercisePhase, positionLabel: string) => {
      Haptics.selectionAsync().catch(() => {})
      setPreviewState({ exercise, phase, positionLabel })
    },
    [],
  )

  if (!sessionId) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorText, { color: palette.danger }]}>Missing session ID.</Text>
      </SafeAreaView>
    )
  }
  if (sessionData === undefined) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }
  if (!session) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorText, { color: palette.danger }]}>Session not available.</Text>
      </SafeAreaView>
    )
  }

  const hasAnyExercise = session.plan.length > 0
  const hasCitations = session.healthFacts.length > 0
  const retune = session.retune ?? null
  const activeMoves = planExercises.filter((ex) => !ex.skipped).length

  /* ------------------------------------------------------------ summary */
  if (view === 'summary') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={styles.summaryBody}>
          <Animated.View entering={FadeIn.duration(motion.duration.slow)} style={styles.orbWrap}>
            <HeroOrb size={150}>
              {isGenerating ? <ActivityIndicator color={palette.white} style={styles.orbSpinner} /> : null}
              <Text style={styles.orbLabel} maxFontSizeMultiplier={1.3}>
                {isFailed ? 'RETRY' : isGenerating ? 'COACH IS PLANNING' : 'READY'}
              </Text>
            </HeroOrb>
            <Text style={[styles.summaryTitle, { color: palette.textPrimary }]} accessibilityRole="header">
              {isFailed
                ? 'The coach hit a snag'
                : isGenerating
                  ? 'Building today around you'
                  : 'Your session is ready'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(motion.duration.base)} style={styles.summaryRows}>
            <SummaryRows rows={summaryRows} />
          </Animated.View>
        </View>

        <View style={styles.footer}>
          {isFailed ? (
            <PillButton label="Start a fresh check-in" onPress={() => router.replace('/checkin' as Href)} />
          ) : !isGenerating ? (
            <PillButton label="See your session" onPress={() => setView('list')} />
          ) : null}
          <PillButton label="Change an answer" variant="secondary" onPress={handleChangeAnswer} />
        </View>
      </SafeAreaView>
    )
  }

  /* --------------------------------------------------------------- list */
  return (
    <GestureHandlerRootView style={styles.safeArea}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={retune ? handleAdjustAgain : handleHome}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={retune ? 'Adjust again' : 'Home'}
          >
            <Text style={[styles.back, { color: palette.textSecondary }]}>
              {'\u2190'} {retune ? 'Adjust again' : 'Home'}
            </Text>
          </Pressable>
          <Pressable
            onPress={hasCitations ? () => setShowCitations(true) : undefined}
            hitSlop={12}
            accessibilityRole={hasCitations ? 'button' : 'header'}
            accessibilityLabel={hasCitations ? 'Bodfit. Science behind your session' : 'Bodfit'}
          >
            <BodfitWordmark variant="header" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {retune ? (
            <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
              <Text
                style={[styles.retuneCount, { color: palette.success }]}
                accessibilityLabel={`${activeMoves} of ${planExercises.length} moves, ${session.durationMin} minutes`}
              >
                {`${activeMoves} OF ${planExercises.length} MOVES \u00b7 ${session.durationMin} mins`}
              </Text>
              <Text style={[styles.retuneEyebrow, { color: palette.textSecondary }]}>
                {session.modality === 'generating...' ? session.goal : session.modality}
              </Text>
              <Text style={[styles.title, styles.titleTight, { color: palette.textPrimary }]} accessibilityRole="header">
                {retune.title}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
              <GradientText
                fontFamily={fonts.mono}
                fontSize={11}
                lineHeight={14}
                letterSpacing={1}
                colors={gradients.hero}
              >
                {`${(session.modality === 'generating...' ? 'SESSION' : session.modality).toUpperCase()} \u00b7 ${session.durationMin} MINS \u00b7 ${totalSets} SETS`}
              </GradientText>
              <Text style={[styles.title, { color: palette.textPrimary }]} accessibilityRole="header">
                Your session is ready
              </Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{basisLine}</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(60).duration(motion.duration.base)} style={styles.advice}>
            <CoachNote eyebrow={retune ? 'Coach says' : "Coach's advice"}>
              {retune ? retune.note : coachAdvice}
            </CoachNote>
          </Animated.View>

          {groups.map((group, idx) =>
            group.exercises.length === 0 && !isGenerating ? null : (
              <PhaseGroup
                key={group.phase}
                phase={group.phase}
                exercises={group.exercises}
                totalCount={planExercises.length}
                delay={100 + idx * 60}
                isGenerating={isGenerating}
                onPreview={handleOpenPreview}
                onReorder={(ordered) =>
                  handlePhaseReorder(
                    group.exercises.map((e) => e.planIndex),
                    ordered,
                  )
                }
              />
            ),
          )}

          {!hasAnyExercise && isGenerating ? (
            <View style={styles.generating} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={[styles.generatingText, { color: palette.textSecondary }]}>
                Exercises arrive in seconds
              </Text>
            </View>
          ) : null}

          {isFailed ? (
            <View style={[styles.failed, { backgroundColor: palette.dangerMuted }]}>
              <Text style={[styles.failedTitle, { color: palette.textPrimary }]}>Session generation failed</Text>
              <Text style={[styles.failedBody, { color: palette.textSecondary }]}>
                Something went wrong. Head back and try again.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: palette.bg }]}>
          <PillButton
            variant="gradient"
            label={isGenerating ? 'Building your session' : 'Start session'}
            onPress={handleStart}
            disabled={isGenerating || isFailed || !hasAnyExercise}
            loading={isGenerating && !hasAnyExercise}
          />
          <PillButton label="Swap a move or shorten it" variant="secondary" onPress={handleSwap} />
        </View>

        <CitationsPanel
          visible={showCitations}
          facts={session.healthFacts}
          onClose={() => setShowCitations(false)}
        />
        <ExercisePreviewSheet
          visible={previewState !== null}
          exercise={previewState?.exercise ?? null}
          phase={previewState?.phase ?? null}
          positionLabel={previewState?.positionLabel}
          onClose={() => setPreviewState(null)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

type PhaseGroupProps = {
  phase: ExercisePhase
  exercises: { exercise: ExercisePlan; planIndex: number }[]
  totalCount: number
  delay: number
  isGenerating: boolean
  onPreview: (exercise: ExercisePlan, phase: ExercisePhase, positionLabel: string) => void
  onReorder: (orderedIds: string[]) => void
}

function PhaseGroup({
  phase,
  exercises,
  totalCount,
  delay,
  isGenerating,
  onPreview,
  onReorder,
}: PhaseGroupProps) {
  const { palette } = useTheme()
  const meta = PHASE_META[phase]
  const items = useMemo(() => exercises.map((e) => e.exercise), [exercises])
  const minutes = estimatePhaseMinutes(items)

  return (
    <Animated.View entering={FadeInDown.duration(motion.duration.base).delay(delay)} style={styles.phase}>
      <Eyebrow
        dot={palette[PHASE_DOT[phase]]}
        right={
          <Text style={[styles.phaseMinutes, { color: palette.textSecondary }]}>
            {items.length === 0 ? '\u2026' : `${minutes} mins`}
          </Text>
        }
      >
        {meta.label}
      </Eyebrow>
      <View style={[styles.phaseDivider, { backgroundColor: palette.divider }]} />
      {items.length === 0 ? (
        <Text style={[styles.phaseEmpty, { color: palette.textTertiary }]}>
          {isGenerating ? 'Coming up' : 'No moves in this phase'}
        </Text>
      ) : (
        <DraggableExerciseList
          items={items}
          itemHeight={ROW_HEIGHT}
          itemSpacing={ROW_SPACING}
          rowBackgroundColor={palette.bg}
          rowBorderRadius={radius.sm}
          onReorder={onReorder}
          renderItem={({ item, index }) => (
            <ExerciseRow
              exercise={item}
              onPreview={() => onPreview(item, phase, `${index + 1} of ${totalCount}`)}
            />
          )}
        />
      )}
    </Animated.View>
  )
}

function ExerciseRow({ exercise, onPreview }: { exercise: ExercisePlan; onPreview: () => void }) {
  const { palette } = useTheme()
  const isNew = exercise.cues?.some((c) => c.toLowerCase().includes('new')) ?? false
  return (
    <Pressable
      onPress={onPreview}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${exercise.bodyPart}. ${buildExerciseMeta(exercise)}. Tap for details, hold to reorder.`}
      style={({ pressed }) => [
        styles.exerciseRow,
        { borderBottomColor: palette.divider },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.exerciseText}>
        <Text style={[styles.exerciseName, { color: palette.textPrimary }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[styles.exerciseMuscle, { color: palette.textSecondary }]} numberOfLines={1}>
          {exercise.bodyPart.toLowerCase()}
          {isNew ? (
            <Text style={{ color: palette.warning, fontFamily: fonts.uiBold }}> {'\u00b7'} new to you</Text>
          ) : null}
        </Text>
      </View>
      <Text style={[styles.exerciseMeta, { color: palette.textSecondary }]}>
        {buildExerciseMeta(exercise)}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body },

  summaryBody: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.huge + spacing.xl,
  },
  orbWrap: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  orbSpinner: { marginBottom: 6 },
  orbLabel: {
    ...typography.mono,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  summaryTitle: {
    ...typography.h1,
    fontSize: 24,
    textAlign: 'center',
  },
  summaryRows: {
    marginTop: spacing.xxl,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  back: { ...typography.smallStrong },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 170,
  },
  title: {
    ...typography.h1,
    fontSize: 24,
    marginTop: spacing.sm,
  },
  titleTight: {
    marginTop: 2,
  },
  retuneCount: {
    ...typography.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  retuneEyebrow: {
    ...typography.small,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.small,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  advice: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  phase: {
    marginTop: spacing.xxl,
  },
  phaseMinutes: { ...typography.mono, fontSize: 11 },
  phaseDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  phaseEmpty: {
    ...typography.small,
    paddingVertical: spacing.md,
  },
  exerciseRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseText: { flex: 1, gap: 1 },
  exerciseName: { ...typography.bodyStrong },
  exerciseMuscle: { ...typography.small, fontSize: 12 },
  exerciseMeta: { ...typography.smallStrong, fontSize: 12 },
  generating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  generatingText: { ...typography.small },
  failed: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  failedTitle: { ...typography.h3 },
  failedBody: { ...typography.small },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
})
