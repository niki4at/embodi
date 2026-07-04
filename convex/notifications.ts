import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import {
  internalAction,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { getProfileCards, requireIdentity } from './socialHelpers'

/** Inbox, newest first, with actor profile cards resolved for rendering. */
export const listNotifications = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { page: [], isDone: true, continueCursor: '' }
    }

    const result = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_createdAt', (q) =>
        q.eq('userId', identity.subject)
      )
      .order('desc')
      .paginate(paginationOpts)

    const cards = await getProfileCards(
      ctx,
      result.page.map((n) => n.actorId)
    )
    return {
      ...result,
      page: result.page.map((n) => ({
        _id: n._id,
        type: n.type,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
        postId: n.postId ?? null,
        communityId: n.communityId ?? null,
        actor: cards.get(n.actorId) ?? null,
      })),
    }
  },
})

/** Reactive badge count. Capped read so a flooded inbox stays cheap. */
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return 0
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_read', (q) =>
        q.eq('userId', identity.subject).eq('read', false)
      )
      .take(100)
    return unread.length
  },
})

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    // Bounded batch: repeat-call semantics keep each transaction small.
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_read', (q) =>
        q.eq('userId', identity.subject).eq('read', false)
      )
      .take(200)
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true })
    }
    return null
  },
})

export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android'), v.literal('web')),
  },
  returns: v.null(),
  handler: async (ctx, { token, platform }) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('push_tokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique()
    const now = Date.now()
    if (existing) {
      // Device may have changed hands between accounts.
      await ctx.db.patch(existing._id, {
        userId: identity.subject,
        platform,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('push_tokens', {
        userId: identity.subject,
        token,
        platform,
        updatedAt: now,
      })
    }
    return null
  },
})

export const getPushTokensForUser = internalQuery({
  args: { userId: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, { userId }) => {
    const tokens = await ctx.db
      .query('push_tokens')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(10)
    return tokens.map((t) => t.token)
  },
})

/**
 * Fire-and-forget push delivery through the Expo Push API. Failures log and
 * drop; the in-app inbox is the source of truth.
 */
export const sendPush = internalAction({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    type: v.string(),
    postId: v.optional(v.string()),
    communityId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokens: string[] = await ctx.runQuery(
      internal.notifications.getPushTokensForUser,
      { userId: args.userId }
    )
    if (tokens.length === 0) return null

    const messages = tokens.map((token) => ({
      to: token,
      title: args.title,
      body: args.body,
      sound: 'default',
      data: {
        type: args.type,
        postId: args.postId ?? null,
        communityId: args.communityId ?? null,
      },
    }))

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })
      if (!response.ok) {
        console.error('Expo push send failed', await response.text())
      }
    } catch (error) {
      console.error('Expo push send error', error)
    }
    return null
  },
})
