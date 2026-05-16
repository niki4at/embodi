import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveTodayState, shouldShowStartMovementCard } from './today-state.ts'

const completedSession = {
  _id: 'session_123',
  status: 'completed',
  goal: 'Full body reset',
  modality: 'Strength',
  durationMin: 30,
  planCount: 5,
  setsLogged: 10,
  totalTargetSets: 10,
}

describe('today dashboard state', () => {
  it('shows the start movement card after today session is completed', () => {
    const state = deriveTodayState(null, completedSession)

    assert.equal(state.kind, 'completed')
    assert.equal(shouldShowStartMovementCard(state), true)
  })
})
