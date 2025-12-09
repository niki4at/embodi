import { v } from 'convex/values'
import OpenAI from 'openai'
import { api, internal } from './_generated/api'
import {
  action,
  ActionCtx,
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import { getOpenAI, getOpenAIModel } from './openai'

// Types for profile questions
type ProfileQuestion = {
  id: string
  category: string
  questionText: string
  answerType: 'slider' | 'single' | 'multi' | 'text'
  options?: string[]
  sliderMin?: number
  sliderMax?: number
  sliderLabels?: string[]
}

type OnboardingProfile = {
  name: string
  age: string
  gender: 'male' | 'female' | 'prefer-not-to-say' | null
  goal: string
  activityLevel:
    | 'sedentary'
    | 'light'
    | 'moderate'
    | 'active'
    | 'very-active'
    | null
  timeAvailable: string[]
  injuries: string[]
  conditions: string[]
  medications: string
  smoking: 'never' | 'former' | 'current' | null
  alcohol: 'never' | 'occasionally' | 'regularly' | null
}

// Tool definitions for building questions
const questionTools: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'add_slider_question',
    description:
      'Add a slider/scale question for numeric ratings (pain 0-10, confidence 1-5, etc.)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique question ID in format q-{category}-{number}',
        },
        category: {
          type: 'string',
          description: 'Question category (e.g., Pain Assessment, Lifestyle)',
        },
        questionText: { type: 'string', description: 'The question to ask' },
        min: { type: 'number', description: 'Minimum slider value' },
        max: { type: 'number', description: 'Maximum slider value' },
        minLabel: {
          type: 'string',
          description: 'Label for minimum end (e.g., "No pain")',
        },
        midLabel: {
          type: 'string',
          description: 'Label for middle (e.g., "Moderate")',
        },
        maxLabel: {
          type: 'string',
          description: 'Label for maximum end (e.g., "Severe")',
        },
      },
      required: [
        'id',
        'category',
        'questionText',
        'min',
        'max',
        'minLabel',
        'midLabel',
        'maxLabel',
      ],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'add_single_choice_question',
    description: 'Add a single-choice question where user picks one option',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique question ID in format q-{category}-{number}',
        },
        category: { type: 'string', description: 'Question category' },
        questionText: { type: 'string', description: 'The question to ask' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of options to choose from (3-6 options recommended)',
        },
      },
      required: ['id', 'category', 'questionText', 'options'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'add_multi_choice_question',
    description:
      'Add a multiple-choice question where user can select multiple options',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique question ID in format q-{category}-{number}',
        },
        category: { type: 'string', description: 'Question category' },
        questionText: { type: 'string', description: 'The question to ask' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of options (include "None" or "None of these" as last option)',
        },
      },
      required: ['id', 'category', 'questionText', 'options'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'add_text_question',
    description: 'Add an open-ended text question (use sparingly)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique question ID in format q-{category}-{number}',
        },
        category: { type: 'string', description: 'Question category' },
        questionText: { type: 'string', description: 'The question to ask' },
      },
      required: ['id', 'category', 'questionText'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'finish_questions',
    description: 'Call this when done adding all questions',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
]

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`

// Internal mutation to create initial profile_questions record
export const createProfileQuestionsRecord = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // Check if record already exists
    const existing = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      // Reset to generating state
      await ctx.db.patch(existing._id, {
        status: 'generating',
        questions: [],
        answeredCount: 0,
        totalCount: 0,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert('profile_questions', {
      userId,
      status: 'generating',
      questions: [],
      answeredCount: 0,
      totalCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Internal mutation to update profile questions after AI generation
export const updateProfileQuestions = internalMutation({
  args: {
    userId: v.string(),
    questions: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, { userId, questions }) => {
    const existing = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'ready',
        questions,
        totalCount: questions.length,
        updatedAt: now,
      })
    } else {
      // Create if doesn't exist (handles race conditions)
      await ctx.db.insert('profile_questions', {
        userId,
        status: 'ready',
        questions,
        answeredCount: 0,
        totalCount: questions.length,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})

// Internal mutation to mark generation as failed
export const markGenerationFailed = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'failed',
        updatedAt: Date.now(),
      })
    }
  },
})

// Internal mutation to append a single question during streaming generation
export const appendProfileQuestion = internalMutation({
  args: {
    userId: v.string(),
    question: v.object({
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
    }),
  },
  handler: async (ctx, { userId, question }) => {
    const existing = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!existing) {
      console.error('[appendProfileQuestion] No profile_questions record found')
      return
    }

    const updatedQuestions = [...existing.questions, question]
    await ctx.db.patch(existing._id, {
      questions: updatedQuestions,
      updatedAt: Date.now(),
    })

    console.log(
      `[appendProfileQuestion] Appended question ${updatedQuestions.length} for user ${userId}`
    )
  },
})

// Internal mutation to mark questions as ready after streaming completes
export const markProfileQuestionsReady = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!existing) {
      console.error(
        '[markProfileQuestionsReady] No profile_questions record found'
      )
      return
    }

    await ctx.db.patch(existing._id, {
      status: 'ready',
      totalCount: existing.questions.length,
      updatedAt: Date.now(),
    })

    console.log(
      `[markProfileQuestionsReady] Marked ${existing.questions.length} questions as ready for user ${userId}`
    )
  },
})

// Main action to generate personalized profile questions using AI (for user-triggered calls)
export const generateProfileQuestions = action({
  args: {},
  handler: async (ctx): Promise<ProfileQuestion[]> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    // Get onboarding data
    const rawOnboarding = await ctx.runQuery(api.onboarding.getOnboarding, {})
    if (!rawOnboarding) {
      throw new Error('Onboarding data not found')
    }

    // Cast to OnboardingProfile
    const onboardingData: OnboardingProfile = {
      name: rawOnboarding.name,
      age: rawOnboarding.age,
      gender: rawOnboarding.gender,
      goal: rawOnboarding.goal,
      activityLevel: rawOnboarding.activityLevel,
      timeAvailable: rawOnboarding.timeAvailable,
      injuries: rawOnboarding.injuries,
      conditions: rawOnboarding.conditions,
      medications: rawOnboarding.medications,
      smoking: rawOnboarding.smoking,
      alcohol: rawOnboarding.alcohol,
    }

    // Delegate to the internal action
    return await generateQuestionsInternal(ctx, userId, onboardingData)
  },
})

// Action to retry question generation after failure
export const retryGenerateQuestions = action({
  args: {},
  handler: async (ctx): Promise<ProfileQuestion[]> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    // Get onboarding data
    const rawOnboarding = await ctx.runQuery(api.onboarding.getOnboarding, {})
    if (!rawOnboarding) {
      throw new Error('Onboarding data not found')
    }

    // Cast to OnboardingProfile
    const onboardingData: OnboardingProfile = {
      name: rawOnboarding.name,
      age: rawOnboarding.age,
      gender: rawOnboarding.gender,
      goal: rawOnboarding.goal,
      activityLevel: rawOnboarding.activityLevel,
      timeAvailable: rawOnboarding.timeAvailable,
      injuries: rawOnboarding.injuries,
      conditions: rawOnboarding.conditions,
      medications: rawOnboarding.medications,
      smoking: rawOnboarding.smoking,
      alcohol: rawOnboarding.alcohol,
    }

    // Retry generation
    return await generateQuestionsInternal(ctx, userId, onboardingData)
  },
})

// Internal action for scheduled/background generation (called from onboarding mutation)
export const generateProfileQuestionsForUser = internalAction({
  args: {
    userId: v.string(),
    onboardingData: v.object({
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
    }),
  },
  handler: async (ctx, { userId, onboardingData }) => {
    return await generateQuestionsInternal(ctx, userId, onboardingData)
  },
})

// Shared logic for generating questions with streaming persistence
async function generateQuestionsInternal(
  ctx: ActionCtx,
  userId: string,
  onboardingData: OnboardingProfile
): Promise<ProfileQuestion[]> {
  // Create/reset the profile questions record
  await ctx.runMutation(
    internal.profileQuestions.createProfileQuestionsRecord,
    {
      userId,
    }
  )

  const profile: OnboardingProfile = {
    name: onboardingData.name,
    age: onboardingData.age,
    gender: onboardingData.gender,
    goal: onboardingData.goal,
    activityLevel: onboardingData.activityLevel,
    timeAvailable: onboardingData.timeAvailable,
    injuries: onboardingData.injuries,
    conditions: onboardingData.conditions,
    medications: onboardingData.medications,
    smoking: onboardingData.smoking,
    alcohol: onboardingData.alcohol,
  }

  try {
    // Generate questions using AI with streaming persistence
    const questions = await generateQuestionsWithAIStreaming(
      ctx,
      userId,
      profile
    )

    // Mark as ready once all questions are generated
    await ctx.runMutation(internal.profileQuestions.markProfileQuestionsReady, {
      userId,
    })

    return questions
  } catch (error) {
    console.error('Failed to generate profile questions:', error)
    // Mark as failed so user can retry
    await ctx.runMutation(internal.profileQuestions.markGenerationFailed, {
      userId,
    })
    throw error
  }
}

// Query to get profile questions for current user
export const getProfileQuestions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()

    return profileQuestions
  },
})

// Mutation to submit an answer to a question
export const submitQuestionAnswer = mutation({
  args: {
    questionId: v.string(),
    answer: v.union(v.string(), v.number(), v.array(v.string())),
  },
  handler: async (ctx, { questionId, answer }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!profileQuestions) {
      throw new Error('Profile questions not found')
    }

    // Find the question to get its details
    const question = profileQuestions.questions.find((q) => q.id === questionId)
    if (!question) {
      throw new Error('Question not found')
    }

    const now = Date.now()

    // Check if answer already exists for this question
    const existingAnswer = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId_questionId', (q) =>
        q.eq('userId', userId).eq('questionId', questionId)
      )
      .first()

    if (existingAnswer) {
      // Update existing answer
      await ctx.db.patch(existingAnswer._id, {
        answer,
        updatedAt: now,
      })
    } else {
      // Create new answer
      await ctx.db.insert('profile_answers', {
        userId,
        questionId,
        questionText: question.questionText,
        category: question.category,
        answerType: question.answerType,
        answer,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Count total answers for this user
    const allAnswers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const answeredCount = allAnswers.length

    // Update the profile_questions record with the count
    await ctx.db.patch(profileQuestions._id, {
      answeredCount,
      updatedAt: now,
    })

    return { answeredCount, totalCount: profileQuestions.totalCount }
  },
})

// Mutation to submit ALL answers at once (batch save for reliability)
export const submitAllAnswers = mutation({
  args: {
    answers: v.array(
      v.object({
        questionId: v.string(),
        answer: v.union(v.string(), v.number(), v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, { answers }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!profileQuestions) {
      throw new Error('Profile questions not found')
    }

    // Create a map of questions for quick lookup
    const questionMap = new Map(
      profileQuestions.questions.map((q) => [q.id, q])
    )

    const now = Date.now()

    // Get all existing answers for this user
    const existingAnswers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const existingAnswerMap = new Map(
      existingAnswers.map((a) => [a.questionId, a])
    )

    // Process each answer
    for (const { questionId, answer } of answers) {
      const question = questionMap.get(questionId)
      if (!question) continue

      const existingAnswer = existingAnswerMap.get(questionId)

      if (existingAnswer) {
        // Update existing answer
        await ctx.db.patch(existingAnswer._id, {
          answer,
          updatedAt: now,
        })
      } else {
        // Create new answer
        await ctx.db.insert('profile_answers', {
          userId,
          questionId,
          questionText: question.questionText,
          category: question.category,
          answerType: question.answerType,
          answer,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // Count total answers for this user
    const totalAnswers =
      existingAnswers.length +
      answers.filter((a) => !existingAnswerMap.has(a.questionId)).length

    // Update the profile_questions record with the count
    await ctx.db.patch(profileQuestions._id, {
      answeredCount: totalAnswers,
      updatedAt: now,
    })

    console.log(
      `[submitAllAnswers] Saved ${answers.length} answers for user ${userId}`
    )
    return {
      answeredCount: totalAnswers,
      totalCount: profileQuestions.totalCount,
    }
  },
})

// Debug query to see all saved data for a user
export const getProfileDebug = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const userId = identity.subject

    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const extendedProfile = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    // Get all answers from profile_answers table
    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    // Format answers for easy viewing
    const formattedAnswers = answers.map((a) => ({
      questionId: a.questionId,
      category: a.category,
      question: a.questionText,
      answerType: a.answerType,
      answer: a.answer,
    }))

    return {
      profileQuestionsStatus: profileQuestions?.status || 'not found',
      totalQuestions: profileQuestions?.totalCount || 0,
      answeredCount: answers.length,
      answers: formattedAnswers,
      extendedProfile: extendedProfile || null,
    }
  },
})

// Internal mutation to save the extended profile summary
export const saveExtendedProfile = internalMutation({
  args: {
    userId: v.string(),
    profileSummary: v.string(),
    hasPainAssessment: v.boolean(),
    hasRedFlags: v.boolean(),
    completedCategories: v.array(v.string()),
  },
  handler: async (
    ctx,
    {
      userId,
      profileSummary,
      hasPainAssessment,
      hasRedFlags,
      completedCategories,
    }
  ) => {
    const existingProfile = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const now = Date.now()

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        profileSummary,
        hasPainAssessment,
        hasRedFlags,
        completedCategories,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('extended_profile', {
        userId,
        profileSummary,
        hasPainAssessment,
        hasRedFlags,
        completedCategories,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Mark profile questions as completed
    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (profileQuestions) {
      await ctx.db.patch(profileQuestions._id, {
        status: 'completed',
        updatedAt: now,
      })
    }

    // Clean up individual answers since we now have the summary
    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    for (const answer of answers) {
      await ctx.db.delete(answer._id)
    }
  },
})

// Generate comprehensive profile summary using AI
async function generateProfileSummary(
  onboardingData: OnboardingProfile,
  answers: {
    questionText: string
    category: string
    answer: string | number | string[]
  }[]
): Promise<string> {
  const client = getOpenAI()
  const model = getOpenAIModel()

  // Format answers for the AI
  const formattedAnswers = answers
    .map((a) => {
      const answerStr = Array.isArray(a.answer)
        ? a.answer.join(', ')
        : String(a.answer)
      return `[${a.category}] ${a.questionText}\nAnswer: ${answerStr}`
    })
    .join('\n\n')

  const systemPrompt = `You are a health and fitness profile summarizer. Your task is to create a comprehensive, structured profile summary that captures ALL relevant information about a user for their personal training program.

