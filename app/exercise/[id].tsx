import { useLocalSearchParams } from 'expo-router'
import React, { useMemo } from 'react'

import {
  ExerciseDetail,
  type DetailExercise,
} from '@/components/exercise/ExerciseDetail'

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{
    payload?: string
    mode?: string
    selected?: string
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
