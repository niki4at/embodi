import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  ExerciseDetail,
  type DetailExercise,
} from '@/components/exercise/ExerciseDetail'
import ExerciseTable from '@/components/trainer/ExerciseTable'
import type { ExercisePlan } from '@/components/trainer/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useSessionLogging } from '@/hooks/use-session-logging'

const FOOTER_SPACE = 96

type SessionFocusModeProps = {
  sessionId: Id<'workout_sessions'>
  initialExerciseId: string
}

function toDetailExercise(exercise: ExercisePlan): DetailExercise {
  return {
    catalogId: exercise.catalogId,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    modality: exercise.modality,
    equipment: exercise.equipment,
    instructions: exercise.instructions,
    cues: exercise.cues,
    tempo: exercise.tempo,
    restSec: exercise.restSec,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    durationMin: exercise.durationMin,
    intensityCue: exercise.intensityCue,
    contraindications: exercise.contraindications,
    trackingMetric: exercise.trackingMetric,
  }
}

/**
 * Live "focus mode" for the exercise detail screen: the user works through
 * the whole session from here — demo, how-to, set logging, rest timer, and
 * prev/next navigation between exercises — without returning to the session
 * list. All data is shared Convex state, so both surfaces stay in sync.
 */
export function SessionFocusMode({
  sessionId,
  initialExerciseId,
}: SessionFocusModeProps) {
  const { palette, resolved, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  const sessionData = useQuery(api.trainer.getSessionWithSets, { sessionId })
  const completeSession = useMutation(api.trainer.completeSession)

  const [currentExerciseId, setCurrentExerciseId] = useState(initialExerciseId)
  const [isCompleting, setIsCompleting] = useState(false)
  // Remember where the user was so we can land on the nearest exercise if
  // the current one is replaced/removed from another surface mid-session.
  const lastIndexRef = useRef(0)

  const session = sessionData?.session
  const sets = useMemo(() => sessionData?.sets ?? [], [sessionData?.sets])

  const planExercises = useMemo<ExercisePlan[]>(() => {
    if (!session) return []
    return session.plan.map(exercise => ({
      ...exercise,
      targetReps: Array.isArray(exercise.targetReps)
        ? exercise.targetReps
        : [exercise.targetReps ?? 0],
    }))
  }, [session])

  const {
    totalTargetSets,
    workingSetsLogged,
    handleLogSet,
    handleRemoveSet,
    handleInsertSetAfter,
    handleDeleteSetAt,
    handleSetType,
    handleSetRest,
    handleToggleSkip,
  } = useSessionLogging({ sessionId, planExercises, sets })

  const currentIndex = useMemo(
    () => planExercises.findIndex(ex => ex.id === currentExerciseId),
    [planExercises, currentExerciseId],
  )

  // If the exercise vanished (replaced/removed elsewhere), fall back to the
  // nearest surviving one.
  useEffect(() => {
    if (planExercises.length === 0) return
    if (currentIndex !== -1) {
      lastIndexRef.current = currentIndex
      return
    }
    const fallback = Math.min(lastIndexRef.current, planExercises.length - 1)
    setCurrentExerciseId(planExercises[fallback].id)
  }, [planExercises, currentIndex])

  const currentExercise =
    currentIndex !== -1 ? planExercises[currentIndex] : null

  // Working (non-warmup) sets logged per exercise, for dots and CTA state.
  const workingSetsByExerciseId = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const set of sets) {
      if (set.isWarmup) continue
      counts[set.exerciseId] = (counts[set.exerciseId] ?? 0) + 1
    }
    return counts
  }, [sets])

  const isExerciseDone = useCallback(
    (exercise: ExercisePlan) =>
      exercise.targetSets > 0 &&
      (workingSetsByExerciseId[exercise.id] ?? 0) >= exercise.targetSets,
    [workingSetsByExerciseId],
  )

  const nextExercise = useMemo(() => {
    if (currentIndex === -1) return null
    for (let i = currentIndex + 1; i < planExercises.length; i += 1) {
      if (!planExercises[i].skipped) return planExercises[i]
    }
    return null
  }, [planExercises, currentIndex])

  const prevExercise = useMemo(() => {
    if (currentIndex === -1) return null
    for (let i = currentIndex - 1; i >= 0; i -= 1) {
      if (!planExercises[i].skipped) return planExercises[i]
    }
    return null
  }, [planExercises, currentIndex])

  const currentDone = currentExercise ? isExerciseDone(currentExercise) : false

  // Celebrate the moment the current exercise's target sets are all ticked.
  const prevDoneRef = useRef(currentDone)
  useEffect(() => {
    if (currentDone && !prevDoneRef.current) {
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {})
    }
    prevDoneRef.current = currentDone
  }, [currentDone])

  // Reset the "already celebrated" marker when the user moves exercises.
  useEffect(() => {
    prevDoneRef.current = currentExercise ? isExerciseDone(currentExercise) : false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExerciseId])

  const goToExercise = useCallback((exerciseId: string) => {
    void Haptics.selectionAsync().catch(() => {})
    setCurrentExerciseId(exerciseId)
  }, [])

  const handleSkipCurrent = useCallback(() => {
    if (!currentExercise) return
    handleToggleSkip(currentExercise.id, true)
    // Hop forward so the user isn't left staring at a skipped move; if it was
    // the last one, hop back instead.
    const landing = nextExercise ?? prevExercise
    if (landing) setCurrentExerciseId(landing.id)
  }, [currentExercise, handleToggleSkip, nextExercise, prevExercise])

  const handleFinishSession = useCallback(async () => {
    if (isCompleting) return
    setIsCompleting(true)
    try {
      await completeSession({ sessionId })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/')
    } catch (err) {
      console.error('complete session error', err)
      setIsCompleting(false)
    }
  }, [sessionId, completeSession, isCompleting])

  const handleAdvance = useCallback(() => {
    if (nextExercise) {
      goToExercise(nextExercise.id)
    } else {
      void handleFinishSession()
    }
  }, [nextExercise, goToExercise, handleFinishSession])

  // Exercise-level notes captured via the table's "Notes" button. In-memory
  // for this surface; new sets persist them via the set's notes field.
  const [exerciseNotesMap, setExerciseNotesMap] = useState<
    Record<string, string>
  >({})

  const exerciseNotesByExerciseId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const set of sets) {
      if (set.notes && set.notes.trim()) {
        map[set.exerciseId] = set.notes
      }
    }
    return { ...map, ...exerciseNotesMap }
  }, [sets, exerciseNotesMap])

  if (sessionData === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    )
  }

  if (!session || !currentExercise) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Session not available.
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          style={[
            styles.errorBack,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.errorBackText, { color: palette.textPrimary }]}>
            Go back
          </Text>
        </Pressable>
      </View>
    )
  }

  const currentLogged = workingSetsByExerciseId[currentExercise.id] ?? 0
  const activeCount = planExercises.filter(ex => !ex.skipped).length
  const activePosition =
    planExercises
      .slice(0, currentIndex + 1)
      .filter(ex => !ex.skipped).length

  const ctaLabel = isCompleting
    ? 'Saving'
    : nextExercise
      ? `Next: ${nextExercise.name}`
      : 'Finish session'
  const ctaSub = `${Math.min(currentLogged, currentExercise.targetSets)}/${currentExercise.targetSets} sets on ${currentExercise.name}`
  const ctaColor = currentDone ? palette.success : palette.primary
  const sessionShadow =
    resolved === 'dark' ? shadows.primaryDark : shadows.primary

  const headerAccessory = (
    <View style={styles.progressWrap}>
      <View style={styles.dotsRow}>
        {planExercises.map((exercise, idx) => {
          const isCurrent = exercise.id === currentExercise.id
          const done = isExerciseDone(exercise)
          return (
            <Pressable
              key={exercise.id}
              onPress={() => goToExercise(exercise.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Go to exercise ${idx + 1}, ${exercise.name}`}
              style={[
                styles.dot,
                isCurrent ? styles.dotCurrent : null,
                {
                  backgroundColor: done
                    ? palette.success
                    : isCurrent
                      ? palette.primary
                      : palette.surfaceHigh,
                },
                exercise.skipped ? styles.dotSkipped : null,
              ]}
            />
          )
        })}
      </View>
      <Text style={[styles.progressLabel, { color: palette.textTertiary }]}>
        Exercise {activePosition} of {activeCount} · {workingSetsLogged}/
        {totalTargetSets} sets
      </Text>
    </View>
  )

  const logSlot = (
    <ExerciseTable
      variant="embedded"
      exercise={currentExercise}
      sets={sets}
      planIndex={currentIndex}
      planLength={planExercises.length}
      hasLoggedSets={currentLogged > 0}
      showSwipeHint
      exerciseNotes={exerciseNotesByExerciseId[currentExercise.id]}
      onSaveSet={(setIndex, payload) =>
        handleLogSet(currentExercise.id, setIndex, payload)
      }
      onRemoveSet={setIndex => handleRemoveSet(currentExercise.id, setIndex)}
      onInsertSetAfter={afterSetIndex =>
        handleInsertSetAfter(currentExercise.id, afterSetIndex)
      }
      onDeleteSetAt={setIndex =>
        handleDeleteSetAt(currentExercise.id, setIndex)
      }
      onSetType={(setIndex, setType) =>
        handleSetType(currentExercise.id, setIndex, setType)
      }
      onSetRest={restSec => handleSetRest(currentExercise.id, restSec)}
      onSaveExerciseNotes={notes =>
        setExerciseNotesMap(prev => ({ ...prev, [currentExercise.id]: notes }))
      }
    />
  )

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Animated.View
        key={currentExercise.id}
        entering={FadeIn.duration(200)}
        style={styles.root}
      >
        <ExerciseDetail
          exercise={toDetailExercise(currentExercise)}
          mode="session"
          headerAccessory={headerAccessory}
          logSlot={logSlot}
          extraBottomPadding={FOOTER_SPACE}
        />
      </Animated.View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.bgElevated,
            borderTopColor: palette.divider,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <Pressable
          onPress={prevExercise ? () => goToExercise(prevExercise.id) : undefined}
          disabled={!prevExercise}
          accessibilityRole="button"
          accessibilityLabel={
            prevExercise
              ? `Previous exercise: ${prevExercise.name}`
              : 'No previous exercise'
          }
          style={[
            styles.navBtn,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: prevExercise ? 1 : 0.4,
            },
          ]}
        >
          <IconSymbol
            name="chevron.left"
            size={20}
            color={palette.textPrimary}
          />
        </Pressable>

        <Pressable
          onPress={handleAdvance}
          disabled={isCompleting}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={({ pressed }) => [
            styles.cta,
            sessionShadow,
            {
              backgroundColor: ctaColor,
              opacity: pressed || isCompleting ? 0.9 : 1,
            },
          ]}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <View style={styles.ctaTextWrap}>
              <Text
                style={[styles.ctaLabel, { color: palette.white }]}
                numberOfLines={1}
              >
                {ctaLabel}
              </Text>
              <Text
                style={[styles.ctaSub, { color: palette.white }]}
                numberOfLines={1}
              >
                {ctaSub}
              </Text>
            </View>
          )}
          {!isCompleting ? (
            <IconSymbol
              name={nextExercise ? 'chevron.right' : 'checkmark'}
              size={18}
              color={palette.white}
            />
          ) : null}
        </Pressable>

        <Pressable
          onPress={handleSkipCurrent}
          accessibilityRole="button"
          accessibilityLabel={`Skip ${currentExercise.name}`}
          style={[
            styles.navBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <IconSymbol
            name="forward.end.fill"
            size={16}
            color={palette.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    ...typography.body,
  },
  errorBack: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  errorBackText: {
    ...typography.bodyStrong,
  },
  progressWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotCurrent: {
    width: 22,
    borderRadius: 4,
  },
  dotSkipped: {
    opacity: 0.35,
  },
  progressLabel: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    width: 48,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaTextWrap: {
    flexShrink: 1,
    alignItems: 'center',
  },
  ctaLabel: {
    ...typography.button,
    fontSize: 15,
  },
  ctaSub: {
    ...typography.caption,
    fontSize: 10,
    opacity: 0.85,
    marginTop: 1,
  },
})
