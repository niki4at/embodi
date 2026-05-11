import { v } from 'convex/values'
import {
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'

// ---------- Shared types & helpers ----------

const flowArg = v.union(
  v.literal('light'),
  v.literal('medium'),
  v.literal('heavy')
)

export type Flow = 'light' | 'medium' | 'heavy'

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'unknown'

export type CycleEntry = {
  _id: string
  startDate: number
  endDate?: number
  flow?: Flow
  symptoms?: string[]
  notes?: string
}

export type CycleStatus = {
  phase: CyclePhase
  // 1-based day in the current cycle. null when we have no data.
  dayOfCycle: number | null
  // Best estimate of cycle length, defaulting to 28 when we lack 2+ entries.
  averageCycleLength: number
  // ms of the most recent period start. null if no entries yet.
  lastStartDate: number | null
  // ms of the most recent period end (if user logged it).
  lastEndDate: number | null
  // True when we have at least one logged cycle.
  hasData: boolean
  // True when we have 2+ starts and can compute an average.
  hasAverage: boolean
  // Predicted start of the next period. null without enough data.
  predictedNextStart: number | null
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_CYCLE_LENGTH = 28
// Clamp average cycle length to a sane medical range so a single weird
// gap (e.g. user forgot to log) doesn't push predictions years out.
const MIN_CYCLE_LENGTH = 21
const MAX_CYCLE_LENGTH = 45

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function clampCycleLength(length: number): number {
  if (!Number.isFinite(length)) return DEFAULT_CYCLE_LENGTH
  return Math.min(Math.max(Math.round(length), MIN_CYCLE_LENGTH), MAX_CYCLE_LENGTH)
}

/**
 * Pure helper: given a list of cycle entries (most recent first) and a "now"
 * timestamp, compute the user's current phase. Exported so the trainer action
 * can call it directly with Date.now() and the client can call it with the
 * device clock without making the query itself time-dependent.
 */
export function computeCycleStatus(
  entries: CycleEntry[],
  nowMs: number
): CycleStatus {
  if (entries.length === 0) {
    return {
      phase: 'unknown',
      dayOfCycle: null,
      averageCycleLength: DEFAULT_CYCLE_LENGTH,
      lastStartDate: null,
      lastEndDate: null,
      hasData: false,
      hasAverage: false,
      predictedNextStart: null,
    }
  }

  // Entries should already be sorted most-recent first, but defend against drift.
  const sorted = [...entries].sort((a, b) => b.startDate - a.startDate)
  const last = sorted[0]

  let averageCycleLength = DEFAULT_CYCLE_LENGTH
  let hasAverage = false
  if (sorted.length >= 2) {
    const gaps: number[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapDays = Math.round(
        (sorted[i].startDate - sorted[i + 1].startDate) / ONE_DAY_MS
      )
      if (gapDays >= MIN_CYCLE_LENGTH && gapDays <= MAX_CYCLE_LENGTH) {
        gaps.push(gapDays)
      }
    }
    if (gaps.length > 0) {
      const avg = gaps.reduce((sum, g) => sum + g, 0) / gaps.length
      averageCycleLength = clampCycleLength(avg)
      hasAverage = true
    }
  }

  const daysSinceStart = Math.floor(
    (nowMs - last.startDate) / ONE_DAY_MS
  )
  const dayOfCycle = daysSinceStart + 1 // 1-based

  // If we're past one full predicted cycle, we don't actually know the
  // current phase — the user is likely overdue or forgot to log. Surface that.
  if (daysSinceStart >= averageCycleLength + 5) {
    return {
      phase: 'unknown',
      dayOfCycle,
      averageCycleLength,
      lastStartDate: last.startDate,
      lastEndDate: last.endDate ?? null,
      hasData: true,
      hasAverage,
      predictedNextStart: last.startDate + averageCycleLength * ONE_DAY_MS,
    }
  }

  const phase = phaseForDay(dayOfCycle, averageCycleLength, last.endDate, last.startDate)

  return {
    phase,
    dayOfCycle,
    averageCycleLength,
    lastStartDate: last.startDate,
    lastEndDate: last.endDate ?? null,
    hasData: true,
    hasAverage,
    predictedNextStart: last.startDate + averageCycleLength * ONE_DAY_MS,
  }
}

function phaseForDay(
  dayOfCycle: number,
  cycleLength: number,
  lastEndDate: number | undefined,
  lastStartDate: number
): CyclePhase {
  // Menstrual phase: while the period is logged as ongoing, OR for the first
  // ~5 days of the cycle if the user hasn't yet logged an end date.
  const menstrualEndDay = lastEndDate
    ? Math.max(
        1,
        Math.round((lastEndDate - lastStartDate) / ONE_DAY_MS) + 1
      )
    : 5

  if (dayOfCycle <= menstrualEndDay) return 'menstrual'

  // Ovulation usually happens ~14 days BEFORE the next period regardless of
  // total cycle length — that's the more accurate model than fixed day 14.
  const ovulationDay = Math.max(menstrualEndDay + 1, cycleLength - 14)
  const ovulatoryWindowStart = ovulationDay - 1
  const ovulatoryWindowEnd = ovulationDay + 1

  if (dayOfCycle < ovulatoryWindowStart) return 'follicular'
  if (dayOfCycle <= ovulatoryWindowEnd) return 'ovulatory'
  return 'luteal'
}

/**
 * Format a cycle status object for inclusion in the trainer's system prompt.
 * Returns an empty string when the user has no data so we don't fabricate
 * guidance from nothing.
 */
export function formatCycleForPrompt(status: CycleStatus): string {
  if (!status.hasData) return ''

  const phaseGuidance: Record<CyclePhase, string> = {
    menstrual:
      'Menstrual phase — energy and grip strength may be lower. Favor lower-intensity strength, mobility, and breathwork. Reduce overall volume by 10-20%. Avoid long inversions if cramping. Honor the user if they want to push; do not override their stated check-in.',
    follicular:
      'Follicular phase — rising estrogen often means improved recovery and pain tolerance. Good window for progressive overload, technique work, and harder cardio if the check-in supports it.',
    ovulatory:
      'Ovulatory window — peak strength and power output for many people. Excellent for PR attempts, heavy lifts, and high-intensity intervals. Keep an eye on joint laxity; favor stable, well-grooved patterns at the heaviest loads.',
    luteal:
      'Luteal phase — body temperature is higher and perceived exertion can climb. Strength is still solid in early luteal; in late luteal favor moderate intensity, longer rest periods, and prioritize sleep/hydration cues. Expect more fatigue 5-7 days before the next period.',
    unknown:
      'Cycle phase is uncertain — the user may be overdue or has not logged recently. Treat as neutral and rely on the check-in for intensity decisions.',
  }

  const lines = [
    `MENSTRUAL CYCLE CONTEXT (user opted in to cycle-aware programming):`,
    `- Current phase: ${status.phase}`,
    status.dayOfCycle !== null
      ? `- Day of cycle: ${status.dayOfCycle} of ~${status.averageCycleLength}`
      : null,
    `- Average cycle length${status.hasAverage ? '' : ' (default, not yet learned)'}: ${status.averageCycleLength} days`,
    `- Programming guidance: ${phaseGuidance[status.phase]}`,
    '',
    'IMPORTANT: Cycle phase is one input among many. The user\'s explicit check-in (energy, pain, intensity preference) takes priority. Use cycle phase to nudge programming, not override the user.',
  ].filter(Boolean) as string[]

  return lines.join('\n')
}

// ---------- Internal data fetch ----------

async function fetchRecentEntries(
  ctx: QueryCtx,
  userId: string,
  limit = 12
): Promise<CycleEntry[]> {
  const rows = await ctx.db
    .query('cycle_entries')
    .withIndex('by_userId_startDate', (q) => q.eq('userId', userId))
    .order('desc')
    .take(limit)

  return rows.map((r) => ({
    _id: String(r._id),
    startDate: r.startDate,
    endDate: r.endDate,
    flow: r.flow,
    symptoms: r.symptoms,
    notes: r.notes,
  }))
}

// ---------- Mutations ----------

export const logPeriodStart = mutation({
  args: {
    startDate: v.optional(v.number()), // defaults to today (local midnight)
    flow: v.optional(flowArg),
    symptoms: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { startDate, flow, symptoms, notes }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const start = startOfLocalDay(startDate ?? Date.now())

    // Prevent duplicate entries on the same calendar day.
    const sameDay = await ctx.db
      .query('cycle_entries')
      .withIndex('by_userId_startDate', (q) =>
        q.eq('userId', identity.subject).eq('startDate', start)
      )
      .first()
    if (sameDay) {
      // Treat re-log as an update to flow/symptoms/notes instead of a duplicate.
      await ctx.db.patch(sameDay._id, {
        flow: flow ?? sameDay.flow,
        symptoms: symptoms ?? sameDay.symptoms,
        notes: notes ?? sameDay.notes,
      })
      return sameDay._id
    }

    return await ctx.db.insert('cycle_entries', {
      userId: identity.subject,
      startDate: start,
      flow,
      symptoms,
      notes,
      createdAt: Date.now(),
    })
  },
})

export const markPeriodEnded = mutation({
  args: {
    entryId: v.optional(v.id('cycle_entries')),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, { entryId, endDate }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const end = startOfLocalDay(endDate ?? Date.now())

    let entry
    if (entryId) {
      entry = await ctx.db.get(entryId)
      if (!entry || entry.userId !== identity.subject) {
        throw new Error('Cycle entry not found')
      }
    } else {
      // Default: most recent entry without an end date.
      const recent = await ctx.db
        .query('cycle_entries')
        .withIndex('by_userId_startDate', (q) =>
          q.eq('userId', identity.subject)
        )
        .order('desc')
        .take(5)
      entry = recent.find((r) => r.endDate === undefined)
      if (!entry) {
        throw new Error('No open period to close')
      }
    }

    if (end < entry.startDate) {
      throw new Error('End date must be on or after the start date')
    }

    await ctx.db.patch(entry._id, { endDate: end })
    return entry._id
  },
})

export const deleteCycleEntry = mutation({
  args: { entryId: v.id('cycle_entries') },
  handler: async (ctx, { entryId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    const entry = await ctx.db.get(entryId)
    if (!entry || entry.userId !== identity.subject) {
      throw new Error('Cycle entry not found')
    }
    await ctx.db.delete(entryId)
  },
})

// ---------- Queries ----------

/**
 * Returns recent entries plus a learned average cycle length. The query stays
 * cache-friendly (no Date.now()) — the client computes the live phase via
 * `computeCycleStatus(entries, Date.now())`.
 */
export const getRecentEntries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    { limit }
  ): Promise<{
    entries: CycleEntry[]
    averageCycleLength: number
    hasAverage: boolean
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return {
        entries: [],
        averageCycleLength: DEFAULT_CYCLE_LENGTH,
        hasAverage: false,
      }
    }

    const entries = await fetchRecentEntries(ctx, identity.subject, limit ?? 12)
    // Reuse status helper at epoch 0 just to derive average (phase is ignored).
    const tmp = computeCycleStatus(entries, entries[0]?.startDate ?? 0)
    return {
      entries,
      averageCycleLength: tmp.averageCycleLength,
      hasAverage: tmp.hasAverage,
    }
  },
})

/**
 * Internal query for the trainer action: pulls raw entries by userId so we can
 * compute the phase server-side at session-generation time.
 */
export const getCycleEntriesByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<CycleEntry[]> => {
    return await fetchRecentEntries(ctx, userId, 12)
  },
})
