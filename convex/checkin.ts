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

const trainingEnvironmentArg = v.union(
  v.literal('home'),
  v.literal('gym'),
  v.literal('outdoors'),
  v.literal('travel')
)

const equipmentIntentArg = v.union(
  v.literal('available'),
  v.literal('bodyweight'),
  v.literal('treadmill')
)

const suggestionSourceArg = v.union(
  v.literal('manual'),
  v.literal('place'),
  v.literal('workout_need'),
  v.literal('weekly_rhythm'),
  v.literal('history'),
  v.literal('fallback')
)

const equipmentCapabilitiesArg = v.object({
  weightMinKg: v.optional(v.number()),
  weightMaxKg: v.optional(v.number()),
  adjustable: v.optional(v.boolean()),
  incline: v.optional(v.boolean()),
  speedControl: v.optional(v.boolean()),
  resistanceLevels: v.optional(v.number()),
  quantity: v.optional(v.number()),
  resistance: v.optional(v.string()),
  dimensions: v.optional(v.string()),
})

const equipmentSnapshotItemArg = v.object({
  catalogKey: v.string(),
  label: v.string(),
  details: v.optional(v.string()),
  capabilities: v.optional(equipmentCapabilitiesArg),
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
  focusAreas: v.optional(v.array(v.string())),
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
  trainingEnvironment: v.optional(trainingEnvironmentArg),
  equipmentIntent: v.optional(equipmentIntentArg),
  contextTags: v.optional(v.array(v.string())),
  suggestionSource: v.optional(suggestionSourceArg),
  suggestionReason: v.optional(v.string()),
  unavailableEquipment: v.optional(v.array(v.string())),
})

const checkinDocument = v.object({
  _id: v.id('daily_checkins'),
  _creationTime: v.number(),
  userId: v.string(),
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
  focusAreas: v.optional(v.array(v.string())),
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
  trainingEnvironment: v.optional(trainingEnvironmentArg),
  equipmentIntent: v.optional(equipmentIntentArg),
  contextTags: v.optional(v.array(v.string())),
  suggestionSource: v.optional(suggestionSourceArg),
  suggestionReason: v.optional(v.string()),
  equipmentSnapshot: v.optional(v.array(equipmentSnapshotItemArg)),
  unavailableEquipment: v.optional(v.array(v.string())),
  sessionId: v.optional(v.id('workout_sessions')),
  createdAt: v.number(),
})

export type CheckinData = {
  energyLevel: number
  sleepQuality: 'rough' | 'okay' | 'decent' | 'great'
  painLevel: number
  painAreas?: string[]
  stressLevel: number
  workoutType: 'strength' | 'mobility' | 'cardio' | 'recovery' | 'mixed'
  focusAreas?: string[]
  intensityPreference: 'easy' | 'moderate' | 'challenging'
  timeAvailable: '15' | '30' | '45' | '60'
  notes?: string
  trainingEnvironment?: 'home' | 'gym' | 'outdoors' | 'travel'
  equipmentIntent?: 'available' | 'bodyweight' | 'treadmill'
  contextTags?: string[]
  suggestionSource?:
    | 'manual'
    | 'place'
    | 'workout_need'
    | 'weekly_rhythm'
    | 'history'
    | 'fallback'
  suggestionReason?: string
  equipmentSnapshot?: {
    catalogKey: string
    label: string
    details?: string
    capabilities?: {
      weightMinKg?: number
      weightMaxKg?: number
      adjustable?: boolean
      incline?: boolean
      speedControl?: boolean
      resistanceLevels?: number
    }
  }[]
  unavailableEquipment?: string[]
}

