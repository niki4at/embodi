import { v } from 'convex/values'
import { labelForRegion } from '../constants/flare-regions'
import type { Doc } from './_generated/dataModel'
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'

const flareStateValidator = v.object({
  active: v.boolean(),
  regions: v.array(v.string()),
})

async function getFlareRowByUserId(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<Doc<'flare_ups'> | null> {
  return await ctx.db
    .query('flare_ups')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
}

// Read the current user's flare-up state. Returns a safe default when unset.
export const getFlareUp = query({
  args: {},
  returns: flareStateValidator,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { active: false, regions: [] }
    }

    const row = await getFlareRowByUserId(ctx, identity.subject)
    if (!row) {
      return { active: false, regions: [] }
    }

    return { active: row.active, regions: row.regions }
  },
})

// Upsert the current user's flare-up state. Turning it off clears the regions.
export const setFlareUp = mutation({
  args: {
    active: v.boolean(),
    regions: v.array(v.string()),
  },
  returns: flareStateValidator,
  handler: async (ctx, { active, regions }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const cleanedRegions = active ? regions : []
    const existing = await getFlareRowByUserId(ctx, identity.subject)

    if (existing) {
      await ctx.db.patch(existing._id, {
        active,
        regions: cleanedRegions,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('flare_ups', {
        userId: identity.subject,
        active,
        regions: cleanedRegions,
        updatedAt: Date.now(),
      })
    }

    return { active, regions: cleanedRegions }
  },
})

// Internal read for background session generation (trainer).
export const getFlareUpByUserId = internalQuery({
  args: { userId: v.string() },
  returns: v.union(flareStateValidator, v.null()),
  handler: async (ctx, { userId }) => {
    const row = await getFlareRowByUserId(ctx, userId)
    if (!row) {
      return null
    }
    return { active: row.active, regions: row.regions }
  },
})

// Format an active flare-up into an avoidance block for the trainer prompt.
export function formatFlareForPrompt(regions: string[]): string {
  if (regions.length === 0) {
    return ''
  }
  const labels = regions.map(labelForRegion).join(', ')
  return [
    'FLARE-UP MODE (ACTIVE):',
    `- The client has an ongoing flare-up in: ${labels}.`,
    '- Exclude or regress any movement that loads or aggravates these regions.',
    '- Prefer pain-free ranges of motion and gentle mobility for the affected areas.',
    '- This is a safety constraint and overrides focus-area bias when they conflict.',
  ].join('\n')
}
