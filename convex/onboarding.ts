import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'

export const saveOnboarding = mutation({
  args: {
    name: v.string(),
    age: v.string(),
    gender: v.union(
      v.literal('male'),
      v.literal('female'),
      v.literal('prefer-not-to-say'),
      v.null()
    ),
    goal: v.string(),
    activityLevel: v.union(
      v.literal('sedentary'),
      v.literal('light'),
      v.literal('moderate'),
      v.literal('active'),
      v.literal('very-active'),
      v.null()
    ),
    timeAvailable: v.array(v.string()),
    injuries: v.array(v.string()),
    conditions: v.array(v.string()),
    medications: v.string(),
    smoking: v.union(
      v.literal('never'),
      v.literal('former'),
      v.literal('current'),
      v.null()
    ),
    alcohol: v.union(
      v.literal('never'),
      v.literal('occasionally'),
      v.literal('regularly'),
      v.null()
    ),
    trackPeriod: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    // Check if user already has onboarding data
    const existing = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()

    let onboardingId
    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        ...args,
        completedAt: Date.now(),
      })
      onboardingId = existing._id
    } else {
      // Create new record
      onboardingId = await ctx.db.insert('onboarding', {
        userId: identity.subject,
        ...args,
        completedAt: Date.now(),
      })
    }

    // Trigger AI profile question generation asynchronously
    // This runs in the background so the user sees the home screen immediately
    // We pass the userId and onboarding data since scheduled actions don't have auth context
    await ctx.scheduler.runAfter(
      0,
      internal.profileQuestions.generateProfileQuestionsForUser,
      {
        userId: identity.subject,
        onboardingData: {
          name: args.name,
          age: args.age,
          gender: args.gender,
          goal: args.goal,
          activityLevel: args.activityLevel,
          timeAvailable: args.timeAvailable,
          injuries: args.injuries,
          conditions: args.conditions,
          medications: args.medications,
          smoking: args.smoking,
          alcohol: args.alcohol,
        },
      }
    )

    return onboardingId
  },
})

export const getOnboarding = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()

    return onboarding
  },
})

export const hasCompletedOnboarding = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return false
    }

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()

    return onboarding !== null
  },
})

export const deleteOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    // Delete onboarding data
    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (onboarding) {
      await ctx.db.delete(onboarding._id)
    }

    // Delete profile questions
    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (profileQuestions) {
      await ctx.db.delete(profileQuestions._id)
    }

    // Delete extended profile
    const extendedProfile = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (extendedProfile) {
      await ctx.db.delete(extendedProfile._id)
    }

    // Delete all workout sessions and their related data
    const workoutSessions = await ctx.db
      .query('workout_sessions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    for (const session of workoutSessions) {
      // Delete workout sets for this session
      const sets = await ctx.db
        .query('workout_sets')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const set of sets) {
        await ctx.db.delete(set._id)
      }

      // Delete session feedback
      const feedback = await ctx.db
        .query('session_feedback')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const fb of feedback) {
        await ctx.db.delete(fb._id)
      }

      // Delete the session itself
      await ctx.db.delete(session._id)
    }
  },
})