function validateContextBounds(data: Partial<CheckinData>): void {
  if (
    data.energyLevel !== undefined &&
    (!Number.isFinite(data.energyLevel) ||
      data.energyLevel < 1 ||
      data.energyLevel > 10)
  ) {
    throw new Error('Energy level must be between 1 and 10')
  }
  if (
    data.painLevel !== undefined &&
    (!Number.isFinite(data.painLevel) ||
      data.painLevel < 0 ||
      data.painLevel > 10)
  ) {
    throw new Error('Pain level must be between 0 and 10')
  }
  if (
    data.stressLevel !== undefined &&
    (!Number.isFinite(data.stressLevel) ||
      data.stressLevel < 1 ||
      data.stressLevel > 5)
  ) {
    throw new Error('Stress level must be between 1 and 5')
  }
  if ((data.notes?.length ?? 0) > 1000) {
    throw new Error('Notes must be 1000 characters or fewer')
  }
  if ((data.painAreas?.length ?? 0) > 30) {
    throw new Error('Pain areas support at most 30 items')
  }
  if ((data.focusAreas?.length ?? 0) > 20) {
    throw new Error('Focus areas support at most 20 items')
  }
  if ((data.contextTags?.length ?? 0) > 12) {
    throw new Error('Context supports at most 12 tags')
  }
  if (data.contextTags?.some((tag) => tag.length > 80)) {
    throw new Error('Context tags must be 80 characters or fewer')
  }
  if ((data.unavailableEquipment?.length ?? 0) > 100) {
    throw new Error('Unavailable equipment supports at most 100 items')
  }
  if (data.unavailableEquipment?.some((item) => item.length > 80)) {
    throw new Error('Unavailable equipment names must be 80 characters or fewer')
  }
  if ((data.suggestionReason?.length ?? 0) > 240) {
    throw new Error('Suggestion reason must be 240 characters or fewer')
  }
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
  returns: v.object({
    checkinId: v.id('daily_checkins'),
    sessionId: v.optional(v.id('workout_sessions')),
  }),
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
    validateContextBounds(data)
    const trustedEquipment =
      data.trainingEnvironment === 'home' &&
      data.equipmentIntent === 'available'
        ? await ctx.db
            .query('user_equipment')
            .withIndex('by_userId_and_isArchived', (q) =>
              q.eq('userId', userId).eq('isArchived', false)
            )
            .take(100)
        : []
    const trustedEquipmentSnapshot = trustedEquipment.map((item) => ({
      catalogKey: item.catalogKey,
      label: item.label,
      details: item.details,
      capabilities: item.capabilities,
    }))

    // Create the check-in record
    const checkinId = await ctx.db.insert('daily_checkins', {
      userId,
      energyLevel: data.energyLevel,
      sleepQuality: data.sleepQuality,
      painLevel: data.painLevel,
      painAreas: data.painAreas,
      stressLevel: data.stressLevel,
      workoutType: data.workoutType,
      focusAreas: data.focusAreas,
      intensityPreference: data.intensityPreference,
      timeAvailable: data.timeAvailable,
      notes: data.notes,
      trainingEnvironment: data.trainingEnvironment,
      equipmentIntent: data.equipmentIntent,
      contextTags: data.contextTags,
      suggestionSource: data.suggestionSource,
      suggestionReason: data.suggestionReason,
      equipmentSnapshot: trustedEquipmentSnapshot,
      unavailableEquipment: data.unavailableEquipment,
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
        trainingEnvironment: data.trainingEnvironment,
        equipmentIntent: data.equipmentIntent,
        contextTags: data.contextTags,
        suggestionSource: data.suggestionSource,
        suggestionReason: data.suggestionReason,
        equipmentSnapshot: trustedEquipmentSnapshot,
        unavailableEquipment: data.unavailableEquipment,
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
  returns: v.id('workout_sessions'),
  handler: async (ctx, { allowAdditional }): Promise<Id<'workout_sessions'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject
    const startOfToday = getStartOfToday()

    const todaysCheckin = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', userId).gte('createdAt', startOfToday)
      )
      .order('desc')
      .first()
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
      trainingEnvironment: todaysCheckin.trainingEnvironment,
      equipmentIntent: todaysCheckin.equipmentIntent,
      contextTags: todaysCheckin.contextTags,
      suggestionSource: todaysCheckin.suggestionSource,
      suggestionReason: todaysCheckin.suggestionReason,
      equipmentSnapshot: todaysCheckin.equipmentSnapshot,
      unavailableEquipment: todaysCheckin.unavailableEquipment,
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
  returns: v.union(checkinDocument, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const startOfToday = getStartOfToday()

    return await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', identity.subject).gte('createdAt', startOfToday)
      )
      .order('desc')
      .first()
  },
})

// Get recent check-in history for trends
export const getCheckinHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(checkinDocument),
  handler: async (ctx, { limit = 7 }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .take(Math.min(Math.max(Math.floor(limit), 1), 30))

    return checkins
  },
})

