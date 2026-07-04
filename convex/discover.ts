import { v } from 'convex/values'

import { internalMutation, query } from './_generated/server'
import { getFollowEdge, getProfileByUserId, isBlockedEitherWay, toProfileCard } from './socialHelpers'

const SUGGESTED_LIMIT = 12
const TRENDING_LIMIT = 8

/**
 * Daily cron: rank recently active public profiles and open communities into
 * a single snapshot document every client reads for free.
 */
export const computeDiscoverSnapshot = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Most recently created profiles first; a bounded window keeps the cron
    // cheap while still surfacing active people.
    const profiles = await ctx.db.query('profiles').order('desc').take(300)
    const suggested = profiles
      .filter((p) => !p.isPrivate)
      .sort(
        (a, b) =>
          b.postCount + b.backerCount - (a.postCount + a.backerCount)
      )
      .slice(0, SUGGESTED_LIMIT)
      .map((p) => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        backerCount: p.backerCount,
        postCount: p.postCount,
      }))

    const openCommunities = await ctx.db
      .query('communities')
      .withIndex('by_visibility', (q) => q.eq('visibility', 'open'))
      .take(200)
    const trending = openCommunities
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, TRENDING_LIMIT)
      .map((c) => ({
        communityId: c._id,
        name: c.name,
        goalLabel: c.goalLabel,
        memberCount: c.memberCount,
        eventDate: c.eventDate ?? null,
      }))

    const previous = await ctx.db.query('discover_snapshots').first()
    if (previous) {
      await ctx.db.delete(previous._id)
    }
    await ctx.db.insert('discover_snapshots', {
      computedAt: Date.now(),
      suggestedProfiles: suggested,
      trendingCommunities: trending,
    })
    return null
  },
})

/** Discover strip, personalized at read time (self/backed/blocked removed). */
export const getDiscover = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const snapshot = await ctx.db.query('discover_snapshots').first()
    if (!snapshot) return { suggestedProfiles: [], trendingCommunities: [] }

    const people: {
      userId: string
      username: string
      displayName: string
      avatarUrl: string | null
      backerCount: number
    }[] = []
    for (const suggestion of snapshot.suggestedProfiles) {
      if (people.length >= 6) break
      if (suggestion.userId === identity.subject) continue
      const edge = await getFollowEdge(ctx, identity.subject, suggestion.userId)
      if (edge) continue
      if (await isBlockedEitherWay(ctx, identity.subject, suggestion.userId)) {
        continue
      }
      const profile = await getProfileByUserId(ctx, suggestion.userId)
      if (!profile) continue
      const card = await toProfileCard(ctx, profile)
      people.push({
        userId: card.userId,
        username: card.username,
        displayName: card.displayName,
        avatarUrl: card.avatarUrl,
        backerCount: profile.backerCount,
      })
    }

    return {
      suggestedProfiles: people,
      trendingCommunities: snapshot.trendingCommunities,
    }
  },
})
