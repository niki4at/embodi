import { describe, expect, it } from 'vitest'

import { EQUIPMENT_CATALOG } from '../../constants/equipment-catalog'
import {
  describeTrainingConstraints,
  exerciseFitsTrainingContext,
} from './equipmentConstraints'

describe('exerciseFitsTrainingContext', () => {
  it('treats saved home equipment as available rather than required', () => {
    const context = {
      trainingEnvironment: 'home' as const,
      equipmentIntent: 'available' as const,
      equipmentSnapshot: ['Dumbbells', 'Yoga mat'],
    }

    expect(exerciseFitsTrainingContext(['Dumbbell'], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Bodyweight'], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Cable'], context)).toBe(false)
  })

  it('keeps bodyweight intent strict even inside a gym', () => {
    const context = {
      trainingEnvironment: 'gym' as const,
      equipmentIntent: 'bodyweight' as const,
    }

    expect(exerciseFitsTrainingContext([], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Bodyweight'], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Machine'], context)).toBe(false)
  })

  it('allows treadmill work and bodyweight warmups for treadmill intent', () => {
    const context = {
      trainingEnvironment: 'gym' as const,
      equipmentIntent: 'treadmill' as const,
    }

    expect(exerciseFitsTrainingContext(['Treadmill'], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Bodyweight'], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Rower'], context)).toBe(false)
  })

  it('honors temporary gym exclusions', () => {
    const context = {
      trainingEnvironment: 'gym' as const,
      equipmentIntent: 'available' as const,
      unavailableEquipment: ['Cable machine'],
    }

    expect(exerciseFitsTrainingContext(['Barbell'], context)).toBe(true)
    expect(exerciseFitsTrainingContext(['Cable'], context)).toBe(false)
  })

  it('matches every home catalog key to normal exercise equipment wording', () => {
    const exerciseEquipmentByKey: Record<string, string> = {
      dumbbells: 'Dumbbell',
      kettlebells: 'Kettlebell',
      barbell: 'Barbell',
      bench: 'Bench',
      'squat-rack': 'Power rack',
      'pull-up-bar': 'Pull-up bar',
      'resistance-bands': 'Resistance band',
      'suspension-trainer': 'TRX',
      'cable-machine': 'Cable',
      treadmill: 'Treadmill',
      'stationary-bike': 'Exercise bike',
      'rowing-machine': 'Rower',
      'jump-rope': 'Jump rope',
      'yoga-mat': 'Mat',
      'foam-roller': 'Foam roller',
      'massage-gun': 'Massage gun',
    }

    for (const item of EQUIPMENT_CATALOG) {
      expect(
        exerciseFitsTrainingContext(
          [exerciseEquipmentByKey[item.key]],
          {
            trainingEnvironment: 'home',
            equipmentIntent: 'available',
            equipmentSnapshot: [
              { catalogKey: item.key, label: item.label },
            ],
          },
        ),
        item.key,
      ).toBe(true)
    }
  })
})

describe('describeTrainingConstraints', () => {
  it('states that owned equipment is optional', () => {
    const result = describeTrainingConstraints({
      trainingEnvironment: 'home',
      equipmentIntent: 'available',
      equipmentSnapshot: ['Dumbbell'],
    })

    expect(result).toContain('Owning equipment does not require you to use it')
    expect(result).toContain('Dumbbell')
  })
})
