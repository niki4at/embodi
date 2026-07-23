import { describe, expect, test } from 'vitest'

import { DEFAULT_SETTINGS, notificationCategory } from './userSettings'

describe('DEFAULT_SETTINGS', () => {
  test('notifications default on, routines default private', () => {
    expect(DEFAULT_SETTINGS.notifyBackers).toBe(true)
    expect(DEFAULT_SETTINGS.notifyReactions).toBe(true)
    expect(DEFAULT_SETTINGS.notifyCommunities).toBe(true)
    expect(DEFAULT_SETTINGS.units).toBe('metric')
    expect(DEFAULT_SETTINGS.publicActivity).toBe(true)
    expect(DEFAULT_SETTINGS.publicRoutines).toBe(false)
  })
})

describe('notificationCategory', () => {
  test('maps every notification type to a settings category', () => {
    expect(notificationCategory('new_backer')).toBe('notifyBackers')
    expect(notificationCategory('back_request')).toBe('notifyBackers')
    expect(notificationCategory('back_accepted')).toBe('notifyBackers')
    expect(notificationCategory('cheer')).toBe('notifyReactions')
    expect(notificationCategory('comment')).toBe('notifyReactions')
    expect(notificationCategory('repost')).toBe('notifyReactions')
    expect(notificationCategory('workout_tried')).toBe('notifyReactions')
    expect(notificationCategory('community_invite')).toBe('notifyCommunities')
    expect(notificationCategory('community_milestone')).toBe(
      'notifyCommunities',
    )
  })
})
