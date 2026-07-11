/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function asUser(t: ReturnType<typeof convexTest>, subject: string) {
  return t.withIdentity({
    subject,
    tokenIdentifier: `test|${subject}`,
  })
}

describe('training context backend', () => {
  it('stores preferences, equipment, events, and returns a learned suggestion', async () => {
    const t = convexTest(schema, modules)
    const user = asUser(t, 'user-one')

    await user.mutation(api.trainingPreferences.update, {
      locationEnabled: true,
      socialLocationSharing: 'generic',
      weeklyRhythm: [
        {
          day: 'monday',
          defaultEnvironment: 'gym',
          defaultEquipmentIntent: 'available',
          evening: 'gym',
        },
      ],
    })
    const equipmentId = await user.mutation(api.equipment.upsert, {
      catalogKey: 'dumbbell',
      label: 'Adjustable dumbbells',
      details: {
        minWeightKg: 2,
        maxWeightKg: 24,
        adjustable: true,
        quantity: 2,
      },
      photoStorageIds: [],
    })
    await user.mutation(api.trainingContext.recordEvent, {
      trainingEnvironment: 'gym',
      equipmentIntent: 'available',
      contextTags: [],
      workoutType: 'strength',
      goal: 'Upper body strength',
      localWeekday: 'monday',
      timeOfDay: 'evening',
      suggestionSource: 'manual',
      suggestionReason: 'Confirmed for this session.',
      equipmentKeys: ['dumbbell'],
    })

    const preferences = await user.query(api.trainingPreferences.get, {})
    const equipment = await user.query(api.equipment.listActive, {})
    const suggestion = await user.query(api.trainingContext.suggest, {
      workoutType: 'strength',
      goal: 'Upper body strength',
      weekday: 'monday',
      timeOfDay: 'evening',
    })

    expect(preferences).toMatchObject({
      locationEnabled: true,
      socialLocationSharing: 'generic',
      weeklyRhythm: [
        {
          day: 'monday',
          defaultEnvironment: 'gym',
          defaultEquipmentIntent: 'available',
        },
      ],
    })
    expect(equipment[0]?.equipment._id).toBe(equipmentId)
    expect(suggestion.environment.value).toBe('gym')
    expect(suggestion.activeEquipmentKeys).toContain('dumbbell')
  })

  it('prevents another user from changing owned equipment', async () => {
    const t = convexTest(schema, modules)
    const owner = asUser(t, 'owner')
    const stranger = asUser(t, 'stranger')
    const equipmentId = await owner.mutation(api.equipment.upsert, {
      catalogKey: 'mat',
      label: 'Yoga mat',
      details: {},
      photoStorageIds: [],
    })

    await expect(
      stranger.mutation(api.equipment.archive, {
        equipmentId,
        archived: true,
      }),
    ).rejects.toThrow('Equipment not found')
  })

  it('predicts Home treadmill only when a treadmill is saved', async () => {
    const t = convexTest(schema, modules)
    const user = asUser(t, 'home-runner')
    await user.mutation(api.equipment.upsert, {
      catalogKey: 'treadmill',
      label: 'Treadmill',
      details: {},
      photoStorageIds: [],
    })

    const suggestion = await user.query(api.trainingContext.suggest, {
      foregroundPlaceMatch: { trainingEnvironment: 'home' },
      workoutType: 'cardio',
      goal: 'Easy run',
      weekday: 'saturday',
      timeOfDay: 'morning',
    })

    expect(suggestion.environment.value).toBe('home')
    expect(suggestion.equipmentIntent.value).toBe('treadmill')
  })

  it('predicts Outdoors for cardio without a treadmill or stronger signal', async () => {
    const t = convexTest(schema, modules)
    const user = asUser(t, 'outdoor-runner')

    const suggestion = await user.query(api.trainingContext.suggest, {
      workoutType: 'cardio',
      goal: 'Easy walk',
      weekday: 'saturday',
      timeOfDay: 'morning',
    })

    expect(suggestion.environment.value).toBe('outdoors')
    expect(suggestion.equipmentIntent.value).toBe('bodyweight')
  })

  it('tracks and deletes a cancelled private equipment photo', async () => {
    const t = convexTest(schema, modules)
    const user = asUser(t, 'photo-owner')
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(['private equipment photo'])),
    )

    await user.mutation(api.equipment.registerPhotoUpload, { storageId })
    await user.mutation(api.equipment.discardPhotoUpload, { storageId })

    const stored = await t.run(async (ctx) => ctx.storage.get(storageId))
    expect(stored).toBeNull()
  })

  it('encrypts saved place coordinates and decrypts them only for the owner', async () => {
    process.env.TRAINING_PLACE_ENCRYPTION_KEY =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    process.env.TRAINING_PLACE_ENCRYPTION_KEY_VERSION = '1'
    const t = convexTest(schema, modules)
    const owner = asUser(t, 'place-owner')
    const stranger = asUser(t, 'place-stranger')

    await owner.action(api.trainingPlaceActions.save, {
      label: 'Home',
      trainingEnvironment: 'home',
      radiusM: 150,
      latitude: 51.501,
      longitude: -0.141,
    })
    const ownerPlaces = await owner.action(api.trainingPlaceActions.list, {})
    const strangerPlaces = await stranger.action(
      api.trainingPlaceActions.list,
      {},
    )
    const encrypted = await t.run(async (ctx) =>
      ctx.db.query('training_places').first(),
    )

    expect(ownerPlaces[0]).toMatchObject({
      label: 'Home',
      latitude: 51.501,
      longitude: -0.141,
    })
    expect(strangerPlaces).toEqual([])
    expect(encrypted?.encryptedCoordinates).not.toContain('51.501')
    expect(encrypted?.encryptionKeyVersion).toBe('1')
  })
})
