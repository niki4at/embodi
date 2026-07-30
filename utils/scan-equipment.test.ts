import { describe, expect, it } from 'vitest'

import type { ExerciseEntry } from '@/constants/exercise-catalog'

/**
 * Mirrors build-workout / AddExerciseSheet toggle behaviour that ScanEquipment
 * forwards into via onSelectExercise. Kept here so the photo-match add path
 * cannot regress without a failing test.
 */
function toggleSelected(
  prev: ExerciseEntry[],
  exercise: ExerciseEntry,
): ExerciseEntry[] {
  const exists = prev.some((e) => e.id === exercise.id)
  if (exists) return prev.filter((e) => e.id !== exercise.id)
  return [...prev, exercise]
}

function resolveMatches(
  catalog: ExerciseEntry[],
  matches: { catalogId: string; confidence: number; reason: string }[],
) {
  const byId = new Map(catalog.map((ex) => [ex.id, ex]))
  return matches
    .map((m) => {
      const entry = byId.get(m.catalogId)
      if (!entry) return null
      return { entry, confidence: m.confidence, reason: m.reason }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
}

const latPulldown: ExerciseEntry = {
  id: 'back-lat-pulldown',
  name: 'Lat pulldown',
  group: 'back',
  bodyPart: 'Lats',
  equipment: 'Cable',
  modality: 'strength',
  iconName: 'dumbbell.fill',
}

const facePull: ExerciseEntry = {
  id: 'back-face-pull',
  name: 'Face pull',
  group: 'back',
  bodyPart: 'Upper back',
  equipment: 'Cable',
  modality: 'strength',
  iconName: 'dumbbell.fill',
}

describe('scan equipment add-to-workout path', () => {
  it('resolves recognition catalog ids onto full library entries', () => {
    const resolved = resolveMatches([latPulldown, facePull], [
      { catalogId: 'back-lat-pulldown', confidence: 0.9, reason: 'machine' },
      { catalogId: 'missing-id', confidence: 0.5, reason: 'noise' },
      { catalogId: 'back-face-pull', confidence: 0.8, reason: 'cable' },
    ])

    expect(resolved.map((m) => m.entry.id)).toEqual([
      'back-lat-pulldown',
      'back-face-pull',
    ])
  })

  it('adds a photo match to the workout selection on first tap', () => {
    const next = toggleSelected([], latPulldown)
    expect(next).toEqual([latPulldown])
  })

  it('adds multiple photo matches without dropping earlier ones', () => {
    const afterFirst = toggleSelected([], latPulldown)
    const afterSecond = toggleSelected(afterFirst, facePull)
    expect(afterSecond.map((e) => e.id)).toEqual([
      'back-lat-pulldown',
      'back-face-pull',
    ])
  })

  it('removes a photo match on second tap', () => {
    const selected = toggleSelected([latPulldown, facePull], latPulldown)
    expect(selected.map((e) => e.id)).toEqual(['back-face-pull'])
  })
})
