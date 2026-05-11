import { mutation } from './_generated/server'

/**
 * Permanently deletes every row owned by the calling user.
 *
 * Scoped strictly by `identity.subject`, so this only affects the caller's
 * account—other users' data stays untouched. The Clerk identity itself is
 * deleted on the client via `user.delete()` after this mutation succeeds.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (onboarding) {
      await ctx.db.delete(onboarding._id)
    }

    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of profileQuestions) {
      await ctx.db.delete(row._id)
    }

    const profileAnswers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of profileAnswers) {
      await ctx.db.delete(row._id)
    }

    const extendedProfile = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (extendedProfile) {
      await ctx.db.delete(extendedProfile._id)
    }

    const checkins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of checkins) {
      await ctx.db.delete(row._id)
    }

    const cycleEntries = await ctx.db
      .query('cycle_entries')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of cycleEntries) {
      await ctx.db.delete(row._id)
    }

    const sessions = await ctx.db
      .query('workout_sessions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const session of sessions) {
      const sets = await ctx.db
        .query('workout_sets')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const set of sets) {
        await ctx.db.delete(set._id)
      }

      const feedback = await ctx.db
        .query('session_feedback')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const fb of feedback) {
        await ctx.db.delete(fb._id)
      }

      await ctx.db.delete(session._id)
    }
  },
})
