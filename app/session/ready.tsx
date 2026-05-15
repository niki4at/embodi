import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type SessionParams = {
  sessionId?: string
}

const SLEEP_LABEL: Record<string, string> = {
  rough: 'Rough sleep',
  okay: 'Okay sleep',
  decent: 'Decent sleep',
  great: 'Great sleep',
}

const INTENSITY_LABEL: Record<string, string> = {
  easy: 'Easy intensity',
  moderate: 'Moderate intensity',
  challenging: 'Challenging intensity',
}

const ROW_HEIGHT = 56
const ROW_SPACING = 8

export default function SessionReadyScreen() {
  const { palette, resolved, shadows } = useTheme()
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

  const [showCitations, setShowCitations] = useState(false)
  const [previewState, setPreviewState] = useState<{
    exercise: ExercisePlan
    phase: ExercisePhase
    positionLabel: string
  } | null>(null)

  const session = sessionData?.session
  const isGenerating = session?.status === 'generating'
  const isFailed = session?.status === 'failed'

  const planExercises = useMemo<ExercisePlan[]>(() => {
    if (!session) return []
    return session.plan.map(exercise => ({
      ...exercise,
      targetReps: Array.isArray(exercise.targetReps)
        ? exercise.targetReps
        : [exercise.targetReps ?? 0],
    }))
  }, [session])

  const groups = useMemo(
    () => groupPlanByPhase(planExercises),
    [planExercises],
  )

  const checkinSummary = useMemo(() => {
    if (!todaysCheckin) return null
    const parts: string[] = []
    const energy = todaysCheckin.energyLevel
    if (energy <= 3) parts.push('Low energy')
    else if (energy <= 6) parts.push('Moderate energy')
    else parts.push('High energy')

    if (todaysCheckin.sleepQuality) {
      parts.push(SLEEP_LABEL[todaysCheckin.sleepQuality] ?? 'Sleep noted')
    }

    if (todaysCheckin.painLevel > 0 && todaysCheckin.painAreas?.length) {
      const areas = todaysCheckin.painAreas.slice(0, 2).join(' & ')
      parts.push(`${areas} sensitivity`)
    } else if (todaysCheckin.painLevel > 0) {
      parts.push('Some discomfort')
    }

    if (todaysCheckin.intensityPreference) {
      parts.push(INTENSITY_LABEL[todaysCheckin.intensityPreference] ?? '')
    }

    return parts.filter(Boolean).join(', ')
  }, [todaysCheckin])

  const handleStart = useCallback(async () => {
    if (!sessionId) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace({
      pathname: '/session',
      params: { sessionId: String(sessionId) },
    })
  }, [sessionId])

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [])

  const handlePhaseReorder = useCallback(
    async (phasePlanIndices: number[], newOrderedIds: string[]) => {
      if (!sessionId) return
      const fullOrder = planExercises.map(ex => ex.id)
      phasePlanIndices.forEach((slot, i) => {
        fullOrder[slot] = newOrderedIds[i]
      })
      const unchanged = fullOrder.every(
        (id, idx) => id === planExercises[idx]?.id,
      )
      if (unchanged) return
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        )
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

  const handleClosePreview = useCallback(() => setPreviewState(null), [])

  if (!sessionId) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Missing session ID.
        </Text>
      </SafeAreaView>
    )
  }

  if (sessionData === undefined) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Session not available.
        </Text>
      </SafeAreaView>
    )
  }

  const sessionShadow =
    resolved === 'dark' ? shadows.primaryDark : shadows.primary
  const hasAnyExercise = session.plan.length > 0
  const hasCitations = session.healthFacts.length > 0

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.bg }]}
        edges={['top']}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleBack}
            style={[
              styles.iconButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol
              name="chevron.left"
              size={20}
              color={palette.textPrimary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {hasCitations ? (
            <TouchableOpacity
              onPress={() => setShowCitations(true)}
              style={[
                styles.iconButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Science behind your session"
            >
              <IconSymbol
                name="book.closed"
                size={18}
                color={palette.textPrimary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              Your session is ready
            </Text>
            <Text
              style={[styles.subtitle, { color: palette.textSecondary }]}
            >
              Tailored to your check-in today.
            </Text>
          </Animated.View>

          {checkinSummary ? (
            <Animated.View
              entering={FadeInDown.duration(motion.duration.base).delay(40)}
              style={[
                styles.basisChip,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text
                style={[styles.basisLabel, { color: palette.textTertiary }]}
              >
                Based on:
              </Text>
              <Text
                style={[styles.basisValue, { color: palette.textPrimary }]}
                numberOfLines={2}
              >
                {checkinSummary}
              </Text>
              {hasCitations ? (
                <TouchableOpacity
                  onPress={() => setShowCitations(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Why we picked this"
                  hitSlop={12}
                  style={[
                    styles.infoButton,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <IconSymbol
                    name="info.circle"
                    size={16}
                    color={palette.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          ) : null}

          {groups.map((group, idx) => (
            <PhaseGroupCard
              key={group.phase}
              phase={group.phase}
              exercises={group.exercises}
              totalCount={planExercises.length}
              delay={80 + idx * 60}
              isGenerating={isGenerating}
              onPreview={handleOpenPreview}
              onReorder={ordered =>
                handlePhaseReorder(
                  group.exercises.map(e => e.planIndex),
                  ordered,
                )
              }
            />
          ))}

          {!hasAnyExercise && isGenerating ? (
            <Animated.View
              entering={FadeIn.duration(motion.duration.base)}
              style={[
                styles.generatingCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <ActivityIndicator size="small" color={palette.primary} />
              <Text
                style={[
                  styles.generatingText,
                  { color: palette.textPrimary },
                ]}
              >
                Designing your session
              </Text>
              <Text
                style={[
                  styles.generatingHint,
                  { color: palette.textSecondary },
                ]}
              >
                The science is ready — exercises arrive in seconds.
              </Text>
            </Animated.View>
          ) : null}

          {isFailed ? (
            <View
              style={[
                styles.failedBlock,
                {
                  backgroundColor: palette.dangerMuted,
                  borderColor: palette.primaryBorder,
                },
              ]}
            >
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={24}
                color={palette.danger}
              />
              <Text
                style={[styles.failedTitle, { color: palette.textPrimary }]}
              >
                Session generation failed
              </Text>
              <Text
                style={[styles.failedBody, { color: palette.textSecondary }]}
              >
                Something went wrong. Head back and try again.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.bg,
              borderTopColor: palette.divider,
            },
          ]}
        >
          <View style={isGenerating ? undefined : sessionShadow}>
            <PillButton
              label={isGenerating ? 'Building your session…' : 'Start session'}
              onPress={handleStart}
              disabled={isGenerating || isFailed || !hasAnyExercise}
              loading={isGenerating && !hasAnyExercise}
            />
          </View>
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
          onClose={handleClosePreview}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

type PhaseGroupCardProps = {
  phase: ExercisePhase
  exercises: { exercise: ExercisePlan; planIndex: number }[]
  totalCount: number
  delay: number
  isGenerating: boolean
  onPreview: (
    exercise: ExercisePlan,
    phase: ExercisePhase,
    positionLabel: string,
  ) => void
  onReorder: (orderedIds: string[]) => void
}

function PhaseGroupCard({
  phase,
  exercises,
  totalCount,
  delay,
  isGenerating,
  onPreview,
  onReorder,
}: PhaseGroupCardProps) {
  const { palette } = useTheme()
  const meta = PHASE_META[phase]
  const empty = exercises.length === 0

  const items = useMemo(
    () => exercises.map(e => e.exercise),
    [exercises],
  )

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.duration.base).delay(delay)}
      style={[
        styles.groupCard,
        {
          backgroundColor: palette.bgElevated,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.groupHeader}>
        <Text style={styles.groupEmoji}>{meta.emoji}</Text>
        <Text style={[styles.groupTitle, { color: palette.primary }]}>
          {meta.label}
        </Text>
      </View>

      {empty ? (
        <View
          style={[
            styles.emptyRow,
            { backgroundColor: palette.surfaceAlt },
          ]}
        >
          <Text
            style={[styles.emptyText, { color: palette.textTertiary }]}
          >
            {isGenerating ? 'Coming up…' : 'No moves in this phase'}
          </Text>
        </View>
      ) : (
        <DraggableExerciseList
          items={items}
          itemHeight={ROW_HEIGHT}
          itemSpacing={ROW_SPACING}
          rowBackgroundColor={palette.bgElevated}
          rowBorderRadius={radius.md}
          onReorder={onReorder}
          renderItem={({ item, index }) => (
            <ExerciseRow
              exercise={item}
              onPreview={() =>
                onPreview(item, phase, `${index + 1} of ${totalCount}`)
              }
            />
          )}
        />
      )}
    </Animated.View>
  )
}

type ExerciseRowProps = {
  exercise: ExercisePlan
  onPreview: () => void
}

function ExerciseRow({ exercise, onPreview }: ExerciseRowProps) {
  const { palette } = useTheme()

  return (
    <TouchableOpacity
      onPress={onPreview}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}. Tap for details. Hold to reorder.`}
      style={styles.exerciseRow}
    >
      <IconSymbol
        name="list.bullet"
        size={16}
        color={palette.primary}
        style={styles.exerciseIcon}
      />
      <Text
        style={[styles.exerciseName, { color: palette.textPrimary }]}
        numberOfLines={1}
      >
        {exercise.name}
      </Text>
      <Text
        style={[styles.exerciseMeta, { color: palette.textTertiary }]}
      >
        {buildExerciseMeta(exercise)}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.body,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge + 80,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  basisChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  basisLabel: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  basisValue: {
    ...typography.small,
    flex: 1,
  },
  infoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  groupEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  groupTitle: {
    ...typography.h3,
    fontSize: 18,
    flex: 1,
  },
  exerciseRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  exerciseIcon: {
    width: 18,
  },
  exerciseName: {
    flex: 1,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  exerciseMeta: {
    ...typography.small,
  },
  emptyRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  emptyText: {
    ...typography.small,
    fontStyle: 'italic',
  },
  generatingCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  generatingText: {
    ...typography.bodyStrong,
    marginTop: spacing.xs,
  },
  generatingHint: {
    ...typography.small,
    textAlign: 'center',
  },
  failedBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  failedTitle: {
    ...typography.h3,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  failedBody: {
    ...typography.small,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
