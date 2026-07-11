import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

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

const weekday = v.union(
  v.literal('monday'),
  v.literal('tuesday'),
  v.literal('wednesday'),
  v.literal('thursday'),
  v.literal('friday'),
  v.literal('saturday'),
  v.literal('sunday')
)

const contextSelection = v.object({
  trainingEnvironment,
  equipmentIntent,
})

const scheduleEntry = v.object({
  weekday,
  morning: v.optional(contextSelection),
  evening: v.optional(contextSelection),
})

const preferencesFields = {
  weeklySchedule: v.array(scheduleEntry),
  locationEnabled: v.boolean(),
  sharingDefault: v.union(
    v.literal('private'),
    v.literal('backers'),
    v.literal('public')
  ),
  defaultContext: contextSelection,
  shareGenericLocation: v.optional(v.boolean()),
}

const dayRhythm = v.object({
  day: weekday,
  defaultEnvironment: trainingEnvironment,
  defaultEquipmentIntent: equipmentIntent,
  morning: v.optional(trainingEnvironment),
  morningEquipmentIntent: v.optional(equipmentIntent),
  evening: v.optional(trainingEnvironment),
  eveningEquipmentIntent: v.optional(equipmentIntent),
})

const preferencesDocument = v.object({
  _id: v.id('training_preferences'),
  _creationTime: v.number(),
  userId: v.string(),
  ...preferencesFields,
  createdAt: v.number(),
  updatedAt: v.number(),
  weeklyRhythm: v.array(dayRhythm),
  socialLocationSharing: v.union(
    v.literal('private'),
    v.literal('generic')
  ),
})

function validateWeeklySchedule(
  schedule: { weekday: string }[]
): void {
  if (schedule.length > 7) {
    throw new Error('Weekly schedule supports at most seven days')
  }
  const weekdays = new Set(schedule.map((entry) => entry.weekday))
  if (weekdays.size !== schedule.length) {
    throw new Error('Weekly schedule can only contain one entry per weekday')
  }
}

export const get = query({
  args: {},
  returns: v.union(preferencesDocument, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const preferences = await ctx.db
      .query('training_preferences')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    if (!preferences) return null
    return {
      ...preferences,
      weeklyRhythm: preferences.weeklySchedule.map((entry) => ({
        day: entry.weekday,
        defaultEnvironment:
          entry.morning?.trainingEnvironment ??
          entry.evening?.trainingEnvironment ??
          preferences.defaultContext.trainingEnvironment,
        defaultEquipmentIntent:
          entry.morning?.equipmentIntent ??
          entry.evening?.equipmentIntent ??
          preferences.defaultContext.equipmentIntent,
        morning: entry.morning?.trainingEnvironment,
        morningEquipmentIntent: entry.morning?.equipmentIntent,
        evening: entry.evening?.trainingEnvironment,
        eveningEquipmentIntent: entry.evening?.equipmentIntent,
      })),
      socialLocationSharing: preferences.shareGenericLocation
        ? ('generic' as const)
        : ('private' as const),
    }
  },
})

export const save = mutation({
  args: preferencesFields,
  returns: v.id('training_preferences'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    validateWeeklySchedule(args.weeklySchedule)

    const existing = await ctx.db
      .query('training_preferences')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('training_preferences', {
      userId: identity.subject,
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    locationEnabled: v.optional(v.boolean()),
    socialLocationSharing: v.optional(
      v.union(v.literal('private'), v.literal('generic'))
    ),
    weeklyRhythm: v.optional(v.array(dayRhythm)),
    resetLearnedPatterns: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const existing = await ctx.db
      .query('training_preferences')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    const defaultContext = existing?.defaultContext ?? {
      trainingEnvironment: 'home' as const,
      equipmentIntent: 'bodyweight' as const,
    }
    const now = Date.now()
    const weeklySchedule = args.weeklyRhythm
      ? args.weeklyRhythm.map((entry) => ({
          weekday: entry.day,
          morning: entry.morning
            ? {
                trainingEnvironment: entry.morning,
                equipmentIntent:
                  entry.morningEquipmentIntent ??
                  entry.defaultEquipmentIntent,
              }
            : {
                trainingEnvironment: entry.defaultEnvironment,
                equipmentIntent: entry.defaultEquipmentIntent,
              },
          evening: entry.evening
            ? {
                trainingEnvironment: entry.evening,
                equipmentIntent:
                  entry.eveningEquipmentIntent ??
                  entry.defaultEquipmentIntent,
              }
            : {
                trainingEnvironment: entry.defaultEnvironment,
                equipmentIntent: entry.defaultEquipmentIntent,
              },
        }))
      : existing?.weeklySchedule ?? []
    validateWeeklySchedule(weeklySchedule)

    if (existing) {
      await ctx.db.patch(existing._id, {
        locationEnabled: args.locationEnabled ?? existing.locationEnabled,
        shareGenericLocation:
          args.socialLocationSharing === undefined
            ? existing.shareGenericLocation
            : args.socialLocationSharing === 'generic',
        weeklySchedule,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('training_preferences', {
        userId: identity.subject,
        weeklySchedule,
        locationEnabled: args.locationEnabled ?? false,
        sharingDefault: 'private',
        shareGenericLocation: args.socialLocationSharing === 'generic',
        defaultContext,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (args.resetLearnedPatterns) {
      const events = await ctx.db
        .query('training_context_events')
        .withIndex('by_userId_and_createdAt', (q) =>
          q.eq('userId', identity.subject)
        )
        .take(100)
      for (const event of events) {
        await ctx.db.delete(event._id)
      }
    }
    return null
  },
})

export const deletePreferences = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const existing = await ctx.db
      .query('training_preferences')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})

export const resetLearning = mutation({
  args: {},
  returns: v.object({ deletedEvents: v.number() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const events = await ctx.db
      .query('training_context_events')
      .withIndex('by_userId_and_createdAt', (q) =>
        q.eq('userId', identity.subject)
      )
      .take(100)
    for (const event of events) {
      await ctx.db.delete(event._id)
    }
    return { deletedEvents: events.length }
  },
})
