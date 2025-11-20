import { v } from 'convex/values'
import OpenAI from 'openai'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses'
import { action } from './_generated/server'

export type Citation = {
  id: string
  title: string
  authors: string[]
  year: number
  source: string
  url: string
  doi?: string
  summary?: string
}

export type CitationsProfile = {
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

const profileArg = v.object({
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
})

const citationArg = v.object({
  id: v.string(),
  title: v.string(),
  authors: v.array(v.string()),
  year: v.number(),
  source: v.string(),
  url: v.string(),
  doi: v.optional(v.string()),
  summary: v.optional(v.string()),
})

let cachedOpenAI: OpenAI | null = null
let semanticScholarNextAvailable = 0
const getOpenAI = () => {
  if (cachedOpenAI) {
    return cachedOpenAI
  }
  const apiKey = process.env.OPEN_API_KEY
  if (!apiKey) {
    throw new Error('OPEN_API_KEY is not configured')
  }
  cachedOpenAI = new OpenAI({ apiKey })
  return cachedOpenAI
}

async function waitForSemanticScholarSlot() {
  const now = Date.now()
  if (now < semanticScholarNextAvailable) {
    const delay = semanticScholarNextAvailable - now
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  semanticScholarNextAvailable = Date.now() + 1000
}

export const searchCitations = action({
  args: {
    profile: profileArg,
  },
  handler: async (_, { profile }) => searchCitationsForProfile(profile),
})

export const distillCitations = action({
  args: {
    profile: profileArg,
    citations: v.array(citationArg),
  },
  handler: async (_, { profile, citations }) =>
    distillCitationsForProfile(profile, citations),
})

export async function searchCitationsForProfile(profile: CitationsProfile) {
  const query = buildSearchQuery(profile)
  const [pubmed, semantic] = await Promise.all([
    fetchPubMed(query),
    fetchSemanticScholar(query, process.env.SEMANTIC_SCHOLAR_API_KEY),
  ])
  let combined = dedupeCitations([...pubmed, ...semantic])

  if (combined.length < 5) {
    const aiCitations = await fetchOpenAICitations(profile)
    if (aiCitations.length) {
      combined = dedupeCitations([...combined, ...aiCitations])
    }
  }

  return combined.slice(0, 12)
}

type JsonSchemaResponseParams = {
  text: {
    format: ResponseFormatTextJSONSchemaConfig
  }
}

export async function distillCitationsForProfile(
  profile: CitationsProfile,
  citations: Citation[]
) {
  if (!citations.length) {
    return []
  }

  const client = getOpenAI()
  const factsRequest = {
    model: 'gpt-5-mini-2025-08-07',
    text: {
      format: {
        type: 'json_schema',
        name: 'health_facts',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            facts: {
              type: 'array',
              minItems: 3,
              maxItems: 6,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'citationIds'],
                properties: {
                  text: { type: 'string' },
                  citationIds: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    maxItems: 2,
                  },
                },
              },
            },
          },
          required: ['facts'],
        },
      },
    },
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You are a longevity-focused medical exercise scientist. ' +
              'You explain actionable facts and cite peer-reviewed literature. ' +
              'Keep each fact under 280 characters and avoid medical advice wording.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Profile:',
              JSON.stringify(profile),
              '\nCitations:',
              JSON.stringify(citations),
              '\nReturn 3-6 JSON facts referencing citationIds. Highlight longevity, pain reduction, adherence, or metabolic health insights.',
            ].join(' '),
          },
        ],
      },
    ],
  } satisfies JsonSchemaResponseParams & ResponseCreateParamsNonStreaming

  const response = await client.responses.parse<
    JsonSchemaResponseParams & ResponseCreateParamsNonStreaming,
    { facts: { text: string; citationIds: string[] }[] }
  >(factsRequest)

  const parsed = response.output_parsed
  if (!parsed) {
    console.warn('distillCitations: missing model output')
    return []
  }

  const factList = parsed.facts ?? []
  return factList
    .map((fact) => ({
      text: fact.text,
      citations: fact.citationIds
        .map((id) => citations.find((citation) => citation.id === id))
        .filter(Boolean) as Citation[],
    }))
    .filter((fact) => fact.text && fact.citations.length)
}

function buildSearchQuery(profile: CitationsProfile) {
  const tokens: string[] = []
  if (profile.goal) tokens.push(profile.goal)
  if (profile.activityLevel) tokens.push(`${profile.activityLevel} training`)
  if (profile.injuries.length) tokens.push(profile.injuries.join(' OR '))
  if (profile.conditions.length) tokens.push(profile.conditions.join(' OR '))
  if (profile.medications)
    tokens.push('exercise safety medication interactions')
  if (profile.smoking && profile.smoking !== 'never')
    tokens.push('smoking cardiometabolic risk intervention')
  if (profile.alcohol && profile.alcohol !== 'never')
    tokens.push('alcohol recovery inflammation')
  if (profile.timeAvailable.length)
    tokens.push(`${profile.timeAvailable.at(0)} session duration`)
  if (profile.age)
    tokens.push(`${profile.age} years old longevity training adaptations`)

  return tokens.filter(Boolean).join(' + ')
}