// Internal query to get check-in by ID (for background actions)
export const getCheckinById = internalQuery({
  args: {
    checkinId: v.id('daily_checkins'),
  },
  returns: v.union(checkinDocument, v.null()),
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
      focusAreas: v.optional(v.array(v.string())),
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
      trainingEnvironment: v.optional(trainingEnvironmentArg),
      equipmentIntent: v.optional(equipmentIntentArg),
      contextTags: v.optional(v.array(v.string())),
      suggestionSource: v.optional(suggestionSourceArg),
      suggestionReason: v.optional(v.string()),
      unavailableEquipment: v.optional(v.array(v.string())),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, { checkinId, data }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const checkin = await ctx.db.get(checkinId)
    if (!checkin || checkin.userId !== identity.subject) {
      throw new Error('Check-in not found')
    }
    validateContextBounds(data)

    // Build update object with only defined fields
    const updates: Record<string, unknown> = {}
    if (data.energyLevel !== undefined) updates.energyLevel = data.energyLevel
    if (data.sleepQuality !== undefined) updates.sleepQuality = data.sleepQuality
    if (data.painLevel !== undefined) updates.painLevel = data.painLevel
    if (data.painAreas !== undefined) updates.painAreas = data.painAreas
    if (data.stressLevel !== undefined) updates.stressLevel = data.stressLevel
    if (data.workoutType !== undefined) updates.workoutType = data.workoutType
    if (data.focusAreas !== undefined) updates.focusAreas = data.focusAreas
    if (data.intensityPreference !== undefined)
      updates.intensityPreference = data.intensityPreference
    if (data.timeAvailable !== undefined)
      updates.timeAvailable = data.timeAvailable
    if (data.notes !== undefined) updates.notes = data.notes
    if (data.trainingEnvironment !== undefined)
      updates.trainingEnvironment = data.trainingEnvironment
    if (data.equipmentIntent !== undefined)
      updates.equipmentIntent = data.equipmentIntent
    if (data.contextTags !== undefined) updates.contextTags = data.contextTags
    if (data.suggestionSource !== undefined)
      updates.suggestionSource = data.suggestionSource
    if (data.suggestionReason !== undefined)
      updates.suggestionReason = data.suggestionReason
    if (data.unavailableEquipment !== undefined)
      updates.unavailableEquipment = data.unavailableEquipment

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
  focusAreas?: string[]
  intensityPreference: string
  timeAvailable: string
  notes?: string
  trainingEnvironment?: string
  equipmentIntent?: string
  contextTags?: string[]
  suggestionSource?: string
  suggestionReason?: string
  equipmentSnapshot?: { catalogKey: string; label: string }[]
  unavailableEquipment?: string[]
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

  const focusLabels: Record<string, string> = {
    'full-body': 'Full body',
    'upper-body': 'Upper body',
    'lower-body': 'Lower body',
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    arms: 'Arms',
    core: 'Core',
    legs: 'Legs',
    glutes: 'Glutes',
  }

  const painAreas = checkin.painAreas || []
  const focusAreas = checkin.focusAreas || []
  const focusAreaLabels = focusAreas.map(area => focusLabels[area] || area)

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

  if (focusAreaLabels.length) {
    lines.push(`- Focus Areas: ${focusAreaLabels.join(', ')}`)
  }

  if (checkin.notes) {
    lines.push(`- Additional Notes: "${checkin.notes}"`)
  }
  if (checkin.trainingEnvironment) {
    lines.push(`- Training Environment: ${checkin.trainingEnvironment}`)
  }
  if (checkin.equipmentIntent) {
    lines.push(`- Equipment Intent: ${checkin.equipmentIntent}`)
  }
  if (checkin.contextTags?.length) {
    lines.push(`- Context Tags: ${checkin.contextTags.join(', ')}`)
  }
  if (checkin.suggestionSource && checkin.suggestionReason) {
    lines.push(
      `- Context Suggestion: ${checkin.suggestionSource} (${checkin.suggestionReason})`
    )
  }
  if (checkin.equipmentSnapshot?.length) {
    lines.push(
      `- Available Equipment: ${checkin.equipmentSnapshot.map((item) => item.label).join(', ')}`
    )
  }
  if (checkin.unavailableEquipment?.length) {
    lines.push(
      `- Unavailable Equipment: ${checkin.unavailableEquipment.join(', ')}`
    )
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
  if (focusAreaLabels.length) {
    lines.push(
      `- Bias exercise selection toward these areas: ${focusAreaLabels.join(', ')} (while still respecting any pain areas to avoid)`
    )
  }
  if (checkin.stressLevel > 3) {
    lines.push('- High stress: Include breathwork, keep complexity low')
  }
  if (checkin.sleepQuality === 'rough') {
    lines.push('- Poor sleep: Prioritize recovery, reduce intensity')
  }

  return lines.join('\n')
}
