import { describe, expect, it } from 'vitest'

import { exerciseFitsTrainingContext } from './lib/equipmentConstraints'
import { fallbackPlanForContext } from './trainer'

const profile = {
  name: 'Taylor',
  age: '34',
  gender: null,
  goal: 'Build consistency',
  activityLevel: 'moderate' as const,
  timeAvailable: ['30 minutes'],
  injuries: [],
  conditions: [],
  medications: '',
  smoking: null,
  alcohol: null,
}

describe('context-aware trainer fallback', () => {
  it('includes treadmill work for treadmill intent', () => {
    const context = {
      trainingEnvironment: 'gym' as const,
      equipmentIntent: 'treadmill' as const,
    }
    const fallback = fallbackPlanForContext(profile, context)

    expect(
      fallback.exercises.some((exercise) =>
        exercise.equipment.includes('Treadmill'),
      ),
    ).toBe(true)
    expect(
      fallback.exercises.every((exercise) =>
        exerciseFitsTrainingContext(exercise.equipment, context),
      ),
    ).toBe(true)
  })

  it('keeps bodyweight fallback free from equipment', () => {
    const context = {
      trainingEnvironment: 'gym' as const,
      equipmentIntent: 'bodyweight' as const,
    }
    const fallback = fallbackPlanForContext(profile, context)

    expect(
      fallback.exercises.every((exercise) =>
        exerciseFitsTrainingContext(exercise.equipment, context),
      ),
    ).toBe(true)
  })
})