async function fetchPubMed(query: string): Promise<Citation[]> {
  if (!query) return []

  try {
    const searchResp = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&sort=pub+date&retmode=json&retmax=5&term=${encodeURIComponent(
        query
      )}`
    )
    const searchJson = await searchResp.json()
    const idList: string[] = searchJson?.esearchresult?.idlist ?? []
    if (!idList.length) {
      return []
    }

    const summaryResp = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${idList.join(
        ','
      )}`
    )
    const summaryJson = await summaryResp.json()
    const result = summaryJson?.result ?? {}

    return idList
      .map((id) => {
        const record = result[id]
        if (!record) return null
        const authors: string[] =
          (record.authors ?? [])
            .map((author: { name?: string }) => author.name)
            .filter(Boolean) ?? []
        const pubYear = parsePubYear(record.pubdate)
        const doi =
          typeof record.elocationid === 'string' &&
          record.elocationid.includes('doi')
            ? record.elocationid.split('doi:')[1]?.trim()
            : undefined

        return {
          id: `pubmed:${id}`,
          title: record.title,
          authors,
          year: pubYear,
          source: record.fulljournalname ?? 'PubMed',
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          doi,
          summary: record.summary ?? record.docsum,
        } as Citation
      })
      .filter(Boolean) as Citation[]
  } catch (error) {
    console.error('fetchPubMed error', error)
    return []
  }
}

async function fetchSemanticScholar(
  query: string,
  apiKey?: string
): Promise<Citation[]> {
  if (!query) return []

  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
  url.searchParams.set('query', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set(
    'fields',
    'title,year,venue,url,authors,abstract,externalIds'
  )

  try {
    await waitForSemanticScholarSlot()
    const resp = await fetch(url.toString(), {
      headers: apiKey ? { 'x-api-key': apiKey } : undefined,
    })
    if (!resp.ok) {
      console.warn('Semantic Scholar response not ok', resp.status)
      return []
    }
    const data = await resp.json()
    const papers: {
      paperId: string
      title: string
      year?: number
      venue?: string
      url?: string
      abstract?: string
      authors?: { name: string }[]
      externalIds?: { DOI?: string }
    }[] = data?.data ?? []

    return papers.map((paper) => ({
      id: `semantic:${paper.paperId}`,
      title: paper.title,
      authors: (paper.authors ?? []).map((author) => author.name),
      year: paper.year ?? new Date().getFullYear(),
      source: paper.venue || 'Semantic Scholar',
      url:
        paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      doi: paper.externalIds?.DOI,
      summary: paper.abstract,
    }))
  } catch (error) {
    console.error('fetchSemanticScholar error', error)
    return []
  }
}

async function fetchOpenAICitations(
  profile: CitationsProfile
): Promise<Citation[]> {
  try {
    const client = getOpenAI()
    const citationRequest = {
      model: 'gpt-5-mini-2025-08-07',
      tools: [{ type: 'web_search' as const }],
      text: {
        format: {
          type: 'json_schema',
          name: 'citation_results',
          schema: {
            type: 'object',
            required: ['citations'],
            additionalProperties: false,
            properties: {
              citations: {
                type: 'array',
                minItems: 3,
                maxItems: 6,
                items: {
                  type: 'object',
                  required: [
                    'title',
                    'authors',
                    'year',
                    'source',
                    'url',
                    'doi',
                    'summary',
                  ],
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    authors: {
                      type: 'array',
                      minItems: 1,
                      items: { type: 'string' },
                    },
                    year: { type: 'number' },
                    source: { type: 'string' },
                    url: { type: 'string' },
                    doi: { type: 'string' },
                    summary: { type: 'string' },
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
          content: [
            {
              type: 'input_text',
              text:
                'You are a medical research assistant. For every request you run live web searches to surface peer-reviewed exercise or longevity research. ' +
                'Return only sources from reputable journals, conferences, or government/WHO guidelines. Include direct URLs (PubMed, DOI, or journal pages). ' +
                'Do not fabricate citations. Always include a DOI when available, otherwise use "N/A". Provide a one-sentence summary per source.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Find 3-6 recent sources (≤10 years old when possible) that inform training, recovery, or longevity guidance for this profile.',
                'Profile:',
                JSON.stringify(profile),
                'For each source return: title, authors array, publication year, source (journal/conference), direct URL, doi (or "N/A"), and a 1-2 sentence summary.',
              ].join(' '),
            },
          ],
        },
      ],
    } satisfies JsonSchemaResponseParams & ResponseCreateParamsNonStreaming

    const response = await client.responses.parse<
      JsonSchemaResponseParams & ResponseCreateParamsNonStreaming,
      {
        citations: {
          title: string
          authors: string[]
          year: number
          source: string
          url: string
          doi?: string
          summary?: string
        }[]
      }
    >(citationRequest)

    const parsed = response.output_parsed
    if (!parsed?.citations?.length) {
      return []
    }

    const normalizeOptional = (value?: string) => {
      if (!value) return undefined
      const trimmed = value.trim()
      if (!trimmed) return undefined
      const lowered = trimmed.toLowerCase()
      if (['n/a', 'na', 'none', 'null', 'not available'].includes(lowered)) {
        return undefined
      }
      return trimmed
    }

    return parsed.citations
      .map((citation, index) => ({
        id: `openai:${normalizeOptional(citation.doi) ?? citation.url ?? index}`,
        title: citation.title,
        authors: citation.authors,
        year: citation.year,
        source: citation.source,
        url: citation.url,
        doi: normalizeOptional(citation.doi),
        summary: normalizeOptional(citation.summary),
      }))
      .filter(
        (citation) =>
          citation.title &&
          citation.authors?.length &&
          citation.year &&
          citation.url
      )
  } catch (error) {
    console.error('fetchOpenAICitations error', error)
    return []
  }
}

function dedupeCitations(citations: Citation[]) {
  const map = new Map<string, Citation>()

  citations.forEach((citation) => {
    const key = (citation.doi || citation.title || citation.id).toLowerCase()
    if (!map.has(key)) {
      map.set(key, citation)
    }
  })

  return Array.from(map.values())
}

function parsePubYear(pubDate?: string) {
  if (!pubDate) return new Date().getFullYear()
  const match = pubDate.match(/(19|20|21)\d{2}/)
  if (!match) return new Date().getFullYear()
  return Number(match[0])
}
