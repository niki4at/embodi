/*
 * Pure helpers for the monthly activity heatmap. Sessions arrive from Convex
 * as per-session totals; everything here runs on the client so days are
 * grouped in the device's local timezone.
 */

export type HeatmapMetric = 'minutes' | 'distance' | 'volume' | 'sessions'

export const HEATMAP_METRICS: readonly HeatmapMetric[] = [
  'minutes',
  'distance',
  'volume',
  'sessions',
] as const

export const HEATMAP_METRIC_LABELS: Record<HeatmapMetric, string> = {
  minutes: 'Minutes',
  distance: 'Distance',
  volume: 'Volume',
  sessions: 'Sessions',
}

export type ActivitySession = {
  completedAt: number
  durationMin: number
  volumeKg: number
  distanceM: number
}

export type DayTotals = {
  minutes: number
  distanceM: number
  volumeKg: number
  sessions: number
}

const EMPTY_TOTALS: DayTotals = {
  minutes: 0,
  distanceM: 0,
  volumeKg: 0,
  sessions: 0,
}

/** Local-time start (ms) of the month containing year/monthIndex. */
export function monthStartMs(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime()
}

/** Local-time range [start, end) covering one calendar month. */
export function monthRange(
  year: number,
  monthIndex: number
): { startMs: number; endMs: number } {
  return {
    startMs: monthStartMs(year, monthIndex),
    endMs: monthStartMs(
      monthIndex === 11 ? year + 1 : year,
      monthIndex === 11 ? 0 : monthIndex + 1
    ),
  }
}

/** Days in the given month (local calendar). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * Group sessions into local calendar days for one month. Returns a map of
 * day-of-month (1-based) to summed totals. Sessions outside the month are
 * ignored so a stale query window can't leak into the wrong grid.
 */
export function bucketSessionsByDay(
  sessions: readonly ActivitySession[],
  year: number,
  monthIndex: number
): Map<number, DayTotals> {
  const buckets = new Map<number, DayTotals>()
  for (const session of sessions) {
    const date = new Date(session.completedAt)
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) continue
    const day = date.getDate()
    const previous = buckets.get(day) ?? EMPTY_TOTALS
    buckets.set(day, {
      minutes: previous.minutes + session.durationMin,
      distanceM: previous.distanceM + session.distanceM,
      volumeKg: previous.volumeKg + session.volumeKg,
      sessions: previous.sessions + 1,
    })
  }
  return buckets
}

export function metricValue(totals: DayTotals, metric: HeatmapMetric): number {
  switch (metric) {
    case 'minutes':
      return totals.minutes
    case 'distance':
      return totals.distanceM
    case 'volume':
      return totals.volumeKg
    case 'sessions':
      return totals.sessions
    default: {
      const exhaustive: never = metric
      return exhaustive
    }
  }
}

/**
 * Intensity level 0-4 for a day, scaled against the month's max for the
 * selected metric so colors always use the full range of the month.
 */
export function intensityLevel(value: number, monthMax: number): number {
  if (value <= 0 || monthMax <= 0) return 0
  const ratio = value / monthMax
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/** Max metric value across a month's buckets. */
export function monthMaxValue(
  buckets: Map<number, DayTotals>,
  metric: HeatmapMetric
): number {
  let max = 0
  for (const totals of buckets.values()) {
    const value = metricValue(totals, metric)
    if (value > max) max = value
  }
  return max
}

export type UnitSystem = 'metric' | 'imperial'

const METERS_PER_MILE = 1609.344
const LB_PER_KG = 2.20462

/** Short display string for a day's metric value. */
export function formatMetricValue(
  value: number,
  metric: HeatmapMetric,
  units: UnitSystem = 'metric'
): string {
  switch (metric) {
    case 'minutes':
      return `${Math.round(value)} min`
    case 'distance': {
      if (units === 'imperial') {
        const miles = value / METERS_PER_MILE
        return miles >= 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(value * 3.28084)} ft`
      }
      return value >= 1000
        ? `${(value / 1000).toFixed(1)} km`
        : `${Math.round(value)} m`
    }
    case 'volume': {
      if (units === 'imperial') {
        const lb = value * LB_PER_KG
        return lb >= 2000
          ? `${(lb / 2000).toFixed(1)} tn`
          : `${Math.round(lb)} lb`
      }
      return value >= 1000
        ? `${(value / 1000).toFixed(1)}t`
        : `${Math.round(value)} kg`
    }
    case 'sessions':
      return `${Math.round(value)} ${value === 1 ? 'session' : 'sessions'}`
    default: {
      const exhaustive: never = metric
      return exhaustive
    }
  }
}

/** Sum of a metric across the month (for the header subtitle). */
export function monthTotalValue(
  buckets: Map<number, DayTotals>,
  metric: HeatmapMetric
): number {
  let total = 0
  for (const totals of buckets.values()) {
    total += metricValue(totals, metric)
  }
  return total
}

export type MonthGridCell = { dayOfMonth: number | null }

/**
 * Calendar grid for one month: rows of 7 cells starting on Monday, with null
 * cells padding the first and last weeks.
 */
export function buildMonthGrid(
  year: number,
  monthIndex: number
): MonthGridCell[][] {
  const totalDays = daysInMonth(year, monthIndex)
  const firstWeekday = new Date(year, monthIndex, 1).getDay() // 0 = Sunday
  const mondayOffset = (firstWeekday + 6) % 7 // 0 = Monday

  const cells: MonthGridCell[] = []
  for (let i = 0; i < mondayOffset; i += 1) {
    cells.push({ dayOfMonth: null })
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ dayOfMonth: day })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dayOfMonth: null })
  }

  const weeks: MonthGridCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}
