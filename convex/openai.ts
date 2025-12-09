import OpenAI from 'openai'

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
