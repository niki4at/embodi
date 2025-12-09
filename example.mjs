import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config({ path: '.env.local' })

const client = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
})

const model = process.env.OPENAI_MODEL
if (!model) {
  throw new Error('OPENAI_MODEL is not configured')
}

const response = await client.responses.create({
  model,
  input: 'Write a one-sentence bedtime story about a unicorn.',
})

console.log(response.output_text)
