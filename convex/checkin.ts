import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalQuery, mutation, query } from './_generated/server'

// Recommendation seed shape (mirrors trainer.recommendationSeedArg)
const recommendationSeedArg = v.object({
  title: v.string(),
  modality: v.string(),
  durationMin: v.number(),
  moveCount: v.number(),
  description: v.string(),
  reasoning: v.string(),
  tags: v.array(v.string()),
  source: v.union(v.literal('aligned'), v.literal('exploration')),
})

// Check-in data shape for validation
const checkinDataArg = v.object({
  energyLevel: v.number(),
  sleepQuality: v.union(
    v.literal('rough'),
    v.literal('okay'),
    v.literal('decent'),
    v.literal('great')
  ),
  painLevel: v.number(),
  painAreas: v.optional(v.array(v.string())),
  stressLevel: v.number(),
  workoutType: v.union(
    v.literal('strength'),
    v.literal('mobility'),
    v.literal('cardio'),
    v.literal('recovery'),
    v.literal('mixed')
  ),
  intensityPreference: v.union(
    v.literal('easy'),
    v.literal('moderate'),
    v.literal('challenging')
  ),
  timeAvailable: v.union(
    v.literal('15'),
    v.literal('30'),
    v.literal('45'),
    v.literal('60')
  ),
  notes: v.optional(v.string()),
})

export type CheckinData = {
  energyLevel: number
  sleepQuality: 'rough' | 'okay' | 'decent' | 'great'
  painLevel: number
  painAreas?: string[]
  stressLevel: number
  workoutType: 'strength' | 'mobility' | 'cardio' | 'recovery' | 'mixed'
  intensityPreference: 'easy' | 'moderate' | 'challenging'
  timeAvailable: '15' | '30' | '45' | '60'
  notes?: string
}

// Helper to get start of today (midnight) in user's timezone approximation
function getStartOfToday(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

// Create a new check-in and optionally create a pending session
export const createCheckin = mutation({
  args: {
    data: checkinDataArg,
    startSession: v.optional(v.boolean()),
    recommendationSeed: v.optional(recommendationSeedArg),
  },
  handler: async (
    ctx,
    { data, startSession, recommendationSeed }
  ): Promise<{
    checkinId: Id<'daily_checkins'>
    sessionId?: Id<'workout_sessions'>
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject
    const now = Date.now()

    // Create the check-in record
    const checkinId = await ctx.db.insert('daily_checkins', {
      userId,
      energyLevel: data.energyLevel,
      sleepQuality: data.sleepQuality,
      painLevel: data.painLevel,
      painAreas: data.painAreas,
      stressLevel: data.stressLevel,
      workoutType: data.workoutType,
      intensityPreference: data.intensityPreference,
      timeAvailable: data.timeAvailable,
      notes: data.notes,
      createdAt: now,
    })

    // If user wants to start a session, create a pending one
    let sessionId: Id<'workout_sessions'> | undefined

    if (startSession) {
      // Get user profile for goal (only used when no recommendation seeded the session)
      const onboarding = await ctx.db
        .query('onboarding')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first()

      const goal =
        recommendationSeed?.title ?? onboarding?.goal ?? 'Personalized session'

      // Create pending session linked to this check-in
      sessionId = await ctx.db.insert('workout_sessions', {
        userId,
        goal,
        modality: 'generating...',
        durationMin: recommendationSeed?.durationMin
          ?? parseInt(data.timeAvailable, 10),
        status: 'generating',
        plan: [],
        healthFacts: [],
        citations: [],
        checkinId,
        recommendationSeed,
        createdAt: now,
        updatedAt: now,
      })

      // Update check-in with session link
      await ctx.db.patch(checkinId, { sessionId })

      // Schedule background generation with check-in data + optional seed
      await ctx.scheduler.runAfter(0, internal.trainer.generateSessionPlan, {
        sessionId,
        userId,
        checkinId,
        recommendationSeed,
      })
    }

    return { checkinId, sessionId }
  },
})

// Start (or reuse) a workout session built from today's existing check-in.
// Used when a user has already checked in but no session was generated, or to
// retry after a failed generation. Returns the session ID either way.
export const startSessionFromTodaysCheckin = mutation({
  args: {
    // When true, always create a fresh session from today's check-in even if
    // one was already generated/completed. Used to start another session after
    // finishing today's.
    allowAdditional: v.optional(v.boolean()),
  },
  handler: async (ctx, { allowAdditional }): Promise<Id<'workout_sessions'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject
    const startOfToday = getStartOfToday()

    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(5)

    const todaysCheckin = checkins.find(
      (checkin) => checkin.createdAt >= startOfToday
    )
    if (!todaysCheckin) {
      throw new Error('No check-in for today')
    }

    if (!allowAdditional && todaysCheckin.sessionId) {
      const existing = await ctx.db.get(todaysCheckin.sessionId)
      if (existing && existing.status !== 'failed') {
        return existing._id
      }
    }

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    const goal = onboarding?.goal || 'Personalized session'

    const now = Date.now()
    const sessionId = await ctx.db.insert('workout_sessions', {
      userId,
      goal,
      modality: 'generating...',
      durationMin: parseInt(todaysCheckin.timeAvailable, 10),
      status: 'generating',
      plan: [],
      healthFacts: [],
      citations: [],
      checkinId: todaysCheckin._id,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(todaysCheckin._id, { sessionId })

    await ctx.scheduler.runAfter(0, internal.trainer.generateSessionPlan, {
      sessionId,
      userId,
      checkinId: todaysCheckin._id,
    })

    return sessionId
  },
})

// Get today's check-in for the current user (if exists)
export const getTodaysCheckin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const startOfToday = getStartOfToday()

    // Get the most recent check-in from today
    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .collect()

    // Find one from today
    const todaysCheckin = checkins.find(
      (checkin) => checkin.createdAt >= startOfToday
    )

    return todaysCheckin || null
  },
})

