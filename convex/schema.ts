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
  // Stable catalog/custom identifier (e.g. 'chest-barbell-bench' or
  // 'custom-<id>') carried across sessions so per-exercise history and
  // records can be matched even though `id` is regenerated per session.
  catalogId: v.optional(v.string()),
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
  // Soft-skip: keeps the exercise in the plan but excludes it from the
  // sets-completed math and collapses its card. Restorable by the user.
  skipped: v.optional(v.boolean()),
})

const trainingEnvironment = v.union(
  v.literal('home'),
  v.literal('gym'),
  v.literal('outdoors'),
  v.literal('travel')
)

// Snapshot of a completed workout copied onto a post at share time so feed
// reads never join back to sessions/sets.
const postWorkoutShape = v.object({
  title: v.string(),
  modality: v.string(),
  trainingEnvironment: v.optional(trainingEnvironment),
  durationMin: v.union(v.number(), v.null()),
  totalVolumeKg: v.number(),
  totalReps: v.number(),
  totalDistanceM: v.number(),
  exercisesCompleted: v.number(),
  workingSets: v.number(),
  avgRpe: v.union(v.number(), v.null()),
  bodyParts: v.array(v.string()),
  highlights: v.array(
    v.object({
      exerciseName: v.string(),
      kind: v.string(),
      value: v.number(),
      unit: v.string(),
      isFirstTime: v.boolean(),
    })
  ),
  dateMs: v.number(),
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

const equipmentIntent = v.union(
  v.literal('available'),
  v.literal('bodyweight'),
  v.literal('treadmill')
)

const contextSuggestionSource = v.union(
  v.literal('manual'),
  v.literal('place'),
  v.literal('workout_need'),
  v.literal('weekly_rhythm'),
  v.literal('history'),
  v.literal('fallback')
)

const trainingContextSelection = v.object({
  trainingEnvironment,
  equipmentIntent,
})

const equipmentCapabilities = v.object({
  weightMinKg: v.optional(v.number()),
  weightMaxKg: v.optional(v.number()),
  adjustable: v.optional(v.boolean()),
  incline: v.optional(v.boolean()),
  speedControl: v.optional(v.boolean()),
  resistanceLevels: v.optional(v.number()),
  quantity: v.optional(v.number()),
  resistance: v.optional(v.string()),
  dimensions: v.optional(v.string()),
})

const equipmentSnapshotItem = v.object({
  catalogKey: v.string(),
  label: v.string(),
  details: v.optional(v.string()),
  capabilities: v.optional(equipmentCapabilities),
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
      v.literal('discarded'),
      v.literal('failed')
    ),
    plan: v.array(exerciseShape),
    healthFacts: v.array(factShape),
    citations: v.array(citationRef),
    // Where the session came from: 'custom' (hand-picked in the builder) skips
    // the "Your session is ready" screen; 'coach' is the AI-generated flow.
    source: v.optional(v.union(v.literal('custom'), v.literal('coach'))),
    // Link to pre-session check-in (if user checked in before starting)
    checkinId: v.optional(v.id('daily_checkins')),
    // Captured when the session was started from a weekly recommendation card
    recommendationSeed: v.optional(
      v.object({
        title: v.string(),
        modality: v.string(),
        durationMin: v.number(),
        moveCount: v.number(),
        description: v.string(),
        reasoning: v.string(),
        tags: v.array(v.string()),
        source: v.union(v.literal('aligned'), v.literal('exploration')),
      })
    ),
    trainingEnvironment: v.optional(trainingEnvironment),
    equipmentIntent: v.optional(equipmentIntent),
    contextTags: v.optional(v.array(v.string())),
    suggestionSource: v.optional(contextSuggestionSource),
    suggestionReason: v.optional(v.string()),
    equipmentSnapshot: v.optional(v.array(equipmentSnapshotItem)),
    unavailableEquipment: v.optional(v.array(v.string())),
    // Wall-clock anchors for the overall workout timer. startedAt is stamped
    // once when the user first opens the live session screen; completedAt when
    // the session is completed. Actual duration = completedAt - startedAt.
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
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
    // Warm-up sets prime the body but don't count toward working volume or
    // personal records. Absent/false means a normal working set.
    isWarmup: v.optional(v.boolean()),
    // Richer set classification. 'warmup' mirrors isWarmup; 'failure' and
    // 'drop' are working sets with a distinct training intent. Absent means
    // a normal working set.
    setType: v.optional(
      v.union(
        v.literal('warmup'),
        v.literal('normal'),
        v.literal('failure'),
        v.literal('drop')
      )
    ),
    completedAt: v.number(),
  }).index('by_sessionId', ['sessionId']),

  session_feedback: defineTable({
    sessionId: v.id('workout_sessions'),
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index('by_sessionId', ['sessionId']),

  // Saved workouts the user can run again. The plan is a snapshot of a
  // session's exercises; each exercise `id` is regenerated when a routine is
  // started so live sets stay unique per session.
  workout_routines: defineTable({
    userId: v.string(),
    name: v.string(),
    goal: v.string(),
    modality: v.string(),
    durationMin: v.number(),
    plan: v.array(exerciseShape),
    // Which session this routine was saved from (for provenance).
    sourceSessionId: v.optional(v.id('workout_sessions')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

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

  // AI-generated personalized weekly stats & recommendations
  weekly_insights: defineTable({
    userId: v.string(),
    // Start of the ISO week (Monday 00:00 user local approximation, ms)
    weekStart: v.number(),
    status: v.union(
      v.literal('generating'),
      v.literal('ready'),
      v.literal('failed')
    ),
    // How this insight was produced
    source: v.union(
      v.literal('batch'),
      v.literal('on_demand'),
      v.literal('cold_start'),
      v.literal('after_workout')
    ),
    // Hash of the input data so we can tell if user data changed since generation
    dataSignature: v.string(),
    // Headline message for the week (1-2 sentences)
    headline: v.optional(v.string()),
    // Stats grid: 4 personalized cards picked from a wider menu by the model
    stats: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        value: v.string(),
        unit: v.string(),
        icon: v.string(),
        tint: v.string(),
        // Optional one-line story explaining why this stat is interesting
        story: v.optional(v.string()),
        // Optional trend indicator: 'up' | 'down' | 'flat'
        trend: v.optional(v.string()),
      })
    ),
    // Recommendations aligned with what the user already does/likes
    alignedRecommendations: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        durationMin: v.number(),
        moveCount: v.number(),
        modality: v.string(),
        badge: v.string(),
        badgeTint: v.string(),
        description: v.string(),
        tags: v.array(v.string()),
        reasoning: v.string(),
      })
    ),
    // Recommendations the user hasn't tried but the model thinks would help
    explorationRecommendations: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        durationMin: v.number(),
        moveCount: v.number(),
        modality: v.string(),
        badge: v.string(),
        badgeTint: v.string(),
        description: v.string(),
        tags: v.array(v.string()),
        reasoning: v.string(),
        whyNew: v.string(),
      })
    ),
    // Optional error message when status === 'failed'
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_weekStart', ['userId', 'weekStart'])
    .index('by_status', ['status']),

  // User feedback on a generated weekly insight
  weekly_insight_feedback: defineTable({
    userId: v.string(),
    insightId: v.id('weekly_insights'),
    weekStart: v.number(),
    rating: v.union(v.literal('liked'), v.literal('disliked')),
    // Optional free-text comment
    comment: v.optional(v.string()),
    // Which sections the user reacted to (stats, aligned, exploration, headline)
    sections: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_insightId', ['insightId'])
    .index('by_userId_weekStart', ['userId', 'weekStart']),

  // Tracks pending OpenAI Batch API jobs for weekly insight generation
  openai_batch_jobs: defineTable({
    purpose: v.string(),
    openaiBatchId: v.string(),
    inputFileId: v.string(),
    status: v.union(
      v.literal('validating'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('expired'),
      v.literal('cancelled'),
      v.literal('processed')
    ),
    weekStart: v.number(),
    // Map of custom_id -> { userId, insightId } so we can route results
    routing: v.array(
      v.object({
        customId: v.string(),
        userId: v.string(),
        insightId: v.id('weekly_insights'),
      })
    ),
    requestedCount: v.number(),
    completedCount: v.optional(v.number()),
    failedCount: v.optional(v.number()),
    outputFileId: v.optional(v.string()),
    errorFileId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_openaiBatchId', ['openaiBatchId']),

  // Menstrual cycle entries for users who opted in via onboarding.
  // One entry per cycle (period). startDate is captured at log time;
  // endDate is patched in when the user marks the period over.
  cycle_entries: defineTable({
    userId: v.string(),
    startDate: v.number(), // ms, normalized to local midnight
    endDate: v.optional(v.number()),
    flow: v.optional(
      v.union(v.literal('light'), v.literal('medium'), v.literal('heavy'))
    ),
    symptoms: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_startDate', ['userId', 'startDate']),

  // User-defined goals (run a marathon, lose weight, swim regularly, etc.).
  // Each challenge gets an AI-generated multi-week program and feeds the
  // active goal into the daily coach.
  challenges: defineTable({
    userId: v.string(),
    title: v.string(),
    category: v.union(
      v.literal('endurance'),
      v.literal('weight_loss'),
      v.literal('weight_gain'),
      v.literal('strength'),
      v.literal('habit'),
      v.literal('custom')
    ),
    description: v.string(),
    metric: v.object({
      kind: v.union(
        v.literal('body_weight'),
        v.literal('distance'),
        v.literal('frequency'),
        v.literal('duration'),
        v.literal('custom')
      ),
      unit: v.string(),
      startValue: v.optional(v.number()),
      targetValue: v.optional(v.number()),
      direction: v.union(
        v.literal('increase'),
        v.literal('decrease'),
        v.literal('maintain')
      ),
    }),
    targetDate: v.optional(v.number()),
    status: v.union(
      v.literal('generating'),
      v.literal('active'),
      v.literal('completed'),
      v.literal('archived'),
      v.literal('failed')
    ),
    program: v.optional(
      v.object({
        overview: v.string(),
        weeklySessions: v.number(),
        weeks: v.array(
          v.object({
            weekNumber: v.number(),
            focus: v.string(),
            summary: v.string(),
            target: v.string(),
          })
        ),
      })
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_user_status', ['userId', 'status']),

  // Progress entries for a challenge. Manual entries come from the user;
  // 'session' entries are derived from completed workouts.
  challenge_progress: defineTable({
    userId: v.string(),
    challengeId: v.id('challenges'),
    value: v.number(),
    unit: v.string(),
    note: v.optional(v.string()),
    source: v.union(v.literal('manual'), v.literal('session')),
    sessionId: v.optional(v.id('workout_sessions')),
    recordedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_challenge', ['challengeId']),

  // Cached media + rich how-to for catalog exercises, synced once from the
  // WorkoutX exercise API. GIFs are re-hosted in Convex file storage so the
  // app reads stable URLs without spending the external API request budget.
  exercise_media: defineTable({
    catalogId: v.string(),
    source: v.string(), // 'workoutx'
    gifStorageId: v.optional(v.id('_storage')),
    externalGifUrl: v.optional(v.string()),
    target: v.optional(v.string()),
    secondaryMuscles: v.array(v.string()),
    instructions: v.array(v.string()),
    difficulty: v.optional(v.string()),
    attribution: v.string(),
    matchedName: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_catalogId', ['catalogId']),

  // Per-scope coach conversation threads. Today the only scope is a single
  // exercise (scopeType 'exercise' + catalogId), but the shape leaves room
  // for session- or goal-scoped threads later.
  coach_threads: defineTable({
    userId: v.string(),
    scopeType: v.string(), // 'exercise'
    catalogId: v.string(),
    // OpenAI Responses API id of the last assistant turn, used to chain
    // multi-turn context server-side without resending the whole history.
    lastResponseId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user_scope', ['userId', 'scopeType', 'catalogId']),

  coach_messages: defineTable({
    threadId: v.id('coach_threads'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    createdAt: v.number(),
  }).index('by_thread', ['threadId']),

  // User-defined custom exercises. These show up in the exercise picker
  // alongside the built-in catalog so a user can reuse their own movements.
  custom_exercises: defineTable({
    userId: v.string(),
    name: v.string(),
    group: v.string(),
    bodyPart: v.string(),
    modality: v.string(),
    equipment: v.array(v.string()),
    iconName: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  // One stable row per user. Weekly schedule is capped at seven weekdays by
  // trainingPreferences.ts so this document stays small.
  training_preferences: defineTable({
    userId: v.string(),
    weeklySchedule: v.array(
      v.object({
        weekday: v.union(
          v.literal('monday'),
          v.literal('tuesday'),
          v.literal('wednesday'),
          v.literal('thursday'),
          v.literal('friday'),
          v.literal('saturday'),
          v.literal('sunday')
        ),
        morning: v.optional(trainingContextSelection),
        evening: v.optional(trainingContextSelection),
      })
    ),
    locationEnabled: v.boolean(),
    sharingDefault: v.union(
      v.literal('private'),
      v.literal('backers'),
      v.literal('public')
    ),
    shareGenericLocation: v.optional(v.boolean()),
    defaultContext: trainingContextSelection,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  user_equipment: defineTable({
    userId: v.string(),
    catalogKey: v.string(),
    label: v.string(),
    details: v.optional(v.string()),
    capabilities: v.optional(equipmentCapabilities),
    photoStorageId: v.optional(v.id('_storage')),
    isArchived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_isArchived', ['userId', 'isArchived']),

  equipment_photo_uploads: defineTable({
    userId: v.string(),
    storageId: v.id('_storage'),
    status: v.union(v.literal('pending'), v.literal('attached')),
    equipmentId: v.optional(v.id('user_equipment')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_storageId', ['storageId']),

  // Coordinates are AES-GCM ciphertext. Only the owner-facing Node action
  // decrypts them; generic events and sessions store context labels only.
  training_places: defineTable({
    userId: v.string(),
    label: v.string(),
    trainingEnvironment,
    equipmentIntent: v.optional(equipmentIntent),
    radiusM: v.number(),
    encryptedCoordinates: v.string(),
    encryptionIv: v.string(),
    encryptionAuthTag: v.string(),
    encryptionKeyVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  // Bounded history used by the deterministic context scorer. Writers cap
  // retained rows per user and never accept or persist coordinates.
  training_context_events: defineTable({
    userId: v.string(),
    trainingEnvironment,
    equipmentIntent,
    contextTags: v.array(v.string()),
    workoutType: v.optional(v.string()),
    goal: v.optional(v.string()),
    localWeekday: v.optional(
      v.union(
        v.literal('monday'),
        v.literal('tuesday'),
        v.literal('wednesday'),
        v.literal('thursday'),
        v.literal('friday'),
        v.literal('saturday'),
        v.literal('sunday')
      )
    ),
    timeOfDay: v.optional(
      v.union(v.literal('morning'), v.literal('evening'))
    ),
    suggestionSource: contextSuggestionSource,
    suggestionReason: v.string(),
    equipmentKeys: v.array(v.string()),
    createdAt: v.number(),
  }).index('by_userId_and_createdAt', ['userId', 'createdAt']),

  // Daily check-ins for pre-session state capture
  daily_checkins: defineTable({
    userId: v.string(),
    // Physical state
    energyLevel: v.number(), // 1-10
    sleepQuality: v.union(
      v.literal('rough'),
      v.literal('okay'),
      v.literal('decent'),
      v.literal('great')
    ),
    painLevel: v.number(), // 0-10
    painAreas: v.optional(v.array(v.string())), // body areas if pain > 3
    stressLevel: v.number(), // 1-5
    // Session preferences
    workoutType: v.union(
      v.literal('strength'),
      v.literal('mobility'),
      v.literal('cardio'),
      v.literal('recovery'),
      v.literal('mixed')
    ),
    // Body areas the user wants to focus on (e.g. legs, arms, back)
    focusAreas: v.optional(v.array(v.string())),
    intensityPreference: v.union(
      v.literal('easy'),
      v.literal('moderate'),
      v.literal('challenging')
    ),
    timeAvailable: v.union(
      v.literal('15'),
      v.literal('30'),
      v.literal('45'),
      v.literal('60')
    ),
    trainingEnvironment: v.optional(trainingEnvironment),
    equipmentIntent: v.optional(equipmentIntent),
    contextTags: v.optional(v.array(v.string())),
    suggestionSource: v.optional(contextSuggestionSource),
    suggestionReason: v.optional(v.string()),
    equipmentSnapshot: v.optional(v.array(equipmentSnapshotItem)),
    unavailableEquipment: v.optional(v.array(v.string())),
    // Optional notes
    notes: v.optional(v.string()),
    // Link to the generated session
    sessionId: v.optional(v.id('workout_sessions')),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_date', ['userId', 'createdAt']),

  // Persistent flare-up mode: one row per user. When active, the trainer eases
  // sessions off the flagged regions until the user turns it off.
  flare_ups: defineTable({
    userId: v.string(),
    active: v.boolean(),
    regions: v.array(v.string()), // region ids, e.g. 'lower-back', 'hips'
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  /* ==========================================================================
   * SOCIAL — public identity, follows ("backing"), workout posts, communities.
   * Counts are denormalized onto parent docs and patched in the same mutation
   * as the child write so feed/profile reads never count rows.
   * ==========================================================================
   */

  // Public-facing identity. Username is stored lowercase and unique;
  // searchText mirrors "username displayName" for the people search index.
  profiles: defineTable({
    userId: v.string(),
    username: v.string(),
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
    isPrivate: v.boolean(),
    backerCount: v.number(),
    backingCount: v.number(),
    postCount: v.number(),
    searchText: v.string(),
    usernameUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_username', ['username'])
    .searchIndex('search_people', { searchField: 'searchText' }),

  // One-way social graph. 'pending' rows are requests to private accounts.
  follows: defineTable({
    followerId: v.string(),
    followeeId: v.string(),
    status: v.union(v.literal('active'), v.literal('pending')),
    createdAt: v.number(),
  })
    .index('by_follower_and_followee', ['followerId', 'followeeId'])
    .index('by_follower_and_status', ['followerId', 'status'])
    .index('by_followee_and_status', ['followeeId', 'status']),

  // Blocks hide content in both directions and sever any follow edges.
  blocks: defineTable({
    blockerId: v.string(),
    blockedId: v.string(),
    createdAt: v.number(),
  })
    .index('by_blocker_and_blocked', ['blockerId', 'blockedId'])
    .index('by_blocked', ['blockedId']),

  // User-generated-content reports (App Store requirement).
  reports: defineTable({
    reporterId: v.string(),
    targetType: v.union(
      v.literal('post'),
      v.literal('comment'),
      v.literal('profile'),
      v.literal('community')
    ),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
    status: v.union(v.literal('open'), v.literal('resolved')),
    createdAt: v.number(),
  }).index('by_status', ['status']),

  // Feed posts. Workout posts snapshot recap stats; reposts point at the
  // original with an optional quote. Cheer counts are denormalized per kind.
  posts: defineTable({
    authorId: v.string(),
    type: v.union(v.literal('workout'), v.literal('repost')),
    sessionId: v.optional(v.id('workout_sessions')),
    workout: v.optional(postWorkoutShape),
    caption: v.optional(v.string()),
    photoStorageIds: v.array(v.id('_storage')),
    visibility: v.union(v.literal('public'), v.literal('backers')),
    // Spotify placeholder — populated once the integration ships.
    tracks: v.optional(
      v.array(
        v.object({
          name: v.string(),
          artist: v.string(),
          uri: v.optional(v.string()),
        })
      )
    ),
    originalPostId: v.optional(v.id('posts')),
    communityId: v.optional(v.id('communities')),
    cheerCounts: v.record(v.string(), v.number()),
    commentCount: v.number(),
    repostCount: v.number(),
    // How many people started/saved this workout via "Try this workout".
    triedCount: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_author_and_createdAt', ['authorId', 'createdAt'])
    .index('by_community_and_createdAt', ['communityId', 'createdAt'])
    .index('by_session', ['sessionId']),

  // One reaction per user per post; switching kind replaces the row.
  reactions: defineTable({
    postId: v.id('posts'),
    userId: v.string(),
    kind: v.union(
      v.literal('cheer'),
      v.literal('fire'),
      v.literal('strong'),
      v.literal('clap')
    ),
    createdAt: v.number(),
  })
    .index('by_post_and_user', ['postId', 'userId'])
    .index('by_user', ['userId']),

  comments: defineTable({
    postId: v.id('posts'),
    authorId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_author', ['authorId']),

  // Group goals ("challenge communities"). Progress lives on membership rows
  // and is bumped at workout-completion time, never recomputed on read.
  communities: defineTable({
    name: v.string(),
    creatorId: v.string(),
    goalCategory: v.union(
      v.literal('marathon'),
      v.literal('half_marathon'),
      v.literal('ironman'),
      v.literal('consistency'),
      v.literal('custom')
    ),
    goalLabel: v.string(),
    description: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    metric: v.object({
      kind: v.union(
        v.literal('distance_km'),
        v.literal('sessions'),
        v.literal('custom')
      ),
      target: v.optional(v.number()),
      unit: v.string(),
    }),
    inviteCode: v.string(),
    visibility: v.union(v.literal('invite'), v.literal('open')),
    memberCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_inviteCode', ['inviteCode'])
    .index('by_creator', ['creatorId'])
    .index('by_visibility', ['visibility']),

  community_members: defineTable({
    communityId: v.id('communities'),
    userId: v.string(),
    role: v.union(v.literal('owner'), v.literal('member')),
    personalTarget: v.optional(v.number()),
    progressValue: v.number(),
    sessionsCount: v.number(),
    // Last milestone quarter celebrated (0, 25, 50, 75, 100) so each fires once.
    lastMilestone: v.number(),
    lastActiveAt: v.number(),
    joinedAt: v.number(),
  })
    .index('by_community', ['communityId'])
    .index('by_user', ['userId'])
    .index('by_community_and_user', ['communityId', 'userId']),

  // Lightweight activity strip inside a community (joins, workouts, milestones).
  community_events: defineTable({
    communityId: v.id('communities'),
    userId: v.optional(v.string()),
    kind: v.union(
      v.literal('joined'),
      v.literal('workout_done'),
      v.literal('milestone'),
      v.literal('created')
    ),
    message: v.string(),
    createdAt: v.number(),
  }).index('by_community_and_createdAt', ['communityId', 'createdAt']),

  notifications: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal('new_backer'),
      v.literal('back_request'),
      v.literal('back_accepted'),
      v.literal('cheer'),
      v.literal('comment'),
      v.literal('repost'),
      v.literal('workout_tried'),
      v.literal('community_invite'),
      v.literal('community_milestone')
    ),
    actorId: v.string(),
    postId: v.optional(v.id('posts')),
    communityId: v.optional(v.id('communities')),
    // Short pre-rendered body so the inbox never joins other tables.
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user_and_createdAt', ['userId', 'createdAt'])
    .index('by_user_and_read', ['userId', 'read']),

  push_tokens: defineTable({
    userId: v.string(),
    token: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android'), v.literal('web')),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_token', ['token']),

  // Daily-cron snapshot powering the Discover strip: one active row replaced
  // each run, so every client reads the same tiny document.
  discover_snapshots: defineTable({
    computedAt: v.number(),
    suggestedProfiles: v.array(
      v.object({
        userId: v.string(),
        username: v.string(),
        displayName: v.string(),
        backerCount: v.number(),
        postCount: v.number(),
      })
    ),
    trendingCommunities: v.array(
      v.object({
        communityId: v.id('communities'),
        name: v.string(),
        goalLabel: v.string(),
        memberCount: v.number(),
        eventDate: v.union(v.number(), v.null()),
      })
    ),
  }),

  // Weekly workout streaks: one row per user. A streak counts consecutive
  // weeks where the user hit their personal weekly workout goal. The week
  // window rolls forward lazily on read/write; a weekly cron finalizes
  // lapsed streaks so leaderboards stay honest.
  streaks: defineTable({
    userId: v.string(),
    // Workouts per week required to keep the streak alive (1-7).
    weeklyGoal: v.number(),
    currentStreakWeeks: v.number(),
    longestStreakWeeks: v.number(),
    // Monday 00:00 UTC of the week the counters below refer to.
    weekStartMs: v.number(),
    workoutsThisWeek: v.number(),
    // Whether this week's goal has been reached (streak already incremented).
    goalMetThisWeek: v.boolean(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  // One row each time someone taps "Try this workout" on a shared post.
  // Powers the tried counter on posts and the weekly trending top 10.
  post_tries: defineTable({
    postId: v.id('posts'),
    // Post owner, denormalized so trending never joins back to posts.
    authorId: v.string(),
    userId: v.string(),
    mode: v.union(v.literal('session'), v.literal('routine')),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_user', ['userId'])
    .index('by_createdAt', ['createdAt']),

  // Cron snapshot of the week's top 10 most-tried public workouts. One active
  // row replaced each run, mirroring discover_snapshots.
  trending_snapshots: defineTable({
    weekStartMs: v.number(),
    computedAt: v.number(),
    entries: v.array(
      v.object({
        postId: v.id('posts'),
        rank: v.number(),
        title: v.string(),
        modality: v.string(),
        triedCount: v.number(),
        authorUserId: v.string(),
        authorUsername: v.string(),
        authorDisplayName: v.string(),
      })
    ),
  }),
})
