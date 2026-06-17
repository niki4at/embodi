import { v } from 'convex/values'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'

// ---------------------------------------------------------------------------
// Catalog seed for media matching.
//
// We can't import `constants/exercise-catalog.ts` here because it pulls in
// React Native types, so the catalogId -> search-name mapping lives as plain
// data. `search` is what we look up against the WorkoutX library; it defaults
// to the display name but is overridden where the two naming schemes diverge.
// ---------------------------------------------------------------------------
type MediaSeed = { catalogId: string; search: string }

export const CATALOG_MEDIA_SEED: MediaSeed[] = [
  // Chest
  { catalogId: 'chest-barbell-bench', search: 'barbell bench press' },
  { catalogId: 'chest-db-bench', search: 'dumbbell bench press' },
  { catalogId: 'chest-incline-db', search: 'dumbbell incline bench press' },
  { catalogId: 'chest-push-up', search: 'push up' },
  { catalogId: 'chest-incline-push-up', search: 'incline push up' },
  { catalogId: 'chest-fly', search: 'dumbbell fly' },
  { catalogId: 'chest-cable-crossover', search: 'cable cross-over' },
  { catalogId: 'chest-machine-press', search: 'lever chest press' },
  { catalogId: 'chest-dip', search: 'chest dip' },
  { catalogId: 'chest-pec-deck', search: 'lever pec deck fly' },
  { catalogId: 'chest-svend-press', search: 'svend press' },

  // Back
  { catalogId: 'back-deadlift', search: 'barbell deadlift' },
  { catalogId: 'back-bent-row', search: 'barbell bent over row' },
  { catalogId: 'back-pull-up', search: 'pull up' },
  { catalogId: 'back-lat-pulldown', search: 'cable pulldown' },
  { catalogId: 'back-seated-row', search: 'cable seated row' },
  { catalogId: 'back-db-row', search: 'dumbbell one arm row' },
  { catalogId: 'back-t-bar-row', search: 'lever t-bar row' },
  { catalogId: 'back-face-pull', search: 'cable face pull' },
  { catalogId: 'back-inverted-row', search: 'inverted row' },
  { catalogId: 'back-straight-arm', search: 'cable straight arm pulldown' },
  { catalogId: 'back-superman', search: 'superman' },

  // Shoulders
  { catalogId: 'sh-overhead-press', search: 'barbell standing military press' },
  { catalogId: 'sh-db-press', search: 'dumbbell seated shoulder press' },
  { catalogId: 'sh-lateral-raise', search: 'dumbbell lateral raise' },
  { catalogId: 'sh-front-raise', search: 'dumbbell front raise' },
  { catalogId: 'sh-rear-fly', search: 'dumbbell rear lateral raise' },
  { catalogId: 'sh-arnold-press', search: 'dumbbell arnold press' },
  { catalogId: 'sh-upright-row', search: 'barbell upright row' },
  { catalogId: 'sh-cable-lateral', search: 'cable lateral raise' },
  { catalogId: 'sh-pike-push-up', search: 'pike push up' },
  { catalogId: 'sh-landmine-press', search: 'landmine press' },

  // Arms
  { catalogId: 'arm-bb-curl', search: 'barbell curl' },
  { catalogId: 'arm-db-curl', search: 'dumbbell biceps curl' },
  { catalogId: 'arm-hammer-curl', search: 'dumbbell hammer curl' },
  { catalogId: 'arm-pushdown', search: 'cable pushdown' },
  { catalogId: 'arm-oh-extension', search: 'dumbbell one arm triceps extension' },
  { catalogId: 'arm-skull-crusher', search: 'barbell lying triceps extension skull crusher' },
  { catalogId: 'arm-concentration', search: 'dumbbell concentration curl' },
  { catalogId: 'arm-close-grip-bench', search: 'barbell close grip bench press' },
  { catalogId: 'arm-cable-curl', search: 'cable curl' },
  { catalogId: 'arm-bench-dip', search: 'bench dip' },

  // Core
  { catalogId: 'core-plank', search: 'front plank' },
  { catalogId: 'core-dead-bug', search: 'dead bug' },
  { catalogId: 'core-bird-dog', search: 'bird dog' },
  { catalogId: 'core-hanging-knee-raise', search: 'hanging knee raise' },
  { catalogId: 'core-cable-crunch', search: 'cable kneeling crunch' },
  { catalogId: 'core-russian-twist', search: 'russian twist' },
  { catalogId: 'core-side-plank', search: 'side plank' },
  { catalogId: 'core-mountain-climber', search: 'mountain climber' },
  { catalogId: 'core-hollow-hold', search: 'hollow hold' },
  { catalogId: 'core-ab-wheel', search: 'wheel rollout' },

  // Glutes
  { catalogId: 'glute-hip-thrust', search: 'barbell hip thrust' },
  { catalogId: 'glute-bridge', search: 'glute bridge' },
  { catalogId: 'glute-bulgarian', search: 'dumbbell bulgarian split squat' },
  { catalogId: 'glute-rdl', search: 'barbell romanian deadlift' },
  { catalogId: 'glute-cable-kickback', search: 'cable standing hip extension' },
  { catalogId: 'glute-step-up', search: 'dumbbell step up' },
  { catalogId: 'glute-curtsy-lunge', search: 'curtsey lunge' },
  { catalogId: 'glute-frog-pump', search: 'frog press' },
  { catalogId: 'glute-clamshell', search: 'band clam' },
  { catalogId: 'glute-sumo-deadlift', search: 'barbell sumo deadlift' },

  // Legs
  { catalogId: 'legs-back-squat', search: 'barbell full squat' },
  { catalogId: 'legs-front-squat', search: 'barbell front squat' },
  { catalogId: 'legs-goblet-squat', search: 'dumbbell goblet squat' },
  { catalogId: 'legs-leg-press', search: 'sled 45 leg press' },
  { catalogId: 'legs-walking-lunge', search: 'dumbbell walking lunge' },
  { catalogId: 'legs-leg-extension', search: 'lever leg extension' },
  { catalogId: 'legs-leg-curl', search: 'lever seated leg curl' },
  { catalogId: 'legs-calf-raise', search: 'lever standing calf raise' },
  { catalogId: 'legs-box-squat', search: 'barbell box squat' },
  { catalogId: 'legs-wall-sit', search: 'wall sit' },

  // Full body
  { catalogId: 'fb-burpee', search: 'burpee' },
  { catalogId: 'fb-kb-swing', search: 'kettlebell swing' },
  { catalogId: 'fb-clean-press', search: 'barbell clean and press' },
  { catalogId: 'fb-thruster', search: 'barbell thruster' },
  { catalogId: 'fb-devils-press', search: 'dumbbell devil press' },
  { catalogId: 'fb-turkish-get-up', search: 'kettlebell turkish get up' },
  { catalogId: 'fb-bear-crawl', search: 'bear crawl' },
  { catalogId: 'fb-man-maker', search: 'dumbbell man maker' },
  { catalogId: 'fb-wall-ball', search: 'wall ball' },
  { catalogId: 'fb-sled-push', search: 'sled push' },

  // Cardio
  { catalogId: 'cardio-treadmill-run', search: 'run' },
  { catalogId: 'cardio-incline-walk', search: 'walking on incline treadmill' },
  { catalogId: 'cardio-rower', search: 'rowing machine' },
  { catalogId: 'cardio-assault-bike', search: 'air bike' },
  { catalogId: 'cardio-cycling', search: 'stationary bike run' },
  { catalogId: 'cardio-jump-rope', search: 'jump rope' },
  { catalogId: 'cardio-stair-climber', search: 'stairmaster' },
  { catalogId: 'cardio-elliptical', search: 'elliptical machine' },
  { catalogId: 'cardio-swim', search: 'swimming' },
  { catalogId: 'cardio-shadow-box', search: 'shadow boxing' },

  // Mobility
  { catalogId: 'mob-90-90', search: '90 90 hamstring' },
  { catalogId: 'mob-thoracic-rotations', search: 'thoracic rotation' },
  { catalogId: 'mob-cat-camel', search: 'cat stretch' },
  { catalogId: 'mob-worlds-greatest', search: 'world greatest stretch' },
  { catalogId: 'mob-hip-flexor', search: 'kneeling hip flexor stretch' },
  { catalogId: 'mob-shoulder-dislocates', search: 'band shoulder dislocate' },
  { catalogId: 'mob-ankle-rocks', search: 'ankle circles' },
  { catalogId: 'mob-couch-stretch', search: 'couch stretch' },
  { catalogId: 'mob-deep-squat-hold', search: 'deep squat hold' },
  { catalogId: 'mob-downward-dog', search: 'downward dog' },

  // Recovery
  { catalogId: 'rec-box-breathing', search: 'breathing' },
  { catalogId: 'rec-foam-roll-quads', search: 'foam roll quads' },
  { catalogId: 'rec-foam-roll-back', search: 'foam roll upper back' },
  { catalogId: 'rec-diaphragmatic', search: 'diaphragmatic breathing' },
  { catalogId: 'rec-legs-up-wall', search: 'legs up the wall' },
  { catalogId: 'rec-childs-pose', search: 'childs pose' },
  { catalogId: 'rec-foam-roll-calf', search: 'foam roll calves' },
  { catalogId: 'rec-body-scan', search: 'body scan' },
  { catalogId: 'rec-neck-release', search: 'neck stretch' },
  { catalogId: 'rec-pigeon-pose', search: 'pigeon pose' },
]

