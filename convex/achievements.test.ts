import { describe, expect, test } from 'vitest'

import {
  ACHIEVEMENT_DEFINITIONS,
  earnedKeys,
  type EvaluationFacts,
} from './achievements'

const baseFacts: EvaluationFacts = {
  completedCount: 0,
  sessionModality: 'strength',
  sessionSource: 'coach',
  sessionDurationMin: 30,
  sessionVolumeKg: 0,
  sessionDistanceM: 0,
  distinctModalities: 1,
  gapSincePreviousMs: null,
  currentStreakWeeks: 0,
  hasCompletedChallenge: false,
  hasJoinedCommunity: false,
  postCount: 0,
}

describe('ACHIEVEMENT_DEFINITIONS', () => {
  test('keys are unique', () => {
    const keys = ACHIEVEMENT_DEFINITIONS.map((definition) => definition.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('recovery milestones are private by default', () => {
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      if (definition.category === 'recovery') {
        expect(definition.isPrivate).toBe(true)
      }
    }
  })

  test('every rule output maps to a definition', () => {
    const defined = new Set(ACHIEVEMENT_DEFINITIONS.map((d) => d.key))
    const maxFacts: EvaluationFacts = {
      completedCount: 100,
      sessionModality: 'recovery',
      sessionSource: 'custom',
      sessionDurationMin: 90,
      sessionVolumeKg: 6000,
      sessionDistanceM: 12000,
      distinctModalities: 4,
      gapSincePreviousMs: 15 * 24 * 60 * 60 * 1000,
      currentStreakWeeks: 12,
      hasCompletedChallenge: true,
      hasJoinedCommunity: true,
      postCount: 3,
    }
    for (const key of earnedKeys(maxFacts)) {
      expect(defined.has(key)).toBe(true)
    }
  })
})

describe('earnedKeys', () => {
  test('first completed session earns first_workout only in consistency', () => {
    const keys = earnedKeys({ ...baseFacts, completedCount: 1 })
    expect(keys).toContain('first_workout')
    expect(keys).not.toContain('workouts_10')
    expect(keys).not.toContain('streak_4')
  })

  test('session-count thresholds accumulate', () => {
    const keys = earnedKeys({ ...baseFacts, completedCount: 100 })
    expect(keys).toEqual(
      expect.arrayContaining([
        'first_workout',
        'workouts_10',
        'workouts_50',
        'workouts_100',
      ])
    )
  })

  test('streak thresholds', () => {
    expect(earnedKeys({ ...baseFacts, currentStreakWeeks: 3 })).not.toContain(
      'streak_4'
    )
    const twelve = earnedKeys({ ...baseFacts, currentStreakWeeks: 12 })
    expect(twelve).toContain('streak_4')
    expect(twelve).toContain('streak_12')
  })

  test('performance rules use per-session values', () => {
    const keys = earnedKeys({
      ...baseFacts,
      sessionDurationMin: 60,
      sessionVolumeKg: 5000,
      sessionDistanceM: 10000,
    })
    expect(keys).toContain('hour_session')
    expect(keys).toContain('volume_5000')
    expect(keys).toContain('distance_10k')
  })

  test('just under performance thresholds earns nothing', () => {
    const keys = earnedKeys({
      ...baseFacts,
      sessionDurationMin: 59,
      sessionVolumeKg: 4999,
      sessionDistanceM: 9999,
    })
    expect(keys).not.toContain('hour_session')
    expect(keys).not.toContain('volume_5000')
    expect(keys).not.toContain('distance_10k')
  })

  test('custom session earns the builder milestone', () => {
    expect(earnedKeys({ ...baseFacts, sessionSource: 'custom' })).toContain(
      'custom_builder'
    )
    expect(earnedKeys({ ...baseFacts, sessionSource: 'coach' })).not.toContain(
      'custom_builder'
    )
  })

  test('comeback requires a 14-day gap', () => {
    const almost = 14 * 24 * 60 * 60 * 1000 - 1
    expect(
      earnedKeys({ ...baseFacts, gapSincePreviousMs: almost })
    ).not.toContain('comeback')
    expect(
      earnedKeys({ ...baseFacts, gapSincePreviousMs: almost + 1 })
    ).toContain('comeback')
    expect(earnedKeys({ ...baseFacts, gapSincePreviousMs: null })).not.toContain(
      'comeback'
    )
  })

  test('recovery session milestone is modality-based and case-insensitive', () => {
    expect(
      earnedKeys({ ...baseFacts, sessionModality: 'Recovery' })
    ).toContain('recovery_session')
    expect(
      earnedKeys({ ...baseFacts, sessionModality: 'strength' })
    ).not.toContain('recovery_session')
  })

  test('challenge, community, and sharing milestones', () => {
    const keys = earnedKeys({
      ...baseFacts,
      hasCompletedChallenge: true,
      hasJoinedCommunity: true,
      postCount: 1,
    })
    expect(keys).toContain('challenge_complete')
    expect(keys).toContain('community_join')
    expect(keys).toContain('first_share')
  })

  test('exploration requires three distinct modalities', () => {
    expect(earnedKeys({ ...baseFacts, distinctModalities: 2 })).not.toContain(
      'modalities_3'
    )
    expect(earnedKeys({ ...baseFacts, distinctModalities: 3 })).toContain(
      'modalities_3'
    )
  })
})
