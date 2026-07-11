import { describe, expect, it } from 'vitest'

import {
  distanceBetweenCoordinates,
  matchTrainingPlace,
} from './trainingPlaceMatch'

describe('training place matching', () => {
  it('matches the nearest saved place inside its radius', () => {
    const current = { latitude: 51.5007, longitude: -0.1246 }
    const result = matchTrainingPlace(current, [
      {
        latitude: 51.5008,
        longitude: -0.1247,
        radiusM: 100,
        trainingEnvironment: 'gym',
        equipmentIntent: 'treadmill',
      },
      {
        latitude: 51.51,
        longitude: -0.13,
        radiusM: 100,
        trainingEnvironment: 'home',
      },
    ])

    expect(result).toMatchObject({
      trainingEnvironment: 'gym',
      equipmentIntent: 'treadmill',
    })
  })

  it('returns null outside every saved radius', () => {
    const result = matchTrainingPlace(
      { latitude: 51.5, longitude: -0.12 },
      [
        {
          latitude: 51.6,
          longitude: -0.12,
          radiusM: 100,
          trainingEnvironment: 'home',
        },
      ],
    )

    expect(result).toBeNull()
  })

  it('keeps place matching independent when no equipment intent is saved', () => {
    const result = matchTrainingPlace(
      { latitude: 51.5, longitude: -0.12 },
      [
        {
          latitude: 51.5,
          longitude: -0.12,
          radiusM: 100,
          trainingEnvironment: 'gym',
        },
      ],
    )

    expect(result).toEqual({
      trainingEnvironment: 'gym',
      equipmentIntent: undefined,
      distanceM: 0,
    })
  })

  it('calculates zero distance for identical points', () => {
    const point = { latitude: 40.7, longitude: -74 }
    expect(distanceBetweenCoordinates(point, point)).toBe(0)
  })
})