const WORKOUTX_BASE = 'https://api.workoutxapp.com/v1'
const ATTRIBUTION = 'Demo & how-to via WorkoutX'

type WorkoutXExercise = {
  id: string
  name: string
  bodyPart?: string
  target?: string
  equipment?: string
  secondaryMuscles?: string[]
  instructions?: string[]
  gifUrl?: string
  difficulty?: string
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean)
}

// Token-overlap score in [0, 1] biased toward covering the search query's
// words. Used as a fallback when there is no exact normalized name match.
function matchScore(search: string, candidate: string): number {
  const a = tokens(search)
  const b = new Set(tokens(candidate))
  if (a.length === 0) return 0
  let hits = 0
  for (const token of a) if (b.has(token)) hits += 1
  return hits / a.length
}

function pickMatch(
  search: string,
  index: Map<string, WorkoutXExercise>,
  all: WorkoutXExercise[]
): WorkoutXExercise | null {
  const normalizedSearch = normalize(search)
  const exact = index.get(normalizedSearch)
  if (exact) return exact

  let best: WorkoutXExercise | null = null
  let bestScore = 0
  for (const candidate of all) {
    const score = matchScore(search, candidate.name)
    // Require every query word for short queries; allow strong overlap for long ones.
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return bestScore >= 0.5 ? best : null
}

// Progressive lookup terms for a seed: the full phrase first (most precise),
// then the trailing movement phrase and bare movement word as fallbacks. The
// WorkoutX `name` endpoint does contiguous substring matching, so shorter
// trailing phrases ("military press") match names the full phrase
// ("barbell standing military press") would miss.
function lookupTerms(search: string): string[] {
  const toks = search.split(' ').filter(Boolean)
  const terms: string[] = [search]
  // One broad fallback (the trailing movement phrase) is enough — the full
  // phrase resolves most seeds, and keeping the list short conserves the
  // free plan's request budget.
  if (toks.length > 2) terms.push(toks.slice(-2).join(' '))
  else if (toks.length > 1) terms.push(toks[toks.length - 1])
  return [...new Set(terms)]
}

// ---------------------------------------------------------------------------
// Public read query consumed by the app.
// ---------------------------------------------------------------------------
export const getExerciseMedia = query({
  args: { catalogId: v.string() },
  returns: v.union(
    v.object({
      catalogId: v.string(),
      gifUrl: v.union(v.string(), v.null()),
      target: v.union(v.string(), v.null()),
      secondaryMuscles: v.array(v.string()),
      instructions: v.array(v.string()),
      difficulty: v.union(v.string(), v.null()),
      attribution: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { catalogId }) => {
    const media = await ctx.db
      .query('exercise_media')
      .withIndex('by_catalogId', (q) => q.eq('catalogId', catalogId))
      .first()
    if (!media) return null

    // Only ever surface a rehosted storage URL. Raw WorkoutX GIF URLs are
    // auth-gated (401 without the API key), so they can't render in a client
    // <Image>; fall back to the icon instead of a broken image.
    const gifUrl: string | null = media.gifStorageId
      ? await ctx.storage.getUrl(media.gifStorageId)
      : null

    return {
      catalogId: media.catalogId,
      gifUrl,
      target: media.target ?? null,
      secondaryMuscles: media.secondaryMuscles,
      instructions: media.instructions,
      difficulty: media.difficulty ?? null,
      attribution: media.attribution,
    }
  },
})

// Lightweight map of every exercise that has a rehosted GIF, for showing
// thumbnails in the library list. Only stored (non-auth-gated) URLs are
// returned so the client never gets a 401 image.
export const listExerciseMedia = query({
  args: {},
  returns: v.array(
    v.object({
      catalogId: v.string(),
      gifUrl: v.string(),
    })
  ),
  handler: async (ctx) => {
    const all = await ctx.db.query('exercise_media').collect()
    const out: { catalogId: string; gifUrl: string }[] = []
    for (const media of all) {
      if (!media.gifStorageId) continue
      const gifUrl = await ctx.storage.getUrl(media.gifStorageId)
      if (gifUrl) out.push({ catalogId: media.catalogId, gifUrl })
    }
    return out
  },
})

export const getExistingMedia = internalQuery({
  args: { catalogId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('exercise_media'),
      gifStorageId: v.optional(v.id('_storage')),
    }),
    v.null()
  ),
  handler: async (ctx, { catalogId }) => {
    const media = await ctx.db
      .query('exercise_media')
      .withIndex('by_catalogId', (q) => q.eq('catalogId', catalogId))
      .first()
    if (!media) return null
    return { _id: media._id, gifStorageId: media.gifStorageId }
  },
})

export const upsertExerciseMedia = internalMutation({
  args: {
    catalogId: v.string(),
    source: v.string(),
    gifStorageId: v.optional(v.id('_storage')),
    externalGifUrl: v.optional(v.string()),
    target: v.optional(v.string()),
    secondaryMuscles: v.array(v.string()),
    instructions: v.array(v.string()),
    difficulty: v.optional(v.string()),
    attribution: v.string(),
    matchedName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('exercise_media')
      .withIndex('by_catalogId', (q) => q.eq('catalogId', args.catalogId))
      .first()

    const payload = {
      catalogId: args.catalogId,
      source: args.source,
      gifStorageId: args.gifStorageId,
      externalGifUrl: args.externalGifUrl,
      target: args.target,
      secondaryMuscles: args.secondaryMuscles,
      instructions: args.instructions,
      difficulty: args.difficulty,
      attribution: args.attribution,
      matchedName: args.matchedName,
      updatedAt: Date.now(),
    }

    if (existing) {
      // Free the old asset when we replace it so storage doesn't leak.
      if (
        existing.gifStorageId &&
        existing.gifStorageId !== args.gifStorageId
      ) {
        await ctx.storage.delete(existing.gifStorageId)
      }
      await ctx.db.patch(existing._id, payload)
    } else {
      await ctx.db.insert('exercise_media', payload)
    }
    return null
  },
})

// ---------------------------------------------------------------------------
// One-time sync. Run from the Convex dashboard ("Run function") after setting
// WORKOUTX_API_KEY in the deployment's environment. Re-runnable and idempotent.
//
// Budget: 1 list request + 1 GIF download per matched exercise (~111 total),
// comfortably inside the WorkoutX free tier of 500 requests/month.
// ---------------------------------------------------------------------------
export const syncExerciseMedia = action({
  args: {
    // Optional: only sync these catalogIds (handy for re-trying misses).
    onlyCatalogIds: v.optional(v.array(v.string())),
    // Skip GIF download (metadata only) to save the request budget.
    skipGifs: v.optional(v.boolean()),
  },
  returns: v.object({
    fetched: v.number(),
    matched: v.number(),
    storedGifs: v.number(),
    skipped: v.number(),
    misses: v.array(v.string()),
  }),
  handler: async (ctx, { onlyCatalogIds, skipGifs }) => {
    const apiKey = process.env.WORKOUTX_API_KEY
    if (!apiKey) {
      throw new Error('WORKOUTX_API_KEY is not configured')
    }

    const headers = { 'X-WorkoutX-Key': apiKey }

    // The free plan allows 30 requests/min. Pace every call to stay under
    // that ceiling and retry on 429 so a burst never silently turns matches
    // into misses.
    const MIN_INTERVAL_MS = 2200
    let lastRequestAt = 0
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms))
    const request = async (url: string): Promise<Response | null> => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt)
        if (wait > 0) await sleep(wait)
        lastRequestAt = Date.now()

        const res = await fetch(url, { headers })
        if (res.status === 401 || res.status === 403) {
          throw new Error(`WorkoutX auth failed: ${res.status}`)
        }
        if (res.status === 429) {
          // Per-minute window — wait it out and retry the same URL.
          await sleep(8000)
          continue
        }
        return res
      }
      return null
    }

    const seeds = onlyCatalogIds
      ? CATALOG_MEDIA_SEED.filter((s) => onlyCatalogIds.includes(s.catalogId))
      : CATALOG_MEDIA_SEED

    let fetched = 0
    let matched = 0
    let storedGifs = 0
    let skipped = 0
    const misses: string[] = []

    for (const seed of seeds) {
      // Idempotent top-up: if this catalogId already has a rehosted GIF,
      // leave it alone so re-runs only spend budget on gaps (missing GIFs or
      // unmatched seeds) instead of re-downloading everything.
      const existing = await ctx.runQuery(
        internal.exerciseMedia.getExistingMedia,
        { catalogId: seed.catalogId }
      )
      if (existing?.gifStorageId) {
        skipped += 1
        continue
      }

      // Look each seed up by name instead of pulling the whole catalog: the
      // free plan caps page size at 10, and per-seed lookups keep us inside
      // the request budget. Try the full phrase, then a broad fallback, and
      // stop at the first confident match. Both bare-array and
      // { data: [...] } envelopes are handled.
      let found: WorkoutXExercise | null = null
      for (const term of lookupTerms(seed.search)) {
        let candidates: WorkoutXExercise[] = []
        try {
          const res = await request(
            `${WORKOUTX_BASE}/exercises/name/${encodeURIComponent(term)}`
          )
          if (res && res.ok) {
            const json: unknown = await res.json()
            candidates = Array.isArray(json)
              ? (json as WorkoutXExercise[])
              : ((json as { data?: WorkoutXExercise[] }).data ?? [])
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith('WorkoutX auth')
          ) {
            throw error
          }
          console.error(
            `WorkoutX name lookup failed for ${seed.catalogId}`,
            error
          )
        }
        fetched += candidates.length
        if (candidates.length === 0) continue

        const index = new Map<string, WorkoutXExercise>()
        for (const item of candidates) {
          if (item.name) index.set(normalize(item.name), item)
        }
        found = pickMatch(seed.search, index, candidates)
        if (found) break
      }

      if (!found) {
        misses.push(seed.catalogId)
        continue
      }
      matched += 1

      let gifStorageId: Id<'_storage'> | undefined
      let externalGifUrl: string | undefined = found.gifUrl

      if (!skipGifs && found.gifUrl) {
        try {
          const gifRes = await request(found.gifUrl)
          if (gifRes && gifRes.ok) {
            const blob = await gifRes.blob()
            gifStorageId = await ctx.storage.store(blob)
            storedGifs += 1
          }
        } catch (error) {
          console.error(`GIF download failed for ${seed.catalogId}`, error)
        }
      }

      await ctx.runMutation(internal.exerciseMedia.upsertExerciseMedia, {
        catalogId: seed.catalogId,
        source: 'workoutx',
        gifStorageId,
        externalGifUrl: gifStorageId ? undefined : externalGifUrl,
        target: found.target,
        secondaryMuscles: found.secondaryMuscles ?? [],
        instructions: found.instructions ?? [],
        difficulty: found.difficulty,
        attribution: ATTRIBUTION,
        matchedName: found.name,
      })
    }

    return { fetched, matched, storedGifs, skipped, misses }
  },
})
