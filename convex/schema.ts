import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const citationRef = v.object({
  id: v.string(),
  title: v.string(),
  authors: v.array(v.string()),
  year: v.number(),
  source: v.string(),
  url: v.string(),
  doi: v.optional(v.string()),
  summary: v.optional(v.string()),
})

const factShape = v.object({
  text: v.string(),
  citations: v.array(citationRef),
})

const exerciseShape = v.object({
  id: v.string(),
  name: v.string(),
  bodyPart: v.string(),
  modality: v.string(),
  instructions: v.string(),
  equipment: v.array(v.string()),
  targetSets: v.number(),
  targetReps: v.union(v.number(), v.array(v.number())),
  tempo: v.string(),
  restSec: v.number(),
  durationMin: v.optional(v.number()),
  intensityCue: v.optional(v.string()),
  contraindications: v.optional(v.array(v.string())),
  cues: v.array(v.string()),
  trackingMetric: v.union(
    v.literal('weight_reps'),
    v.literal('duration'),
    v.literal('distance'),
    v.literal('breath'),
    v.literal('custom')
  ),
})

// Profile question shape for AI-generated personalized questions
const profileQuestionShape = v.object({
  id: v.string(),
  category: v.string(),
  questionText: v.string(),
  answerType: v.union(
    v.literal('slider'),
    v.literal('single'),
    v.literal('multi'),
    v.literal('text')
  ),
  options: v.optional(v.array(v.string())),
  sliderMin: v.optional(v.number()),
  sliderMax: v.optional(v.number()),
  sliderLabels: v.optional(v.array(v.string())),
  // Note: answers are stored separately in profile_answers table
})

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

  workout_sessions: defineTable({
    userId: v.string(),
    goal: v.string(),
    modality: v.string(),
    durationMin: v.number(),
    status: v.union(
      v.literal('generating'),
      v.literal('generated'),
      v.literal('in-progress'),
      v.literal('completed'),
      v.literal('failed')
    ),
    plan: v.array(exerciseShape),
    healthFacts: v.array(factShape),
    citations: v.array(citationRef),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_user_status', ['userId', 'status']),

  workout_sets: defineTable({
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    setIndex: v.number(),
    weightKg: v.optional(v.number()),
    reps: v.optional(v.number()),
    rpe: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    distanceM: v.optional(v.number()),
    notes: v.optional(v.string()),
    completedAt: v.number(),
  }).index('by_sessionId', ['sessionId']),

  session_feedback: defineTable({
    sessionId: v.id('workout_sessions'),
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index('by_sessionId', ['sessionId']),

  // AI-generated personalized profile questions
  profile_questions: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal('generating'),
      v.literal('ready'),
      v.literal('completed'),
      v.literal('failed')
    ),
    questions: v.array(profileQuestionShape),
    answeredCount: v.number(),
    totalCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  // Individual answers linked to profile questions
  profile_answers: defineTable({
    userId: v.string(),
    questionId: v.string(), // References the question.id from profile_questions
    questionText: v.string(), // Store question text for easy querying
    category: v.string(), // e.g., "Pain Assessment", "Goals", "Lifestyle"
    answerType: v.union(
      v.literal('slider'),
      v.literal('single'),
      v.literal('multi'),
      v.literal('text')
    ),
    answer: v.union(v.string(), v.number(), v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_questionId', ['userId', 'questionId'])
    .index('by_userId_category', ['userId', 'category']),

  // Extended profile summary (AI-generated comprehensive summary)
  extended_profile: defineTable({
    userId: v.string(),
    // AI-generated comprehensive profile summary containing all user information
    profileSummary: v.optional(v.string()),
    // Summary flags for quick access
    hasPainAssessment: v.optional(v.boolean()),
    hasRedFlags: v.optional(v.boolean()),
    completedCategories: v.optional(v.array(v.string())),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  // Daily check-ins before workout sessions
  daily_checkins: defineTable({
    userId: v.string(),
    // Core wellness metrics
    energyLevel: v.number(), // 1-10
    sleepQuality: v.number(), // 1-10
    stressLevel: v.number(), // 1-5
    // Pain assessment (if user has known injuries/conditions)
    painLevel: v.optional(v.number()), // 0-10
    painAreas: v.optional(v.array(v.string())), // Which areas are bothering them today
    // Workout preferences for today
    workoutIntensity: v.union(
      v.literal('push-hard'),
      v.literal('moderate'),
      v.literal('easy'),
      v.literal('just-move')
    ),
    timeAvailable: v.union(
      v.literal('15-min'),
      v.literal('30-min'),
      v.literal('45-min'),
      v.literal('60-min')
    ),
    focusAreas: v.optional(v.array(v.string())), // Optional: specific areas to target
    workoutType: v.optional(
      v.union(
        v.literal('strength'),
        v.literal('cardio'),
        v.literal('mobility'),
        v.literal('recovery'),
        v.literal('mixed')
      )
    ),
    // Free-form notes
    notes: v.optional(v.string()),
    // Mood indicator
    mood: v.optional(
      v.union(
        v.literal('great'),
        v.literal('good'),
        v.literal('okay'),
        v.literal('tired'),
        v.literal('stressed')
      )
    ),
    // Timestamps
    createdAt: v.number(),
    // Link to the session created from this check-in
    sessionId: v.optional(v.id('workout_sessions')),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_date', ['userId', 'createdAt']),
})