The summary MUST include:
1. Basic demographics (name, age, gender)
2. Primary fitness goal and motivation
3. Current activity level and available time
4. Health considerations (injuries, conditions, medications)
5. Lifestyle factors (smoking, alcohol habits)
6. Pain assessment details (if applicable) - location, severity, triggers, what helps
7. Energy and recovery patterns
8. Sleep and stress levels
9. Motivation drivers and barriers
10. Training preferences (equipment, solo/group, intensity preferences)
11. Any safety concerns or red flags requiring medical clearance

Format the summary as a clear, organized document that a personal trainer or AI coach can reference to create personalized workout programs. Use headers and bullet points for clarity. Be thorough but concise.`

  const userPrompt = `Create a comprehensive profile summary for this user.

ONBOARDING DATA:
- Name: ${onboardingData.name}
- Age: ${onboardingData.age}
- Gender: ${onboardingData.gender || 'Not specified'}
- Primary Goal: ${onboardingData.goal}
- Activity Level: ${onboardingData.activityLevel || 'Not specified'}
- Time Available: ${onboardingData.timeAvailable.join(', ') || 'Flexible'}
- Injuries/Discomfort: ${onboardingData.injuries.length > 0 ? onboardingData.injuries.join(', ') : 'None reported'}
- Health Conditions: ${onboardingData.conditions.length > 0 ? onboardingData.conditions.join(', ') : 'None reported'}
- Medications: ${onboardingData.medications || 'None'}
- Smoking: ${onboardingData.smoking || 'Not specified'}
- Alcohol: ${onboardingData.alcohol || 'Not specified'}

