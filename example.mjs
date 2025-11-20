import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config({ path: '.env.local' })

const client = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
})

const response = await client.responses.create({
  model: 'gpt-5-nano',
  input: 'Write a one-sentence bedtime story about a unicorn.',
})

console.log(response.output_text)
