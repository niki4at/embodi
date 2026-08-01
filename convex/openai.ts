import OpenAI from 'openai'
import type { Reasoning } from 'openai/resources/shared'

let cachedOpenAI: OpenAI | null = null
let cachedModel: string | null = null

export const getOpenAI = () => {
  if (cachedOpenAI) return cachedOpenAI
  const apiKey = process.env.OPEN_API_KEY
  if (!apiKey) {
    throw new Error('OPEN_API_KEY is not configured')
  }
  cachedOpenAI = new OpenAI({ apiKey })
  return cachedOpenAI
}

export const getOpenAIModel = () => {
  if (cachedModel) return cachedModel
  const model = process.env.OPENAI_MODEL
  if (!model) {
    throw new Error('OPENAI_MODEL is not configured')
  }
  cachedModel = model
  return model
}

/**
 * Responses API: fastest / cheapest GPT-5.x settings.
 * - reasoning.effort `none`: skip reasoning tokens (lowest latency)
 * - text.verbosity `low`: shorter final answers (fewer output tokens)
 * Callers that set their own `text` (e.g. json_schema) must merge
 * `openAITextLowVerbosity` into that object.
 * @see https://platform.openai.com/docs/guides/reasoning
 */
export const openAITextLowVerbosity = {
  verbosity: 'low' as const,
}

export const openAIResponsesLowLatency = {
  reasoning: { effort: 'none' } satisfies Reasoning,
  text: openAITextLowVerbosity,
}