QUESTIONNAIRE ANSWERS:
${formattedAnswers}

Create a complete profile summary that captures all this information in a structured, trainer-friendly format.`

  const response = await client.responses.create({
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  // Extract text from response
  const textOutput = response.output.find((item) => item.type === 'message')
  if (textOutput && textOutput.type === 'message') {
    const textContent = textOutput.content.find((c) => c.type === 'output_text')
    if (textContent && textContent.type === 'output_text') {
      return textContent.text
    }
  }

  throw new Error('Failed to generate profile summary')
}

// Mutation to mark profile as completing and schedule background summary generation
export const completeProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const profileQuestions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!profileQuestions) {
      throw new Error('Profile questions not found')
    }

    // Mark as completed immediately (user can leave)
    await ctx.db.patch(profileQuestions._id, {
      status: 'completed',
      updatedAt: Date.now(),
    })

    // Get onboarding data for the background action
    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!onboarding) {
      throw new Error('Onboarding data not found')
    }

    // Get all answers to pass to background action
    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const formattedAnswers = answers.map((a) => ({
      questionId: a.questionId,
      questionText: a.questionText,
      category: a.category,
      answerType: a.answerType,
      answer: a.answer,
    }))

    // Schedule background action to generate summary
    await ctx.scheduler.runAfter(
      0,
      internal.profileQuestions.generateAndSaveProfileSummary,
      {
        userId,
        onboardingData: {
          name: onboarding.name,
          age: onboarding.age,
          gender: onboarding.gender,
          goal: onboarding.goal,
          activityLevel: onboarding.activityLevel,
          timeAvailable: onboarding.timeAvailable,
          injuries: onboarding.injuries,
          conditions: onboarding.conditions,
          medications: onboarding.medications,
          smoking: onboarding.smoking,
          alcohol: onboarding.alcohol,
        },
        answers: formattedAnswers,
      }
    )

    return { success: true }
  },
})

// Internal action to generate and save profile summary in the background
export const generateAndSaveProfileSummary = internalAction({
  args: {
    userId: v.string(),
    onboardingData: v.object({
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
    }),
    answers: v.array(
      v.object({
        questionId: v.string(),
        questionText: v.string(),
        category: v.string(),
        answerType: v.union(
          v.literal('slider'),
          v.literal('single'),
          v.literal('multi'),
          v.literal('text')
        ),
        answer: v.union(v.string(), v.number(), v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, { userId, onboardingData, answers }) => {
    // Build category list and check flags
    const categories = [...new Set(answers.map((a) => a.category))]
    const hasPainAssessment = categories.some(
      (c) =>
        c.toLowerCase().includes('pain') || c.toLowerCase().includes('health')
    )

    // Check for red flags in safety-related answers
    const hasRedFlags = answers.some((a) => {
      if (
        a.questionText.toLowerCase().includes('safety') ||
        a.questionText.toLowerCase().includes('experienced any of these')
      ) {
        if (Array.isArray(a.answer)) {
          return a.answer.some(
            (item) =>
              !item.toLowerCase().includes('none') &&
              (item.toLowerCase().includes('numbness') ||
                item.toLowerCase().includes('weakness') ||
                item.toLowerCase().includes('bladder') ||
                item.toLowerCase().includes('bowel'))
          )
        }
      }
      return false
    })

    // Generate comprehensive profile summary using AI
    const formattedAnswers = answers.map((a) => ({
      questionText: a.questionText,
      category: a.category,
      answer: a.answer,
    }))

    const profileSummary = await generateProfileSummary(
      onboardingData,
      formattedAnswers
    )

    // Save the extended profile with summary
    await ctx.runMutation(internal.profileQuestions.saveExtendedProfile, {
      userId,
      profileSummary,
      hasPainAssessment,
      hasRedFlags,
      completedCategories: categories,
    })

    console.log(
      `[generateAndSaveProfileSummary] Generated and saved profile summary for user ${userId}`
    )
  },
})

// Query to get extended profile
export const getExtendedProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const extendedProfile = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()

    return extendedProfile
  },
})

// Query to get all profile answers for current user
export const getProfileAnswers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .collect()

    return answers
  },
})

// Query to get profile answers by category
export const getProfileAnswersByCategory = query({
  args: {
    category: v.string(),
  },
  handler: async (ctx, { category }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId_category', (q) =>
        q.eq('userId', identity.subject).eq('category', category)
      )
      .collect()

    return answers
  },
})

// Query to get a specific answer by question ID
export const getProfileAnswer = query({
  args: {
    questionId: v.string(),
  },
  handler: async (ctx, { questionId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const answer = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId_questionId', (q) =>
        q.eq('userId', identity.subject).eq('questionId', questionId)
      )
      .first()

    return answer
  },
})

// Helper function to build prompts for question generation
function buildQuestionPrompts(profile: OnboardingProfile): {
  systemPrompt: string
  userPrompt: string
} {
  // Build rich context from ALL onboarding data
  const ageNum = parseInt(profile.age, 10) || 30
  const ageContext =
    ageNum < 25
      ? 'young adult with high recovery potential'
      : ageNum < 40
        ? 'prime years with good adaptability'
        : ageNum < 55
          ? 'midlife requiring attention to joint health and recovery'
          : 'mature adult prioritizing longevity and functional fitness'

  const activityContext =
    profile.activityLevel === 'sedentary'
      ? 'currently inactive, needs gradual progression'
      : profile.activityLevel === 'light'
        ? 'somewhat active, ready for structured training'
        : profile.activityLevel === 'moderate'
          ? 'regularly active, can handle moderate intensity'
          : 'highly active, can handle challenging workouts'

  const timeContext =
    profile.timeAvailable.length === 0
      ? 'flexible schedule'
      : profile.timeAvailable.includes('15-30 minutes')
        ? 'limited time, needs efficient workouts'
        : profile.timeAvailable.includes('60+ minutes')
          ? 'ample time for comprehensive sessions'
          : 'moderate time available for balanced sessions'

  // Check if user has pain/injury/conditions
  const hasPainOrInjury =
    profile.injuries.length > 0 || profile.conditions.length > 0

  const systemPrompt = `You are an empathetic health and longevity coach creating a deeply personalized assessment for ${profile.name}.

