import { useLocalSearchParams } from 'expo-router'
import React, { useMemo } from 'react'

import {
  ExerciseDetail,
  type DetailExercise,
} from '@/components/exercise/ExerciseDetail'
import { SessionFocusMode } from '@/components/exercise/SessionFocusMode'
import { Id } from '@/convex/_generated/dataModel'

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{
    payload?: string
    mode?: string
    selected?: string
    sessionId?: string
    exerciseId?: string
  }>()

  const exercise = useMemo<DetailExercise | null>(() => {
    const raw = params.payload
    if (!raw) return null
    try {
      return JSON.parse(raw) as DetailExercise
    } catch {
      try {
        return JSON.parse(decodeURIComponent(raw)) as DetailExercise
      } catch {
        return null
      }
    }
  }, [params.payload])

  // With a live session attached, run focus mode: log sets, rest, and step
  // through the whole workout from this screen.
  if (
    typeof params.sessionId === 'string' &&
    typeof params.exerciseId === 'string'
  ) {
    return (
      <SessionFocusMode
        sessionId={params.sessionId as Id<'workout_sessions'>}
        initialExerciseId={params.exerciseId}
      />
    )
  }

  if (!exercise) return null

  const mode = params.mode === 'session' ? 'session' : 'library'

  return (
    <ExerciseDetail
      exercise={exercise}
      mode={mode}
      initialSelected={params.selected === '1'}
    />
  )
}
