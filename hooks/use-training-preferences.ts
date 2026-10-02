import { useQueries } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useMemo } from 'react'

import { api } from '@/convex/_generated/api'

export type TrainingPreferences = FunctionReturnType<
  typeof api.trainingPreferences.get
>

const PREFERENCES_KEY = 'trainingPreferences'

/**
 * Training preferences only tune defaults, so a failing read degrades to
 * "no saved preferences" rather than throwing into the app error boundary.
 */
export function useTrainingPreferences(): TrainingPreferences | undefined {
  const queries = useMemo(
    () => ({
      [PREFERENCES_KEY]: { query: api.trainingPreferences.get, args: {} },
    }),
    []
  )
  const result: unknown = useQueries(queries)[PREFERENCES_KEY]
  const failed = result instanceof Error

  useEffect(() => {
    if (result instanceof Error) {
      console.error('Training preferences failed to load', result)
    }
  }, [result])

  if (failed) return null
  return result as TrainingPreferences | undefined
}
