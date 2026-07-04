import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Permanently deletes every row owned by the calling user.
 *
 * Scoped strictly by `identity.subject`, so this only affects the caller's
 * account—other users' data stays untouched. The Clerk identity itself is
 * deleted on the client via `user.delete()` after this mutation succeeds.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
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

    const routines = await ctx.db
      .query('workout_routines')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const routine of routines) {
      await ctx.db.delete(routine._id)
    }

    /* ---- Social data ---- */

    // My reactions on other people's posts (fix their counters first).
    const myReactions = await ctx.db
      .query('reactions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    for (const reaction of myReactions) {
      const post = await ctx.db.get(reaction.postId)
      if (post && post.authorId !== userId) {
        const counts = { ...post.cheerCounts }
        counts[reaction.kind] = Math.max(0, (counts[reaction.kind] ?? 0) - 1)
        if (counts[reaction.kind] === 0) delete counts[reaction.kind]
        await ctx.db.patch(post._id, { cheerCounts: counts })
      }
      await ctx.db.delete(reaction._id)
    }

    // My comments on other people's posts.
    const myComments = await ctx.db
      .query('comments')
      .withIndex('by_author', (q) => q.eq('authorId', userId))
      .collect()
    for (const comment of myComments) {
      const post = await ctx.db.get(comment.postId)
      if (post && post.authorId !== userId) {
        await ctx.db.patch(post._id, {
          commentCount: Math.max(0, post.commentCount - 1),
        })
      }
      await ctx.db.delete(comment._id)
    }

    // My posts, including their photos and remaining child rows.
    const myPosts = await ctx.db
      .query('posts')
      .withIndex('by_author_and_createdAt', (q) => q.eq('authorId', userId))
      .collect()
    for (const post of myPosts) {
      for (const storageId of post.photoStorageIds) {
        await ctx.storage.delete(storageId)
      }
      const postReactions = await ctx.db
        .query('reactions')
        .withIndex('by_post_and_user', (q) => q.eq('postId', post._id))
        .collect()
      for (const row of postReactions) {
        await ctx.db.delete(row._id)
      }
      const postComments = await ctx.db
        .query('comments')
        .withIndex('by_post', (q) => q.eq('postId', post._id))
        .collect()
      for (const row of postComments) {
        await ctx.db.delete(row._id)
      }
      if (post.type === 'repost' && post.originalPostId) {
        const original = await ctx.db.get(post.originalPostId)
        if (original) {
          await ctx.db.patch(original._id, {
            repostCount: Math.max(0, original.repostCount - 1),
          })
        }
      }
      await ctx.db.delete(post._id)
    }

    // Follow edges in both directions, fixing the other side's counters.
    const outgoing = await ctx.db
      .query('follows')
      .withIndex('by_follower_and_followee', (q) => q.eq('followerId', userId))
      .collect()
    for (const edge of outgoing) {
      if (edge.status === 'active') {
        const followee = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', edge.followeeId))
          .unique()
        if (followee) {
          await ctx.db.patch(followee._id, {
            backerCount: Math.max(0, followee.backerCount - 1),
          })
        }
      }
      await ctx.db.delete(edge._id)
    }
    const incoming = await ctx.db
      .query('follows')
      .withIndex('by_followee_and_status', (q) => q.eq('followeeId', userId))
      .collect()
    for (const edge of incoming) {
      if (edge.status === 'active') {
        const follower = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', edge.followerId))
          .unique()
        if (follower) {
          await ctx.db.patch(follower._id, {
            backingCount: Math.max(0, follower.backingCount - 1),
          })
        }
      }
      await ctx.db.delete(edge._id)
    }

    // Community memberships (transfer ownership or clean up empty groups).
    const memberships = await ctx.db
      .query('community_members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    for (const membership of memberships) {
      const community = await ctx.db.get(membership.communityId)
      await ctx.db.delete(membership._id)
      if (!community) continue
      const remaining = await ctx.db
        .query('community_members')
        .withIndex('by_community', (q) =>
          q.eq('communityId', membership.communityId)
        )
        .take(2)
      if (remaining.length === 0) {
        const events = await ctx.db
          .query('community_events')
          .withIndex('by_community_and_createdAt', (q) =>
            q.eq('communityId', membership.communityId)
          )
          .collect()
        for (const event of events) {
          await ctx.db.delete(event._id)
        }
        await ctx.db.delete(community._id)
      } else {
        if (membership.role === 'owner') {
          await ctx.db.patch(remaining[0]._id, { role: 'owner' })
          await ctx.db.patch(community._id, {
            creatorId: remaining[0].userId,
          })
        }
        await ctx.db.patch(community._id, {
          memberCount: Math.max(0, community.memberCount - 1),
          updatedAt: Date.now(),
        })
      }
    }

    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_createdAt', (q) => q.eq('userId', userId))
      .collect()
    for (const row of notifications) {
      await ctx.db.delete(row._id)
    }

    const pushTokens = await ctx.db
      .query('push_tokens')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of pushTokens) {
      await ctx.db.delete(row._id)
    }

    const myBlocks = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) => q.eq('blockerId', userId))
      .collect()
    for (const row of myBlocks) {
      await ctx.db.delete(row._id)
    }
    const blocksOfMe = await ctx.db
      .query('blocks')
      .withIndex('by_blocked', (q) => q.eq('blockedId', userId))
      .collect()
    for (const row of blocksOfMe) {
      await ctx.db.delete(row._id)
    }

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (profile) {
      if (profile.avatarStorageId) {
        await ctx.storage.delete(profile.avatarStorageId)
      }
      await ctx.db.delete(profile._id)
    }

    return null
  },
})
