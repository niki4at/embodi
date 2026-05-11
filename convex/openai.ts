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
 * Responses API: minimal reasoning for lowest latency (GPT-5 family and other reasoning models).
 * @see https://platform.openai.com/docs/guides/reasoning
 */
export const openAIResponsesLowLatency = {
  reasoning: { effort: 'none' } satisfies Reasoning,
}
