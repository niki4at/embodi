import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'

/*
 * Synced user preferences: notification categories, units, and section-level
 * public visibility. A missing row means defaults, so reads never require a
 * prior write.
 */

export type UserSettings = {
  notifyBackers: boolean
  notifyReactions: boolean
  notifyCommunities: boolean
  units: 'metric' | 'imperial'
  publicActivity: boolean
  publicHeatmap: boolean
  publicAchievements: boolean
  publicChallenges: boolean
  publicRoutines: boolean
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifyBackers: true,
  notifyReactions: true,
  notifyCommunities: true,
  units: 'metric',
  // Broad progress is public by default; routines are share-per-routine
  // opt-in, so the section stays hidden until the user flips it.
  publicActivity: true,
  publicHeatmap: true,
  publicAchievements: true,
  publicChallenges: true,
  publicRoutines: false,
}

function toSettings(row: Doc<'user_settings'> | null): UserSettings {
  if (!row) return DEFAULT_SETTINGS
  return {
    notifyBackers: row.notifyBackers,
    notifyReactions: row.notifyReactions,
    notifyCommunities: row.notifyCommunities,
    units: row.units,
    publicActivity: row.publicActivity,
    publicHeatmap: row.publicHeatmap,
    publicAchievements: row.publicAchievements,
    publicChallenges: row.publicChallenges,
    publicRoutines: row.publicRoutines,
  }
}

export async function getSettingsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<UserSettings> {
  const row = await ctx.db
    .query('user_settings')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  return toSettings(row)
}

/** Which settings category gates a given notification type. */
export function notificationCategory(
  type: Doc<'notifications'>['type']
): keyof Pick<
  UserSettings,
  'notifyBackers' | 'notifyReactions' | 'notifyCommunities'
> {
  switch (type) {
    case 'new_backer':
    case 'back_request':
    case 'back_accepted':
      return 'notifyBackers'
    case 'cheer':
    case 'comment':
    case 'repost':
    case 'workout_tried':
      return 'notifyReactions'
    case 'community_invite':
    case 'community_milestone':
      return 'notifyCommunities'
    default: {
      const exhaustive: never = type
      return exhaustive
    }
  }
}

/** Whether the recipient wants notifications of this type. */
export async function shouldNotify(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  type: Doc<'notifications'>['type']
): Promise<boolean> {
  const settings = await getSettingsForUser(ctx, userId)
  return settings[notificationCategory(type)]
}

const settingsValidator = v.object({
  notifyBackers: v.boolean(),
  notifyReactions: v.boolean(),
  notifyCommunities: v.boolean(),
  units: v.union(v.literal('metric'), v.literal('imperial')),
  publicActivity: v.boolean(),
  publicHeatmap: v.boolean(),
  publicAchievements: v.boolean(),
  publicChallenges: v.boolean(),
  publicRoutines: v.boolean(),
})

export const get = query({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return DEFAULT_SETTINGS
    return await getSettingsForUser(ctx, identity.subject)
  },
})

export const update = mutation({
  args: {
    notifyBackers: v.optional(v.boolean()),
    notifyReactions: v.optional(v.boolean()),
    notifyCommunities: v.optional(v.boolean()),
    units: v.optional(v.union(v.literal('metric'), v.literal('imperial'))),
    publicActivity: v.optional(v.boolean()),
    publicHeatmap: v.optional(v.boolean()),
    publicAchievements: v.optional(v.boolean()),
    publicChallenges: v.optional(v.boolean()),
    publicRoutines: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const userId = identity.subject

    const row = await ctx.db
      .query('user_settings')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    const patch = Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined)
    )

    if (row) {
      await ctx.db.patch(row._id, { ...patch, updatedAt: Date.now() })
    } else {
      await ctx.db.insert('user_settings', {
        userId,
        ...DEFAULT_SETTINGS,
        ...patch,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})
