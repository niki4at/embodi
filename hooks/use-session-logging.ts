import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { useCallback, useMemo } from 'react'

import type { SetPayload } from '@/components/trainer/ExerciseSetRow'
import { useRestTimer } from '@/components/trainer/rest-timer/RestTimerProvider'
import type {
  ExercisePlan,
  SetType,
  WorkoutSet,
} from '@/components/trainer/types'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type UseSessionLoggingArgs = {
  sessionId: Id<'workout_sessions'> | undefined
  planExercises: ExercisePlan[]
  sets: WorkoutSet[]
  /** Fired after a set saves — the session screen uses it for coach comments. */
  onAfterSetLogged?: (exerciseId: string) => void
}

/**
 * Shared set-logging behavior for every surface that can log a workout set
 * (the session list and the exercise-detail focus mode). Wraps the Convex
 * mutations plus the auto-rest logic: ticking a set starts the exercise's
 * rest countdown unless it was the session's final working set, and unticking
 * cancels the rest that set kicked off.
 */
export function useSessionLogging({
  sessionId,
  planExercises,
  sets,
  onAfterSetLogged,
}: UseSessionLoggingArgs) {
  const logSet = useMutation(api.trainer.logSet)
  const removeSet = useMutation(api.trainer.removeSet)
  const insertSetAfter = useMutation(api.trainer.insertSetAfter)
  const deleteSetAt = useMutation(api.trainer.deleteSetAt)
  const setSetType = useMutation(api.trainer.setSetType)
  const setExerciseRest = useMutation(api.trainer.setExerciseRest)
  const setExerciseSkipped = useMutation(api.trainer.setExerciseSkipped)

  const { start: startRest, cancelFor: cancelRestFor } = useRestTimer()

  // Skipped exercises stay in the plan but drop out of the target math so the
  // session can still be completed once the remaining work is done.
  const skippedExerciseIds = useMemo(
    () => new Set(planExercises.filter(ex => ex.skipped).map(ex => ex.id)),
    [planExercises],
  )

  const totalTargetSets = useMemo(
    () =>
      planExercises.reduce(
        (acc, ex) => (ex.skipped ? acc : acc + ex.targetSets),
        0,
      ),
    [planExercises],
  )

  // Warm-up sets prime the body but don't count toward the working-set target,
  // so progress and completion track only working sets. Sets belonging to a
  // skipped exercise are excluded too.
  const workingSetsLogged = useMemo(
    () =>
      sets.filter(s => !s.isWarmup && !skippedExerciseIds.has(s.exerciseId))
        .length,
    [sets, skippedExerciseIds],
  )

  const handleLogSet = useCallback(
    async (exerciseId: string, setIndex: number, payload: SetPayload) => {
      if (!sessionId) return
      await logSet({
        sessionId,
        exerciseId,
        setIndex,
        ...payload,
      })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onAfterSetLogged?.(exerciseId)

      // Auto-start the rest countdown for this exercise. Skip it after the very
      // last working set of the session so we don't rest with nothing left to do.
      const exercise = planExercises.find(ex => ex.id === exerciseId)
      const restSec = exercise?.restSec ?? 0
      const isWarmup = payload.isWarmup || payload.setType === 'warmup'
      const willFinishSession =
        !isWarmup &&
        totalTargetSets > 0 &&
        workingSetsLogged + 1 >= totalTargetSets
      if (restSec > 0 && !willFinishSession) {
        startRest(
          restSec,
          exercise?.name ?? 'Next set',
          `${exerciseId}:${setIndex}`,
        )
      }
    },
    [
      logSet,
      sessionId,
      onAfterSetLogged,
      planExercises,
      totalTargetSets,
      workingSetsLogged,
      startRest,
    ],
  )

  const handleRemoveSet = useCallback(
    async (exerciseId: string, setIndex: number) => {
      if (!sessionId) return
      await removeSet({ sessionId, exerciseId, setIndex })
      // Untap should cancel the rest this set kicked off.
      cancelRestFor(`${exerciseId}:${setIndex}`)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    },
    [removeSet, sessionId, cancelRestFor],
  )

  const handleInsertSetAfter = useCallback(
    async (exerciseId: string, afterSetIndex: number) => {
      if (!sessionId) return
      await insertSetAfter({ sessionId, exerciseId, afterSetIndex })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    },
    [insertSetAfter, sessionId],
  )

  const handleDeleteSetAt = useCallback(
    async (exerciseId: string, setIndex: number) => {
      if (!sessionId) return
      await deleteSetAt({ sessionId, exerciseId, setIndex })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    },
    [deleteSetAt, sessionId],
  )

  const handleSetType = useCallback(
    async (exerciseId: string, setIndex: number, setType: SetType) => {
      if (!sessionId) return
      await setSetType({ sessionId, exerciseId, setIndex, setType })
      await Haptics.selectionAsync()
    },
    [setSetType, sessionId],
  )

  const handleSetRest = useCallback(
    async (exerciseId: string, restSec: number) => {
      if (!sessionId) return
      await setExerciseRest({ sessionId, exerciseId, restSec })
      await Haptics.selectionAsync()
    },
    [setExerciseRest, sessionId],
  )

  const handleToggleSkip = useCallback(
    (exerciseId: string, next: boolean) => {
      if (!sessionId) return
      void Haptics.selectionAsync().catch(() => {})
      void setExerciseSkipped({ sessionId, exerciseId, skipped: next }).catch(
        err => console.error('toggle skip error', err),
      )
    },
    [sessionId, setExerciseSkipped],
  )

  return {
    skippedExerciseIds,
    totalTargetSets,
    workingSetsLogged,
    handleLogSet,
    handleRemoveSet,
    handleInsertSetAfter,
    handleDeleteSetAt,
    handleSetType,
    handleSetRest,
    handleToggleSkip,
  }
}
