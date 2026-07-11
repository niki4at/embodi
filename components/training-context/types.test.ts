import { describe, expect, it } from 'vitest'

import { requiresTrainingContextConfirmation } from './types'

describe('training context confirmation', () => {
  it('blocks an unconfirmed low-confidence suggestion', () => {
    expect(requiresTrainingContextConfirmation(0.35, false)).toBe(true)
  })

  it('allows a confirmed or confident suggestion', () => {
    expect(requiresTrainingContextConfirmation(0.35, true)).toBe(false)
    expect(requiresTrainingContextConfirmation(0.78, false)).toBe(false)
    expect(requiresTrainingContextConfirmation(undefined, false)).toBe(false)
  })
})
