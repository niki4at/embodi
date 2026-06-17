import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'

const bodyGroup = v.union(
  v.literal('chest'),
  v.literal('back'),
  v.literal('shoulders'),
  v.literal('arms'),
  v.literal('core'),
  v.literal('glutes'),
  v.literal('legs'),
  v.literal('fullBody'),
  v.literal('cardio'),
  v.literal('mobility'),
  v.literal('recovery'),
)

const modality = v.union(
  v.literal('strength'),
  v.literal('mobility'),
  v.literal('cardio'),
  v.literal('recovery'),
)

const customExerciseShape = v.object({
  _id: v.id('custom_exercises'),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  group: v.string(),
  bodyPart: v.string(),
  modality: v.string(),
  equipment: v.array(v.string()),
  iconName: v.optional(v.string()),
  createdAt: v.number(),
})

export const listCustomExercises = query({
  args: {},
  returns: v.array(customExerciseShape),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }
    return await ctx.db
      .query('custom_exercises')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .collect()
  },
})

export const createCustomExercise = mutation({
  args: {
    name: v.string(),
    group: bodyGroup,
    bodyPart: v.string(),
    modality,
    equipment: v.array(v.string()),
    iconName: v.optional(v.string()),
  },
  returns: v.id('custom_exercises'),
  handler: async (ctx, args): Promise<Id<'custom_exercises'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const name = args.name.trim()
    if (name.length === 0) {
      throw new Error('Give the exercise a name')
    }

    return await ctx.db.insert('custom_exercises', {
      userId: identity.subject,
      name,
      group: args.group,
      bodyPart: args.bodyPart.trim() || args.group,
      modality: args.modality,
      equipment: args.equipment,
      iconName: args.iconName,
      createdAt: Date.now(),
    })
  },
})

export const deleteCustomExercise = mutation({
  args: { exerciseId: v.id('custom_exercises') },
  returns: v.null(),
  handler: async (ctx, { exerciseId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const existing = await ctx.db.get(exerciseId)
    if (!existing) {
      throw new Error('Exercise not found')
    }
    if (existing.userId !== identity.subject) {
      throw new Error('Unauthorized')
    }

    await ctx.db.delete(exerciseId)
    return null
  },
})
