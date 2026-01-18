import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'

// Validator for check-in data
const checkinDataArg = v.object({
  energyLevel: v.number(),
  sleepQuality: v.number(),
  stressLevel: v.number(),
  painLevel: v.optional(v.number()),
  painAreas: v.optional(v.array(v.string())),
  workoutIntensity: v.union(
    v.literal('push-hard'),
    v.literal('moderate'),
    v.literal('easy'),
    v.literal('just-move')
  ),
  timeAvailable: v.union(
    v.literal('15-min'),
    v.literal('30-min'),
    v.literal('45-min'),
    v.literal('60-min')
  ),
  focusAreas: v.optional(v.array(v.string())),
  workoutType: v.optional(
    v.union(
      v.literal('strength'),
      v.literal('cardio'),
      v.literal('mobility'),
      v.literal('recovery'),
      v.literal('mixed')
    )
  ),
  notes: v.optional(v.string()),
  mood: v.optional(
    v.union(
      v.literal('great'),
      v.literal('good'),
      v.literal('okay'),
      v.literal('tired'),
      v.literal('stressed')
    )
  ),
})

export type CheckinData = {
  energyLevel: number
  sleepQuality: number
  stressLevel: number
  painLevel?: number
  painAreas?: string[]
  workoutIntensity: 'push-hard' | 'moderate' | 'easy' | 'just-move'
  timeAvailable: '15-min' | '30-min' | '45-min' | '60-min'
  focusAreas?: string[]
  workoutType?: 'strength' | 'cardio' | 'mobility' | 'recovery' | 'mixed'
  notes?: string
  mood?: 'great' | 'good' | 'okay' | 'tired' | 'stressed'
}

// Submit a daily check-in and create a pending session
export const submitCheckinAndStartSession = mutation({
  args: {
    checkinData: checkinDataArg,
  },
  handler: async (ctx, { checkinData }): Promise<Id<'workout_sessions'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject
    const now = Date.now()

    // Get user profile for goal
    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    // Build a contextual goal based on check-in data
    const goal = buildSessionGoal(checkinData, onboarding?.goal || 'Personalized session')

    // Create the check-in record
    const checkinId = await ctx.db.insert('daily_checkins', {
      userId,
      energyLevel: checkinData.energyLevel,
      sleepQuality: checkinData.sleepQuality,
      stressLevel: checkinData.stressLevel,
      painLevel: checkinData.painLevel,
      painAreas: checkinData.painAreas,
      workoutIntensity: checkinData.workoutIntensity,
      timeAvailable: checkinData.timeAvailable,
      focusAreas: checkinData.focusAreas,
      workoutType: checkinData.workoutType,
      notes: checkinData.notes,
      mood: checkinData.mood,
      createdAt: now,
    })

    // Convert time to minutes
    const durationMin = timeToMinutes(checkinData.timeAvailable)

    // Create a pending session
    const sessionId = await ctx.db.insert('workout_sessions', {
      userId,
      goal,
      modality: checkinData.workoutType || 'mixed',
      durationMin,
      status: 'generating',
      plan: [],
      healthFacts: [],
      citations: [],
      createdAt: now,
      updatedAt: now,
    })

    // Link the check-in to the session
    await ctx.db.patch(checkinId, { sessionId })

    // Schedule background generation with check-in data
    await ctx.scheduler.runAfter(
      0,
      internal.trainer.generateSessionPlanWithCheckin,
      {
        sessionId,
        userId,
        checkinData,
      }
    )

    return sessionId
  },
})

// Get today's check-in if exists
export const getTodaysCheckin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const startOfDay = getStartOfDay()

    // Find check-in created today
    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .take(5)

    // Return the most recent check-in from today
    return checkins.find((c) => c.createdAt >= startOfDay) || null
  },
})

// Get recent check-ins for trend analysis
export const getRecentCheckins = query({
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

// Internal query to get check-in by session ID
export const getCheckinBySessionId = internalQuery({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  handler: async (ctx, { sessionId }) => {
    const checkins = await ctx.db
      .query('daily_checkins')
      .filter((q) => q.eq(q.field('sessionId'), sessionId))
      .first()

    return checkins
  },
})

// Internal query to get check-in data for a user's most recent check-in
export const getLatestCheckinByUserId = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const startOfDay = getStartOfDay()

    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(1)

    // Return if from today
    const latest = checkins[0]
    if (latest && latest.createdAt >= startOfDay) {
      return latest
    }

    return null
  },
})

// Update a check-in's linked session
export const linkCheckinToSession = internalMutation({
  args: {
    checkinId: v.id('daily_checkins'),
    sessionId: v.id('workout_sessions'),
  },
  handler: async (ctx, { checkinId, sessionId }) => {
    await ctx.db.patch(checkinId, { sessionId })
  },
})

