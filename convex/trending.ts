import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { internalMutation, query } from './_generated/server'
import {
  getProfileByUserId,
  getProfileCards,
  isBlockedEitherWay,
} from './socialHelpers'

const TOP_LIMIT = 10
// Bounded scan of this week's tries; plenty until try volume is huge.
const MAX_TRIES_SCANNED = 2000

/** Monday 00:00 UTC of the week containing ts (matches streaks/insights). */
function startOfIsoWeek(ts: number): number {
  const d = new Date(ts)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.getTime()
}

/**
 * Cron: rank this week's most-tried public workouts into a single snapshot
 * document. The window is always the current ISO week, so the competition
 * resets naturally every Monday.
 */
export const refreshTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const weekStartMs = startOfIsoWeek(now)

    const tries = await ctx.db
      .query('post_tries')
      .withIndex('by_createdAt', (q) => q.gte('createdAt', weekStartMs))
      .take(MAX_TRIES_SCANNED)

    // Unique triers per post so one person spamming "try" can't game the
    // leaderboard.
    const triersByPost = new Map<string, Set<string>>()
    for (const row of tries) {
      const key = String(row.postId)
      const set = triersByPost.get(key) ?? new Set<string>()
      set.add(row.userId)
      triersByPost.set(key, set)
    }

    const candidates = Array.from(triersByPost.entries())
      .map(([postId, triers]) => ({ postId, count: triers.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_LIMIT * 3)

    const entries: {
      postId: Id<'posts'>
      rank: number
      title: string
      modality: string
      triedCount: number
      authorUserId: string
      authorUsername: string
      authorDisplayName: string
    }[] = []

    for (const candidate of candidates) {
      if (entries.length >= TOP_LIMIT) break
      const post = await ctx.db.get(candidate.postId as Id<'posts'>)
      if (!post || post.type !== 'workout' || !post.workout) continue
      if (post.visibility !== 'public') continue
      const author = await getProfileByUserId(ctx, post.authorId)
      if (!author || author.isPrivate) continue
      entries.push({
        postId: post._id,
        rank: entries.length + 1,
        title: post.workout.title,
        modality: post.workout.modality,
        triedCount: candidate.count,
        authorUserId: author.userId,
        authorUsername: author.username,
        authorDisplayName: author.displayName,
      })
    }

    const previous = await ctx.db.query('trending_snapshots').first()
    if (previous) {
      await ctx.db.delete(previous._id)
    }
    await ctx.db.insert('trending_snapshots', {
      weekStartMs,
      computedAt: now,
      entries,
    })
    return null
  },
})

const trendingEntryValidator = v.object({
  postId: v.id('posts'),
  rank: v.number(),
  title: v.string(),
  modality: v.string(),
  triedCount: v.number(),
  authorUserId: v.string(),
  authorUsername: v.string(),
  authorDisplayName: v.string(),
  authorAvatarUrl: v.union(v.string(), v.null()),
})

/** The week's top-10 most-tried workouts, personalized (blocked removed). */
export const getTrending = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      weekStartMs: v.number(),
      entries: v.array(trendingEntryValidator),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const snapshot = await ctx.db.query('trending_snapshots').first()
    if (!snapshot) return { weekStartMs: 0, entries: [] }

    const cards = await getProfileCards(
      ctx,
      snapshot.entries.map((e) => e.authorUserId)
    )

    const entries: {
      postId: Id<'posts'>
      rank: number
      title: string
      modality: string
      triedCount: number
      authorUserId: string
      authorUsername: string
      authorDisplayName: string
      authorAvatarUrl: string | null
    }[] = []
    for (const entry of snapshot.entries) {
      if (await isBlockedEitherWay(ctx, identity.subject, entry.authorUserId)) {
        continue
      }
      entries.push({
        ...entry,
        authorAvatarUrl: cards.get(entry.authorUserId)?.avatarUrl ?? null,
      })
    }

    return { weekStartMs: snapshot.weekStartMs, entries }
  },
})