YOUR MISSION: Build on the initial onboarding data to gather DEEPER, MORE PERSONAL insights that will help create the perfect training program. DO NOT ask about things we already know - dig deeper into the WHY, the feelings, the nuances. The purpose of this assessment is gather enough information to later create personalized AI-generated training programs that are tailored to the user's specific needs and goals. The whole app acts as an AI coach from the users perspective, so the questions should be designed to help the user achieve their goals and to help them understand their own body and mind while suggesting training that promotes health and happiness and longevity based on latest scientific research.

QUESTION DESIGN PRINCIPLES:
1. SLIDERS are powerful for nuanced responses - use creative scales like:
   - Energy levels through the day (1-10 with morning/afternoon/evening context)
   - Pain severity (0-10 with meaningful labels)
   - Confidence in movement (1-5 with descriptive labels like "Hesitant" → "Fearless")
   - Motivation fluctuation (1-10 with "Struggling" → "Unstoppable")
   - Recovery speed (1-10 with "Takes forever" → "Bounces back fast")

2. SINGLE CHOICE for lifestyle patterns - make options feel personal:
   - Instead of "sleep quality: poor/fair/good" → "My sleep lately has been: 'Tossing and turning most nights' / 'Hit or miss, depends on the day' / 'Pretty solid, I wake up rested' / 'I sleep like a champion'"
   - Make options conversational, use first person

