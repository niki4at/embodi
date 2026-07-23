import { describe, expect, test } from 'vitest'

import {
  bucketSessionsByDay,
  buildMonthGrid,
  daysInMonth,
  formatMetricValue,
  intensityLevel,
  metricValue,
  monthMaxValue,
  monthRange,
  monthTotalValue,
  type ActivitySession,
} from './activity-heatmap'

function sessionAt(
  year: number,
  monthIndex: number,
  day: number,
  hour = 12,
  overrides: Partial<ActivitySession> = {}
): ActivitySession {
  return {
    completedAt: new Date(year, monthIndex, day, hour).getTime(),
    durationMin: 30,
    volumeKg: 1000,
    distanceM: 2000,
    ...overrides,
  }
}

describe('monthRange', () => {
  test('covers the full month including December rollover', () => {
    const june = monthRange(2026, 5)
    expect(new Date(june.startMs).getMonth()).toBe(5)
    expect(new Date(june.endMs).getMonth()).toBe(6)

    const december = monthRange(2026, 11)
    expect(new Date(december.endMs).getFullYear()).toBe(2027)
    expect(new Date(december.endMs).getMonth()).toBe(0)
  })
})

describe('bucketSessionsByDay', () => {
  test('groups sessions into local calendar days', () => {
    const buckets = bucketSessionsByDay(
      [
        sessionAt(2026, 6, 3, 9),
        sessionAt(2026, 6, 3, 19, { durationMin: 20 }),
        sessionAt(2026, 6, 15),
      ],
      2026,
      6
    )
    expect(buckets.get(3)?.sessions).toBe(2)
    expect(buckets.get(3)?.minutes).toBe(50)
    expect(buckets.get(15)?.sessions).toBe(1)
    expect(buckets.get(4)).toBeUndefined()
  })

  test('local day boundaries: 23:59 and 00:00 land on different days', () => {
    const buckets = bucketSessionsByDay(
      [
        { ...sessionAt(2026, 6, 3), completedAt: new Date(2026, 6, 3, 23, 59).getTime() },
        { ...sessionAt(2026, 6, 4), completedAt: new Date(2026, 6, 4, 0, 0).getTime() },
      ],
      2026,
      6
    )
    expect(buckets.get(3)?.sessions).toBe(1)
    expect(buckets.get(4)?.sessions).toBe(1)
  })

  test('ignores sessions outside the month', () => {
    const buckets = bucketSessionsByDay(
      [sessionAt(2026, 5, 30), sessionAt(2026, 7, 1)],
      2026,
      6
    )
    expect(buckets.size).toBe(0)
  })
})

describe('metric totals and intensity', () => {
  const buckets = bucketSessionsByDay(
    [
      sessionAt(2026, 6, 1, 12, { durationMin: 10 }),
      sessionAt(2026, 6, 2, 12, { durationMin: 40 }),
      sessionAt(2026, 6, 3, 12, { durationMin: 100 }),
    ],
    2026,
    6
  )

  test('metricValue reads the selected metric', () => {
    expect(metricValue(buckets.get(2)!, 'minutes')).toBe(40)
    expect(metricValue(buckets.get(2)!, 'sessions')).toBe(1)
    expect(metricValue(buckets.get(2)!, 'volume')).toBe(1000)
    expect(metricValue(buckets.get(2)!, 'distance')).toBe(2000)
  })

  test('monthMaxValue and monthTotalValue', () => {
    expect(monthMaxValue(buckets, 'minutes')).toBe(100)
    expect(monthTotalValue(buckets, 'minutes')).toBe(150)
  })

  test('intensityLevel scales 0-4 against the month max', () => {
    expect(intensityLevel(0, 100)).toBe(0)
    expect(intensityLevel(10, 100)).toBe(1)
    expect(intensityLevel(40, 100)).toBe(2)
    expect(intensityLevel(75, 100)).toBe(3)
    expect(intensityLevel(100, 100)).toBe(4)
    expect(intensityLevel(5, 0)).toBe(0)
  })
})

describe('formatMetricValue', () => {
  test('formats each metric with sensible units', () => {
    expect(formatMetricValue(45, 'minutes')).toBe('45 min')
    expect(formatMetricValue(2500, 'distance')).toBe('2.5 km')
    expect(formatMetricValue(800, 'distance')).toBe('800 m')
    expect(formatMetricValue(1500, 'volume')).toBe('1.5t')
    expect(formatMetricValue(600, 'volume')).toBe('600 kg')
    expect(formatMetricValue(1, 'sessions')).toBe('1 session')
    expect(formatMetricValue(3, 'sessions')).toBe('3 sessions')
  })

  test('converts distance and volume for imperial users', () => {
    expect(formatMetricValue(1609.344, 'distance', 'imperial')).toBe('1.0 mi')
    expect(formatMetricValue(20, 'distance', 'imperial')).toBe('66 ft')
    expect(formatMetricValue(100, 'volume', 'imperial')).toBe('220 lb')
    expect(formatMetricValue(1000, 'volume', 'imperial')).toBe('1.1 tn')
    // Minutes and sessions are unit-agnostic.
    expect(formatMetricValue(45, 'minutes', 'imperial')).toBe('45 min')
    expect(formatMetricValue(2, 'sessions', 'imperial')).toBe('2 sessions')
  })
})

describe('buildMonthGrid', () => {
  test('pads to full Monday-start weeks and covers every day', () => {
    // July 2026 starts on a Wednesday and has 31 days.
    const grid = buildMonthGrid(2026, 6)
    expect(daysInMonth(2026, 6)).toBe(31)
    for (const week of grid) {
      expect(week).toHaveLength(7)
    }
    const days = grid.flat().filter((cell) => cell.dayOfMonth !== null)
    expect(days).toHaveLength(31)
    // Wednesday start means two leading blanks (Mon, Tue).
    expect(grid[0][0].dayOfMonth).toBeNull()
    expect(grid[0][1].dayOfMonth).toBeNull()
    expect(grid[0][2].dayOfMonth).toBe(1)
  })
})
