import { api } from '@/convex/_generated/api'
import { matchTrainingPlace } from '@/utils/trainingPlaceMatch'
import { useIsFocused } from '@react-navigation/native'
import { useAction } from 'convex/react'
import * as Location from 'expo-location'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

import type { TrainingEnvironment } from './types'

type ForegroundPlaceMatch = {
  trainingEnvironment: TrainingEnvironment
} | null

export function useForegroundPlaceMatch(enabled: boolean): {
  match: ForegroundPlaceMatch
  loading: boolean
} {
  const listPlaces = useAction(api.trainingPlaceActions.list)
  const isFocused = useIsFocused()
  const [match, setMatch] = useState<ForegroundPlaceMatch>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    let active = true
    let requestVersion = 0
    if (!enabled || !isFocused) {
      setMatch(null)
      setLoading(false)
      return () => {
        active = false
      }
    }

    const resolve = async () => {
      const version = ++requestVersion
      setMatch(null)
      setLoading(true)
      try {
        const permission = await Location.getForegroundPermissionsAsync()
        if (!permission.granted) {
          if (active && version === requestVersion) setMatch(null)
          return
        }
        const [places, current] = await Promise.all([
          listPlaces({}),
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
        ])
        if (!active || version !== requestVersion) return
        const next = matchTrainingPlace(
          {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          },
          places,
        )
        setMatch(
          next
            ? {
                trainingEnvironment: next.trainingEnvironment,
              }
            : null,
        )
      } catch (error) {
        console.info('Foreground training-place suggestion unavailable', error)
        if (active && version === requestVersion) setMatch(null)
      } finally {
        if (active && version === requestVersion) setLoading(false)
      }
    }

    void resolve()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resolve()
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [enabled, isFocused, listPlaces])

  return { match, loading }
}
