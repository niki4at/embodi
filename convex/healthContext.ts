import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'

/*
 * Private "Health & coaching context" hub. Composes everything the coach
 * knows about the user — onboarding health fields, AI profile answers, the
 * generated profile summary, and flare-up state — with focused edit
 * mutations so nothing requires replaying onboarding. All data here is
 * private to the owner and never exposed through public APIs.
 */

const answerValue = v.union(v.string(), v.number(), v.array(v.string()))

const healthAnswerValidator = v.object({
  _id: v.id('profile_answers'),
  questionId: v.string(),
  questionText: v.string(),
  category: v.string(),
  answerType: v.union(
    v.literal('slider'),
    v.literal('single'),
    v.literal('multi'),
    v.literal('text')
  ),
  answer: answerValue,
  updatedAt: v.number(),
})

export const getHealthContext = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      health: v.union(
        v.null(),
        v.object({
          goal: v.string(),
          activityLevel: v.union(v.string(), v.null()),
          injuries: v.array(v.string()),
          conditions: v.array(v.string()),
          medications: v.string(),
          smoking: v.union(v.string(), v.null()),
          alcohol: v.union(v.string(), v.null()),
          completedAt: v.number(),
        })
      ),
      coachSummary: v.union(
        v.null(),
        v.object({
          text: v.string(),
          updatedAt: v.number(),
        })
      ),
      answers: v.array(healthAnswerValidator),
      flareUp: v.object({
        active: v.boolean(),
        regions: v.array(v.string()),
        updatedAt: v.union(v.number(), v.null()),
      }),
      cycleTrackingEnabled: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = identity.subject

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const extended = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const flareRow = await ctx.db
      .query('flare_ups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    return {
      health: onboarding
        ? {
            goal: onboarding.goal,
            activityLevel: onboarding.activityLevel,
            injuries: onboarding.injuries,
            conditions: onboarding.conditions,
            medications: onboarding.medications,
            smoking: onboarding.smoking,
            alcohol: onboarding.alcohol,
            completedAt: onboarding.completedAt,
          }
        : null,
      coachSummary:
        extended?.profileSummary != null
          ? { text: extended.profileSummary, updatedAt: extended.updatedAt }
          : null,
      answers: answers
        .sort((a, b) => a.category.localeCompare(b.category))
        .map((row) => ({
          _id: row._id,
          questionId: row.questionId,
          questionText: row.questionText,
          category: row.category,
          answerType: row.answerType,
          answer: row.answer,
          updatedAt: row.updatedAt,
        })),
      flareUp: {
        active: flareRow?.active ?? false,
        regions: flareRow?.regions ?? [],
        updatedAt: flareRow?.updatedAt ?? null,
      },
      cycleTrackingEnabled: onboarding?.trackPeriod === true,
    }
  },
})

/**
 * Focused edits to onboarding health fields without replaying onboarding.
 * Only the provided fields change.
 */
export const updateHealthProfile = mutation({
  args: {
    injuries: v.optional(v.array(v.string())),
    conditions: v.optional(v.array(v.string())),
    medications: v.optional(v.string()),
    smoking: v.optional(
      v.union(v.literal('never'), v.literal('former'), v.literal('current'))
    ),
    alcohol: v.optional(
      v.union(
        v.literal('never'),
        v.literal('occasionally'),
        v.literal('regularly')
      )
    ),
    activityLevel: v.optional(
      v.union(
        v.literal('sedentary'),
        v.literal('light'),
        v.literal('moderate'),
        v.literal('active'),
        v.literal('very-active')
      )
    ),
    goal: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()
    if (!onboarding) {
      throw new Error('Complete onboarding before editing your health profile')
    }

    const patch: Partial<Doc<'onboarding'>> = {}
    if (args.injuries !== undefined) patch.injuries = args.injuries
    if (args.conditions !== undefined) patch.conditions = args.conditions
    if (args.medications !== undefined) patch.medications = args.medications
    if (args.smoking !== undefined) patch.smoking = args.smoking
    if (args.alcohol !== undefined) patch.alcohol = args.alcohol
    if (args.activityLevel !== undefined) {
      patch.activityLevel = args.activityLevel
    }
    if (args.goal !== undefined) patch.goal = args.goal

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(onboarding._id, patch)
    }
    return null
  },
})

/** Correct one AI-profile answer ("what your coach knows"). */
export const updateAnswer = mutation({
  args: {
    answerId: v.id('profile_answers'),
    answer: answerValue,
  },
  returns: v.null(),
  handler: async (ctx, { answerId, answer }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const row = await ctx.db.get(answerId)
    if (!row || row.userId !== identity.subject) {
      throw new Error('Answer not found')
    }

    await ctx.db.patch(answerId, { answer, updatedAt: Date.now() })
    return null
  },
})

/** Remove one AI-profile answer so the coach stops using it. */
export const deleteAnswer = mutation({
  args: { answerId: v.id('profile_answers') },
  returns: v.null(),
  handler: async (ctx, { answerId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const row = await ctx.db.get(answerId)
    if (!row || row.userId !== identity.subject) {
      throw new Error('Answer not found')
    }

    await ctx.db.delete(answerId)
    return null
  },
})
