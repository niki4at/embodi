import { v } from 'convex/values'

import {
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server'

const trainingEnvironment = v.union(
  v.literal('home'),
  v.literal('gym'),
  v.literal('outdoors'),
  v.literal('travel')
)

const equipmentIntent = v.union(
  v.literal('available'),
  v.literal('bodyweight'),
  v.literal('treadmill')
)

const encryptedPlace = v.object({
  _id: v.id('training_places'),
  _creationTime: v.number(),
  userId: v.string(),
  label: v.string(),
  trainingEnvironment,
  equipmentIntent: v.optional(equipmentIntent),
  radiusM: v.number(),
  encryptedCoordinates: v.string(),
  encryptionIv: v.string(),
  encryptionAuthTag: v.string(),
  encryptionKeyVersion: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const listEncryptedForUser = internalQuery({
  args: { userId: v.string() },
  returns: v.array(encryptedPlace),
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('training_places')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(20)
  },
})

export const saveEncryptedForUser = internalMutation({
  args: {
    userId: v.string(),
    placeId: v.optional(v.id('training_places')),
    label: v.string(),
    trainingEnvironment,
    equipmentIntent: v.optional(equipmentIntent),
    radiusM: v.number(),
    encryptedCoordinates: v.string(),
    encryptionIv: v.string(),
    encryptionAuthTag: v.string(),
    encryptionKeyVersion: v.string(),
  },
  returns: v.id('training_places'),
  handler: async (ctx, args) => {
    const label = args.label.trim()
    if (!label) throw new Error('Place label is required')
    if (label.length > 80) {
      throw new Error('Place label must be 80 characters or fewer')
    }
    if (args.radiusM < 25 || args.radiusM > 5000) {
      throw new Error('Place radius must be between 25 and 5000 metres')
    }

    const now = Date.now()
    const fields = {
      label,
      trainingEnvironment: args.trainingEnvironment,
      equipmentIntent: args.equipmentIntent,
      radiusM: args.radiusM,
      encryptedCoordinates: args.encryptedCoordinates,
      encryptionIv: args.encryptionIv,
      encryptionAuthTag: args.encryptionAuthTag,
      encryptionKeyVersion: args.encryptionKeyVersion,
      updatedAt: now,
    }
    if (args.placeId) {
      const existing = await ctx.db.get(args.placeId)
      if (!existing || existing.userId !== args.userId) {
        throw new Error('Training place not found')
      }
      await ctx.db.patch(existing._id, fields)
      return existing._id
    }

    const existingPlaces = await ctx.db
      .query('training_places')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .take(20)
    if (
      args.trainingEnvironment === 'home' &&
      existingPlaces.some((place) => place.trainingEnvironment === 'home')
    ) {
      throw new Error('Only one Home place can be saved')
    }
    if (existingPlaces.length >= 20) {
      throw new Error('You can save up to 20 training places')
    }
    return await ctx.db.insert('training_places', {
      userId: args.userId,
      ...fields,
      createdAt: now,
    })
  },
})

export const deletePlace = mutation({
  args: { placeId: v.id('training_places') },
  returns: v.null(),
  handler: async (ctx, { placeId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const place = await ctx.db.get(placeId)
    if (!place || place.userId !== identity.subject) {
      throw new Error('Training place not found')
    }
    await ctx.db.delete(place._id)
    return null
  },
})