3. MULTI-SELECT for habits and preferences - be specific and relatable:
   - Pain triggers and symptoms
   - "What tends to derail your health goals?" with real-life options
   - "What makes you feel most alive?" to understand motivation
   - "What's worked for you in the past?" to build on successes

4. TEXT only for deeply personal insights (use 0-1 max):
   - "What would feeling your best actually look like for you?"
   - "What's the one thing you wish a trainer understood about you?"

WHAT WE ALREADY KNOW ABOUT ${profile.name.toUpperCase()} (DO NOT re-ask these):
- Gender: ${profile.gender || 'Not specified'} (consider hormonal, body composition, and social factors)
- Goal: "${profile.goal}" - this is their north star, dig deeper into WHY
${profile.injuries.length > 0 ? `- IMPORTANT - Discomfort areas: ${profile.injuries.join(', ')} - assess severity, triggers, and impact compassionately` : ''}
${profile.conditions.length > 0 ? `- Health considerations: ${profile.conditions.join(', ')} - understand how these affect daily life` : ''}
${profile.medications ? `- Takes medications: "${profile.medications}" - be mindful of energy, side effects` : ''}
${profile.smoking ? `- Smoking: ${profile.smoking} - affects cardio capacity, recovery` : ''}
${profile.alcohol ? `- Alcohol: ${profile.alcohol} - affects sleep, recovery, hydration` : ''}
- Age: ${profile.age} (${ageContext})
- Activity level: ${profile.activityLevel || 'Not specified'} (${activityContext})
- Time available: ${profile.timeAvailable.join(', ') || 'Flexible'} (${timeContext})

