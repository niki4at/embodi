import { v } from 'convex/values'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses'

import { action, mutation } from './_generated/server'
import { getOpenAI, getOpenAIModel, openAIResponsesLowLatency } from './openai'

// Body groups / modalities the picker understands. Kept in sync with the
// unions in `convex/exercises.ts` so a suggested custom exercise can be saved
// straight away without a follow-up validation failure.
const BODY_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'glutes',
  'legs',
  'fullBody',
  'cardio',
  'mobility',
  'recovery',
] as const

const MODALITIES = ['strength', 'mobility', 'cardio', 'recovery'] as const

type ResponseParams = ResponseCreateParamsNonStreaming & {
  text: { format: ResponseFormatTextJSONSchemaConfig }
}

// Compact catalog entry the client passes in. Sending it from the client
// avoids duplicating `CATALOG_EXERCISES` on the backend (the `@/` alias used
// by the constants module isn't resolvable inside the Convex bundler).
const catalogItem = v.object({
  id: v.string(),
  name: v.string(),
  bodyPart: v.string(),
  equipment: v.string(),
  modality: v.string(),
  group: v.string(),
})

const recognitionResult = v.object({
  equipmentLabel: v.string(),
  matches: v.array(
    v.object({
      catalogId: v.string(),
      confidence: v.number(),
      reason: v.string(),
    })
  ),
  suggestedCustoms: v.array(
    v.object({
      name: v.string(),
      group: v.string(),
      bodyPart: v.string(),
      modality: v.string(),
      equipment: v.array(v.string()),
    })
  ),
})

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    return await ctx.storage.generateUploadUrl()
  },
})

type RecognitionPayload = {
  equipmentLabel: string
  matches: { catalogId: string; confidence: number; reason: string }[]
  suggestedCustoms: {
    name: string
    group: string
    bodyPart: string
    modality: string
    equipment: string[]
  }[]
}

export const recognizeExerciseFromImage = action({
  args: {
    imageId: v.id('_storage'),
    catalog: v.array(catalogItem),
  },
  returns: recognitionResult,
  handler: async (ctx, { imageId, catalog }): Promise<RecognitionPayload> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    try {
      const imageUrl = await ctx.storage.getUrl(imageId)
      if (!imageUrl) {
        throw new Error('Image not found')
      }

      const validIds = new Set(catalog.map((c) => c.id))

      // Keep the catalogue prompt compact: the model only needs id, name,
      // body part, equipment, and modality to map a photo onto exercises.
      const catalogText = catalog
        .map(
          (c) =>
            `${c.id} | ${c.name} | ${c.bodyPart} | ${c.equipment} | ${c.modality}`
        )
        .join('\n')

      const systemPrompt = `You are a fitness equipment recognition assistant for a workout app.

You are shown a photo taken in a gym. Identify the machine, equipment, or object in the photo and decide which exercises it can be used for.

You have access to the app's exercise catalogue (one per line, "id | name | bodyPart | equipment | modality").

Rules:
- Return EVERY catalogue exercise that genuinely fits the equipment in the photo, not just one. A single machine often supports several movements (e.g. an adjustable cable station, a squat rack, a bench).
- Only use catalogId values that appear in the provided catalogue. Never invent catalogue ids.
- "confidence" is 0-1 for how well the catalogue exercise fits what is visible.
- If the catalogue has no good fit (confidence would be low for all), propose 1-3 custom exercises that the equipment supports.
- For each suggested custom exercise, "group" MUST be one of: ${BODY_GROUPS.join(', ')}. "modality" MUST be one of: ${MODALITIES.join(', ')}.
- "equipmentLabel" is a short human-readable name for what you see (e.g. "Cable crossover machine", "Adjustable dumbbells", "Rowing machine").
- If the photo is unclear or shows no gym equipment, return an empty matches array, an empty suggestedCustoms array, and set equipmentLabel to a short description of what you actually see.`

      const userText = `Catalogue:\n${catalogText}\n\nIdentify the equipment in the attached photo and return matching exercises plus any custom suggestions.`

      const client = getOpenAI()
      const model = getOpenAIModel()

      const request: ResponseParams = {
        model,
        ...openAIResponsesLowLatency,
        text: {
          format: {
            type: 'json_schema',
            name: 'exercise_recognition',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['equipmentLabel', 'matches', 'suggestedCustoms'],
              properties: {
                equipmentLabel: { type: 'string' },
                matches: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['catalogId', 'confidence', 'reason'],
                    properties: {
                      catalogId: { type: 'string' },
                      confidence: { type: 'number' },
                      reason: { type: 'string' },
                    },
                  },
                },
                suggestedCustoms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'name',
                      'group',
                      'bodyPart',
                      'modality',
                      'equipment',
                    ],
                    properties: {
                      name: { type: 'string' },
                      group: { type: 'string', enum: [...BODY_GROUPS] },
                      bodyPart: { type: 'string' },
                      modality: { type: 'string', enum: [...MODALITIES] },
                      equipment: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: userText },
              { type: 'input_image', image_url: imageUrl, detail: 'auto' },
            ],
          },
        ],
      }

      const response = await client.responses.parse<
        ResponseParams,
        RecognitionPayload
      >(request)
      const parsed = response.output_parsed
      if (!parsed) {
        throw new Error('Could not recognize the photo')
      }

      // Defensive cleanup: drop matches that reference ids outside the
      // provided catalogue, clamp confidence, and keep group/modality valid.
      const groupSet = new Set<string>(BODY_GROUPS)
      const modalitySet = new Set<string>(MODALITIES)

      const matches = (parsed.matches ?? [])
        .filter((m) => validIds.has(m.catalogId))
        .map((m) => ({
          catalogId: m.catalogId,
          confidence: Math.max(0, Math.min(1, m.confidence ?? 0)),
          reason: (m.reason ?? '').slice(0, 200),
        }))
        .sort((a, b) => b.confidence - a.confidence)

      const suggestedCustoms = (parsed.suggestedCustoms ?? [])
        .filter(
          (c) =>
            c.name?.trim() &&
            groupSet.has(c.group) &&
            modalitySet.has(c.modality)
        )
        .slice(0, 3)
        .map((c) => ({
          name: c.name.trim().slice(0, 80),
          group: c.group,
          bodyPart: (c.bodyPart ?? '').trim() || c.group,
          modality: c.modality,
          equipment: Array.isArray(c.equipment)
            ? c.equipment.map((e) => e.trim()).filter(Boolean).slice(0, 4)
            : [],
        }))

      return {
        equipmentLabel: (parsed.equipmentLabel ?? '').slice(0, 80),
        matches,
        suggestedCustoms,
      }
    } finally {
      // Scan images are transient — never let them accumulate in storage.
      await ctx.storage.delete(imageId)
    }
  },
})