// Get recent check-in history for trends
export const getCheckinHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 7 }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .take(limit)

    return checkins
  },
})

// Internal query to get check-in by ID (for background actions)
export const getCheckinById = internalQuery({
  args: {
    checkinId: v.id('daily_checkins'),
  },
  handler: async (ctx, { checkinId }) => {
    return await ctx.db.get(checkinId)
  },
})

// Update a check-in (e.g., to add notes or modify before session starts)
export const updateCheckin = mutation({
  args: {
    checkinId: v.id('daily_checkins'),
    data: v.object({
      energyLevel: v.optional(v.number()),
      sleepQuality: v.optional(
        v.union(
          v.literal('rough'),
          v.literal('okay'),
          v.literal('decent'),
          v.literal('great')
        )
      ),
      painLevel: v.optional(v.number()),
      painAreas: v.optional(v.array(v.string())),
      stressLevel: v.optional(v.number()),
      workoutType: v.optional(
        v.union(
          v.literal('strength'),
          v.literal('mobility'),
          v.literal('cardio'),
          v.literal('recovery'),
          v.literal('mixed')
        )
      ),
      intensityPreference: v.optional(
        v.union(
          v.literal('easy'),
          v.literal('moderate'),
          v.literal('challenging')
        )
      ),
      timeAvailable: v.optional(
        v.union(
          v.literal('15'),
          v.literal('30'),
          v.literal('45'),
          v.literal('60')
        )
      ),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { checkinId, data }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const checkin = await ctx.db.get(checkinId)
    if (!checkin || checkin.userId !== identity.subject) {
      throw new Error('Check-in not found')
    }

    // Build update object with only defined fields
    const updates: Record<string, unknown> = {}
    if (data.energyLevel !== undefined) updates.energyLevel = data.energyLevel
    if (data.sleepQuality !== undefined) updates.sleepQuality = data.sleepQuality
    if (data.painLevel !== undefined) updates.painLevel = data.painLevel
    if (data.painAreas !== undefined) updates.painAreas = data.painAreas
    if (data.stressLevel !== undefined) updates.stressLevel = data.stressLevel
    if (data.workoutType !== undefined) updates.workoutType = data.workoutType
    if (data.intensityPreference !== undefined)
      updates.intensityPreference = data.intensityPreference
    if (data.timeAvailable !== undefined)
      updates.timeAvailable = data.timeAvailable
    if (data.notes !== undefined) updates.notes = data.notes

    await ctx.db.patch(checkinId, updates)

    return { success: true }
  },
})

// Helper function to format check-in data for AI prompt
export function formatCheckinForPrompt(checkin: {
  energyLevel: number
  sleepQuality: string
  painLevel: number
  painAreas?: string[]
  stressLevel: number
  workoutType: string
  intensityPreference: string
  timeAvailable: string
  notes?: string
}): string {
  const sleepLabels: Record<string, string> = {
    rough: 'Rough night, tired',
    okay: 'Could be better',
    decent: 'Decent rest',
    great: 'Slept great, well-rested',
  }

  const workoutLabels: Record<string, string> = {
    strength: 'Strength & power focus',
    mobility: 'Mobility & flexibility',
    cardio: 'Cardio & endurance',
    recovery: 'Active recovery',
    mixed: 'Mixed/balanced session',
  }

  const intensityLabels: Record<string, string> = {
    easy: 'Easy day - keep it light',
    moderate: 'Moderate - steady effort',
    challenging: 'Push me - want a challenge',
  }

  const painAreas = checkin.painAreas || []

  const lines = [
    `TODAY'S CHECK-IN:`,
    `- Energy Level: ${checkin.energyLevel}/10`,
    `- Sleep: ${sleepLabels[checkin.sleepQuality] || checkin.sleepQuality}`,
    `- Pain/Discomfort: ${checkin.painLevel}/10${checkin.painLevel > 3 && painAreas.length ? ` (Areas: ${painAreas.join(', ')})` : ''}`,
    `- Stress Level: ${checkin.stressLevel}/5`,
    `- Workout Preference: ${workoutLabels[checkin.workoutType] || checkin.workoutType}`,
    `- Intensity: ${intensityLabels[checkin.intensityPreference] || checkin.intensityPreference}`,
    `- Time Available: ${checkin.timeAvailable} minutes`,
  ]

  if (checkin.notes) {
    lines.push(`- Additional Notes: "${checkin.notes}"`)
  }

  lines.push('')
  lines.push('ADAPT THE WORKOUT based on this check-in:')

  // Add specific guidance based on values
  if (checkin.energyLevel < 5) {
    lines.push('- Low energy: Reduce volume, favor lighter movements')
  }
  if (checkin.painLevel > 5) {
    lines.push(
      '- Elevated pain: Include extra mobility, avoid aggravating movements'
    )
  }
  if (checkin.painLevel > 3 && painAreas.length) {
    lines.push(`- Pain areas to work around: ${painAreas.join(', ')}`)
  }
  if (checkin.stressLevel > 3) {
    lines.push('- High stress: Include breathwork, keep complexity low')
  }
  if (checkin.sleepQuality === 'rough') {
    lines.push('- Poor sleep: Prioritize recovery, reduce intensity')
  }

  return lines.join('\n')
}
