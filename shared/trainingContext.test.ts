import { describe, expect, it } from 'vitest'

import { scoreTrainingContext } from './trainingContext'

describe('scoreTrainingContext', () => {
  it('lets manual context override every inferred signal', () => {
    const result = scoreTrainingContext({
      manualContext: {
        trainingEnvironment: 'travel',
        equipmentIntent: 'bodyweight',
      },
      foregroundPlaceMatch: {
        trainingEnvironment: 'gym',
        equipmentIntent: 'available',
      },
      fallback: {
        trainingEnvironment: 'home',
        equipmentIntent: 'available',
      },
    })

    expect(result.environment).toEqual({
      value: 'travel',
      confidence: 1,
      reason: 'Selected for this workout',
      source: 'manual',
    })
    expect(result.equipmentIntent).toEqual({
      value: 'bodyweight',
      confidence: 1,
      reason: 'Selected for this workout',
      source: 'manual',
    })
  })

  it('can predict separate dimensions from place and weekly rhythm', () => {
    const result = scoreTrainingContext({
      foregroundPlaceMatch: {
        trainingEnvironment: 'gym',
      },
      weekday: 'monday',
      timeOfDay: 'evening',
      weeklyRhythm: [
        {
          weekday: 'monday',
          evening: {
            trainingEnvironment: 'outdoors',
            equipmentIntent: 'treadmill',
          },
        },
      ],
      fallback: {
        trainingEnvironment: 'home',
        equipmentIntent: 'bodyweight',
      },
    })

    expect(result.environment.value).toBe('gym')
    expect(result.environment.source).toBe('place')
    expect(result.equipmentIntent.value).toBe('treadmill')
    expect(result.equipmentIntent.source).toBe('weekly_rhythm')
  })

  it('lets recent matching events beat fallback without coordinates', () => {
    const result = scoreTrainingContext({
      workoutType: 'strength',
      goal: 'build strength',
      recentEvents: [
        {
          trainingEnvironment: 'gym',
          equipmentIntent: 'available',
          workoutType: 'strength',
          goal: 'build strength',
        },
        {
          trainingEnvironment: 'gym',
          equipmentIntent: 'available',
          workoutType: 'strength',
        },
      ],
      fallback: {
        trainingEnvironment: 'home',
        equipmentIntent: 'bodyweight',
      },
    })

    expect(result.environment.value).toBe('gym')
    expect(result.equipmentIntent.value).toBe('available')
    expect(result.environment.source).toBe('history')
    expect(result.environment.confidence).toBeGreaterThan(0.5)
  })

  it('uses specific workout needs before a normal weekly rhythm', () => {
    const result = scoreTrainingContext({
      workoutType: 'cardio',
      goal: 'Indoor treadmill run',
      weekday: 'saturday',
      timeOfDay: 'morning',
      weeklyRhythm: [
        {
          weekday: 'saturday',
          morning: {
            trainingEnvironment: 'home',
            equipmentIntent: 'bodyweight',
          },
        },
      ],
      fallback: {
        trainingEnvironment: 'home',
        equipmentIntent: 'bodyweight',
      },
    })

    expect(result.environment).toMatchObject({
      value: 'gym',
      source: 'workout_need',
    })
    expect(result.equipmentIntent).toMatchObject({
      value: 'treadmill',
      source: 'workout_need',
    })
  })

  it('learns weekday and time patterns from generic events', () => {
    const result = scoreTrainingContext({
      weekday: 'monday',
      timeOfDay: 'evening',
      recentEvents: [
        {
          trainingEnvironment: 'home',
          equipmentIntent: 'bodyweight',
          localWeekday: 'sunday',
          timeOfDay: 'morning',
        },
        {
          trainingEnvironment: 'gym',
          equipmentIntent: 'available',
          localWeekday: 'monday',
          timeOfDay: 'evening',
        },
      ],
      fallback: {
        trainingEnvironment: 'home',
        equipmentIntent: 'bodyweight',
      },
    })

    expect(result.environment.value).toBe('gym')
    expect(result.equipmentIntent.value).toBe('available')
    expect(result.environment.source).toBe('history')
  })
})
