import { v } from 'convex/values'

export const workPosition = v.union(
  v.literal('sitting'),
  v.literal('standing'),
  v.literal('mixed'),
  v.literal('on_feet')
)

export const deskTroubleSpot = v.union(
  v.literal('neck'),
  v.literal('shoulders'),
  v.literal('lower_back'),
  v.literal('wrists'),
  v.literal('hips'),
  v.literal('eyes')
)

export const workStyle = v.object({
  position: v.optional(workPosition),
  deskHoursPerDay: v.optional(v.number()),
  troubleSpots: v.optional(v.array(deskTroubleSpot)),
})
