import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  onboarding: defineTable({
    userId: v.string(),
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
    completedAt: v.number(),
  }).index('by_userId', ['userId']),
})



