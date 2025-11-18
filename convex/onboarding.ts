import { v } from 'convex/values'
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

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        ...args,
        completedAt: Date.now(),
      })
      return existing._id
    } else {
      // Create new record
      const id = await ctx.db.insert('onboarding', {
        userId: identity.subject,
        ...args,
        completedAt: Date.now(),
      })
      return id
    }
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

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()

    if (onboarding) {
      await ctx.db.delete(onboarding._id)
    }
  },
})