BUILD 10-15 QUESTIONS that paint a complete picture of ${profile.name}'s:
1. Physical state (pain, energy, mobility, strength baseline)
2. Mental/emotional state (stress, motivation, confidence, barriers)
3. Lifestyle patterns (sleep, nutrition habits, hydration, recovery)
4. Goals and timeline (urgency, what success looks like, past attempts)
5. Preferences (what they enjoy, what they dread, what kind of structured app-based program they prefer)

${hasPainOrInjury ? 'BUILD 12-15 QUESTIONS: Start with 6-8 thorough pain assessment questions, then 6-8 about goals and lifestyle.' : 'BUILD 10-12 QUESTIONS about their goals, lifestyle, motivation, and preferences.'}

Make every question feel like it was written specifically for them. Use their name occasionally. Reference their specific goal. Acknowledge their challenges. Be warm and understanding, especially about pain.

CALL finish_questions when you have 10-15 high-quality questions.`

  const userPrompt = hasPainOrInjury
    ? `Create a deeply personalized health assessment for:

**${profile.name}** (${profile.age}${profile.gender ? `, ${profile.gender}` : ''})

🎯 Their Goal: "${profile.goal}"
⚠️ PAIN/INJURY: ${profile.injuries.join(', ')}${profile.conditions.length > 0 ? `, Health: ${profile.conditions.join(', ')}` : ''} - THIS IS YOUR FIRST PRIORITY
${profile.medications ? `💊 Medications: "${profile.medications}"` : ''}
${profile.smoking ? `🚬 Smoking: ${profile.smoking}` : ''}
${profile.alcohol ? `🍷 Alcohol: ${profile.alcohol}` : ''}

