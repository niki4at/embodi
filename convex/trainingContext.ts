import { v } from 'convex/values'

import {
  scoreTrainingContext,
  type EquipmentIntent,
  type TrainingEnvironment,
  type Weekday,
} from '../shared/trainingContext'
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

const suggestionSource = v.union(
  v.literal('manual'),
  v.literal('place'),
  v.literal('workout_need'),
  v.literal('weekly_rhythm'),
  v.literal('history'),
  v.literal('fallback')
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

const partialContext = v.object({
  trainingEnvironment: v.optional(trainingEnvironment),
  equipmentIntent: v.optional(equipmentIntent),
})

const environmentPrediction = v.object({
  value: trainingEnvironment,
  confidence: v.number(),
  reason: v.string(),
  source: suggestionSource,
})

const equipmentPrediction = v.object({
  value: equipmentIntent,
  confidence: v.number(),
  reason: v.string(),
  source: suggestionSource,
})

export const suggest = query({
  args: {
    manualContext: v.optional(partialContext),
    foregroundPlaceMatch: v.optional(partialContext),
    workoutType: v.optional(v.string()),
    goal: v.optional(v.string()),
    weekday: v.optional(weekday),
    timeOfDay: v.optional(
      v.union(v.literal('morning'), v.literal('evening'))
    ),
  },
  returns: v.object({
    environment: environmentPrediction,
    equipmentIntent: equipmentPrediction,
    activeEquipmentKeys: v.array(v.string()),
    recentEventCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    if ((args.workoutType?.length ?? 0) > 120 || (args.goal?.length ?? 0) > 240) {
      throw new Error('Workout type or goal is too long')
    }

    const preferences = await ctx.db
      .query('training_preferences')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    const recentEvents = await ctx.db
      .query('training_context_events')
      .withIndex('by_userId_and_createdAt', (q) =>
        q.eq('userId', identity.subject)
      )
      .order('desc')
      .take(20)
    const activeEquipment = await ctx.db
      .query('user_equipment')
      .withIndex('by_userId_and_isArchived', (q) =>
        q.eq('userId', identity.subject).eq('isArchived', false)
      )
      .take(100)

    const fallback = preferences?.defaultContext ?? {
      trainingEnvironment: 'home' as const,
      equipmentIntent: 'bodyweight' as const,
    }
    const scored = scoreTrainingContext({
      manualContext: args.manualContext,
      foregroundPlaceMatch: args.foregroundPlaceMatch,
      workoutType: args.workoutType,
      goal: args.goal,
      weekday: args.weekday as Weekday | undefined,
      timeOfDay: args.timeOfDay,
      weeklyRhythm: preferences?.weeklySchedule,
      recentEvents,
      fallback,
    })
    const hasTreadmill = activeEquipment.some((item) =>
      `${item.catalogKey} ${item.label}`.toLowerCase().includes('treadmill')
    )
    const cardioSignal = `${args.workoutType ?? ''} ${args.goal ?? ''}`.toLowerCase()
    const cardioLike =
      cardioSignal.includes('cardio') ||
      cardioSignal.includes('run') ||
      cardioSignal.includes('walk') ||
      cardioSignal.includes('marathon') ||
      cardioSignal.includes('5k') ||
      cardioSignal.includes('10k')
    if (
      cardioLike &&
      scored.equipmentIntent.source !== 'manual' &&
      !(
        scored.equipmentIntent.value === 'bodyweight' &&
        scored.equipmentIntent.source !== 'fallback'
      )
    ) {
      if (
        scored.environment.value === 'gym' ||
        (scored.environment.value === 'home' && hasTreadmill)
      ) {
        scored.equipmentIntent = {
          value: 'treadmill',
          confidence: Math.max(0.72, scored.environment.confidence),
          reason:
            scored.environment.value === 'gym'
              ? 'Your Gym pattern supports treadmill cardio'
              : 'Your saved Home treadmill fits this cardio session',
          source:
            scored.environment.source === 'fallback'
              ? 'workout_need'
              : scored.environment.source,
        }
      } else if (
        scored.environment.value === 'outdoors' ||
        scored.environment.source === 'manual' ||
        scored.environment.source === 'place'
      ) {
        scored.equipmentIntent = {
          value: 'bodyweight',
          confidence: Math.max(0.72, scored.environment.confidence),
          reason: 'This cardio session works without equipment here',
          source: scored.environment.source,
        }
      } else {
        scored.environment = {
          value: 'outdoors',
          confidence: 0.72,
          reason: 'Outdoor cardio avoids equipment you do not have at Home',
          source: 'workout_need',
        }
        scored.equipmentIntent = {
          value: 'bodyweight',
          confidence: 0.72,
          reason: 'Outdoor cardio needs no equipment',
          source: 'workout_need',
        }
      }
    }
    if (
      scored.equipmentIntent.value === 'treadmill' &&
      scored.environment.value !== 'gym' &&
      !(scored.environment.value === 'home' && hasTreadmill)
    ) {
      if (
        scored.environment.source === 'manual' ||
        scored.environment.source === 'place'
      ) {
        scored.equipmentIntent = {
          value:
            scored.environment.value === 'home' && activeEquipment.length > 0
              ? 'available'
              : 'bodyweight',
          confidence: scored.environment.confidence,
          reason: `Adapted to your current ${scored.environment.value} setting`,
          source: scored.environment.source,
        }
      } else {
        scored.environment = {
          value: 'gym',
          confidence: scored.equipmentIntent.confidence,
          reason: 'A gym treadmill best matches this workout',
          source: 'workout_need',
        }
      }
    }

    return {
      ...scored,
      activeEquipmentKeys: activeEquipment.map((item) => item.catalogKey),
      recentEventCount: recentEvents.length,
    }
  },
})

export const recordEvent = mutation({
  args: {
    trainingEnvironment,
    equipmentIntent,
    contextTags: v.array(v.string()),
    workoutType: v.optional(v.string()),
    goal: v.optional(v.string()),
    localWeekday: v.optional(weekday),
    timeOfDay: v.optional(
      v.union(v.literal('morning'), v.literal('evening'))
    ),
    suggestionSource,
    suggestionReason: v.string(),
    equipmentKeys: v.array(v.string()),
  },
  returns: v.id('training_context_events'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    if (args.contextTags.length > 12) {
      throw new Error('Context supports at most 12 tags')
    }
    if (args.contextTags.some((tag) => tag.length > 80)) {
      throw new Error('Context tags must be 80 characters or fewer')
    }
    if (args.equipmentKeys.length > 100) {
      throw new Error('Equipment snapshot supports at most 100 items')
    }
    if (args.equipmentKeys.some((key) => key.length > 80)) {
      throw new Error('Equipment keys must be 80 characters or fewer')
    }
    if ((args.workoutType?.length ?? 0) > 120 || (args.goal?.length ?? 0) > 240) {
      throw new Error('Workout type or goal is too long')
    }
    if (args.suggestionReason.trim().length > 240) {
      throw new Error('Suggestion reason must be 240 characters or fewer')
    }

    const eventId = await ctx.db.insert('training_context_events', {
      userId: identity.subject,
      trainingEnvironment:
        args.trainingEnvironment as TrainingEnvironment,
      equipmentIntent: args.equipmentIntent as EquipmentIntent,
      contextTags: args.contextTags.map((tag) => tag.trim()).filter(Boolean),
      workoutType: args.workoutType?.trim(),
      goal: args.goal?.trim(),
      localWeekday: args.localWeekday,
      timeOfDay: args.timeOfDay,
      suggestionSource: args.suggestionSource,
      suggestionReason: args.suggestionReason.trim(),
      equipmentKeys: args.equipmentKeys,
      createdAt: Date.now(),
    })

    const retained = await ctx.db
      .query('training_context_events')
      .withIndex('by_userId_and_createdAt', (q) =>
        q.eq('userId', identity.subject)
      )
      .order('desc')
      .take(101)
    for (const staleEvent of retained.slice(100)) {
      await ctx.db.delete(staleEvent._id)
    }
    return eventId
  },
})