// Helper to get start of day timestamp
function getStartOfDay(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

// Helper to convert time string to minutes
function timeToMinutes(time: string): number {
  switch (time) {
    case '15-min':
      return 15
    case '30-min':
      return 30
    case '45-min':
      return 45
    case '60-min':
      return 60
    default:
      return 30
  }
}

// Helper to build a contextual session goal based on check-in
function buildSessionGoal(checkinData: CheckinData, baseGoal: string): string {
  const parts: string[] = []

  // Workout type influence
  if (checkinData.workoutType) {
    const typeLabels: Record<string, string> = {
      strength: 'Strength',
      cardio: 'Cardio',
      mobility: 'Mobility',
      recovery: 'Recovery',
      mixed: 'Full Body',
    }
    parts.push(typeLabels[checkinData.workoutType] || 'Mixed')
  }

  // Intensity influence
  const intensityLabels: Record<string, string> = {
    'push-hard': 'High Intensity',
    moderate: 'Moderate',
    easy: 'Easy',
    'just-move': 'Gentle Movement',
  }

  parts.push(intensityLabels[checkinData.workoutIntensity] || 'Session')

  // Focus areas
  if (checkinData.focusAreas && checkinData.focusAreas.length > 0) {
    parts.push(`(${checkinData.focusAreas.slice(0, 2).join(', ')})`)
  }

  return parts.join(' ') || baseGoal
}

// Format check-in data for AI context
export function formatCheckinForAI(checkinData: CheckinData): string {
  const lines: string[] = []

  lines.push('=== TODAY\'S CHECK-IN ===')
  
  // Energy and sleep
  lines.push(`Energy Level: ${checkinData.energyLevel}/10`)
  lines.push(`Sleep Quality: ${checkinData.sleepQuality}/10`)
  lines.push(`Stress Level: ${checkinData.stressLevel}/5`)
  
  if (checkinData.mood) {
    lines.push(`Current Mood: ${checkinData.mood}`)
  }

  // Pain assessment
  if (checkinData.painLevel !== undefined && checkinData.painLevel > 0) {
    lines.push(`Pain Level: ${checkinData.painLevel}/10`)
    if (checkinData.painAreas && checkinData.painAreas.length > 0) {
      lines.push(`Pain Areas Today: ${checkinData.painAreas.join(', ')}`)
    }
  } else {
    lines.push('Pain Level: None reported')
  }

  // Workout preferences
  const intensityDescriptions: Record<string, string> = {
    'push-hard': 'Wants to push hard and challenge themselves',
    moderate: 'Looking for a moderate, balanced session',
    easy: 'Needs an easier session today',
    'just-move': 'Just wants to move and feel good',
  }
  lines.push(`Intensity Preference: ${intensityDescriptions[checkinData.workoutIntensity]}`)
  
  const timeMinutes = timeToMinutes(checkinData.timeAvailable)
  lines.push(`Time Available: ${timeMinutes} minutes`)

  if (checkinData.workoutType) {
    lines.push(`Workout Type Requested: ${checkinData.workoutType}`)
  }

  if (checkinData.focusAreas && checkinData.focusAreas.length > 0) {
    lines.push(`Focus Areas: ${checkinData.focusAreas.join(', ')}`)
  }

  if (checkinData.notes) {
    lines.push(`Additional Notes: "${checkinData.notes}"`)
  }

  lines.push('=== END CHECK-IN ===')

  return lines.join('\n')
}

// Build recommendations based on check-in for workout adjustments
export function getCheckinRecommendations(checkinData: CheckinData): {
  intensityMultiplier: number
  shouldAvoidHighIntensity: boolean
  focusOnRecovery: boolean
  priorityAreas: string[]
  warnings: string[]
} {
  const warnings: string[] = []
  let intensityMultiplier = 1
  let shouldAvoidHighIntensity = false
  let focusOnRecovery = false

  // Low energy or poor sleep = reduce intensity
  if (checkinData.energyLevel <= 4) {
    intensityMultiplier *= 0.7
    warnings.push('Low energy today - reducing workout intensity')
  }

  if (checkinData.sleepQuality <= 4) {
    intensityMultiplier *= 0.8
    warnings.push('Poor sleep - prioritizing recovery movements')
    focusOnRecovery = true
  }

  // High stress = favor calming activities
  if (checkinData.stressLevel >= 4) {
    warnings.push('High stress - including breathwork and gentle movements')
    focusOnRecovery = true
  }

  // Pain considerations
  if (checkinData.painLevel !== undefined && checkinData.painLevel >= 5) {
    shouldAvoidHighIntensity = true
    intensityMultiplier *= 0.6
    warnings.push(`Elevated pain (${checkinData.painLevel}/10) - avoiding aggravating movements`)
  }

  // Mood considerations
  if (checkinData.mood === 'tired' || checkinData.mood === 'stressed') {
    intensityMultiplier *= 0.85
    focusOnRecovery = true
  }

  // User explicitly wants easy workout
  if (checkinData.workoutIntensity === 'easy' || checkinData.workoutIntensity === 'just-move') {
    shouldAvoidHighIntensity = true
  }

  // Priority areas to focus on
  const priorityAreas: string[] = []
  if (checkinData.focusAreas) {
    priorityAreas.push(...checkinData.focusAreas)
  }
  if (checkinData.painAreas && checkinData.painLevel !== undefined && checkinData.painLevel > 0) {
    // Add complementary areas (e.g., if lower back hurts, focus on core/hips)
    // Areas to avoid are handled separately
  }

  return {
    intensityMultiplier: Math.max(intensityMultiplier, 0.5),
    shouldAvoidHighIntensity,
    focusOnRecovery,
    priorityAreas,
    warnings,
  }
}