We already know their activity level (${profile.activityLevel || 'not specified'}) and time (${profile.timeAvailable.join(', ') || 'flexible'}) - DON'T re-ask these.

BUILD 12-15 QUESTIONS:
- First 6-8: Thorough pain/health assessment (severity, triggers, what helps, impact on daily life, safety screening)
- Last 6-8: Goals, motivation, barriers, preferences, what success looks like

Make ${profile.name} feel heard. Reference their specific situation. Be compassionate about their pain.`
    : `Create a deeply personalized health assessment for:

**${profile.name}** (${profile.age}${profile.gender ? `, ${profile.gender}` : ''})

🎯 Their Goal: "${profile.goal}"
✓ No injuries/conditions reported
${profile.medications ? `💊 Medications: "${profile.medications}"` : ''}
${profile.smoking ? `🚬 Smoking: ${profile.smoking}` : ''}
${profile.alcohol ? `🍷 Alcohol: ${profile.alcohol}` : ''}

We already know their activity level (${profile.activityLevel || 'not specified'}) and time (${profile.timeAvailable.join(', ') || 'flexible'}) - DON'T re-ask these.

BUILD 10-12 QUESTIONS covering:
- Physical state (energy patterns, recovery, movement confidence)
- Mental/emotional (stress, motivation, what's gotten in the way before)
- Lifestyle (sleep quality, hydration, nutrition habits)
- Goals deep-dive (WHY this goal matters, what success looks like, timeline)
- Preferences (training styles they enjoy, solo vs social, time of day)

Make ${profile.name} feel understood. Reference their specific goal: "${profile.goal}". Ask questions that help design their perfect program.`

  return { systemPrompt, userPrompt }
}

// Helper to process a single tool call and persist the question
async function processToolCallAndPersist(
  ctx: ActionCtx,
  userId: string,
  name: string,
  argsString: string,
  questions: ProfileQuestion[]
): Promise<{ question: ProfileQuestion | null; shouldFinish: boolean }> {
  try {
    const args = JSON.parse(argsString)
    let question: ProfileQuestion | null = null
    let shouldFinish = false

    switch (name) {
      case 'add_slider_question':
        question = {
          id: args.id || createId('q-slider'),
          category: args.category,
          questionText: args.questionText,
          answerType: 'slider',
          sliderMin: args.min,
          sliderMax: args.max,
          sliderLabels: [args.minLabel, args.midLabel, args.maxLabel],
        }
        break

      case 'add_single_choice_question':
        question = {
          id: args.id || createId('q-single'),
          category: args.category,
          questionText: args.questionText,
          answerType: 'single',
          options: args.options,
        }
        break

      case 'add_multi_choice_question':
        question = {
          id: args.id || createId('q-multi'),
          category: args.category,
          questionText: args.questionText,
          answerType: 'multi',
          options: args.options,
        }
        break

      case 'add_text_question':
        question = {
          id: args.id || createId('q-text'),
          category: args.category,
          questionText: args.questionText,
          answerType: 'text',
        }
        break

      case 'finish_questions':
        shouldFinish = true
        break
    }

    // Persist the question immediately so UI updates in real-time
    if (question) {
      questions.push(question)
      await ctx.runMutation(internal.profileQuestions.appendProfileQuestion, {
        userId,
        question,
      })
    }

    return { question, shouldFinish }
  } catch (error) {
    console.error(`Error processing tool call ${name}:`, error)
    return { question: null, shouldFinish: false }
  }
}

// AI question generation with TRUE streaming - saves each question as soon as OpenAI generates it
async function generateQuestionsWithAIStreaming(
  ctx: ActionCtx,
  userId: string,
  profile: OnboardingProfile
): Promise<ProfileQuestion[]> {
  const client = getOpenAI()
  const model = getOpenAIModel()

  const { systemPrompt, userPrompt } = buildQuestionPrompts(profile)

  const questions: ProfileQuestion[] = []
  let continueLoop = true
  let iterations = 0
  const maxIterations = 20

  console.log(
    '[generateQuestionsWithAIStreaming] Starting question generation with model:',
    model
  )

  // Use responses API with tools - process each response and persist immediately
  let response
  try {
    response = await client.responses.create({
      model,
      tools: questionTools,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    console.log(
      '[generateQuestionsWithAIStreaming] Initial response received, output items:',
      response.output.length
    )
    console.log(
      '[generateQuestionsWithAIStreaming] Output types:',
      response.output.map((o) => o.type)
    )
  } catch (apiError) {
    console.error(
      '[generateQuestionsWithAIStreaming] API call failed:',
      apiError
    )
    throw apiError
  }

  while (continueLoop && iterations < maxIterations) {
    iterations++

    // Check for tool calls in the response
    const toolCalls = response.output.filter(
      (
        item
      ): item is {
        type: 'function_call'
        call_id: string
        name: string
        arguments: string
      } => item.type === 'function_call'
    )

    console.log(
      `[generateQuestionsWithAIStreaming] Iteration ${iterations}: ${toolCalls.length} tool calls, names:`,
      toolCalls.map((t) => t.name)
    )

    if (toolCalls.length === 0) {
      break
    }

    const toolResults: {
      type: 'function_call_output'
      call_id: string
      output: string
    }[] = []

    // Process each tool call and persist IMMEDIATELY
    for (const toolCall of toolCalls) {
      const { shouldFinish } = await processToolCallAndPersist(
        ctx,
        userId,
        toolCall.name,
        toolCall.arguments,
        questions
      )

      toolResults.push({
        type: 'function_call_output',
        call_id: toolCall.call_id,
        output: JSON.stringify({
          success: true,
          questionCount: questions.length,
        }),
      })

      if (shouldFinish) {
        continueLoop = false
        break
      }
    }

    if (!continueLoop) break

    // Continue the conversation with tool results
    response = await client.responses.create({
      model,
      tools: questionTools,
      previous_response_id: response.id,
      input: toolResults,
    })
  }

  console.log(
    `[generateQuestionsWithAIStreaming] Finished with ${questions.length} questions`
  )

  if (questions.length === 0) {
    throw new Error('AI_GENERATION_FAILED')
  }

  return questions
}
