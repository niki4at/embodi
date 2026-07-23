import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import {
  HEATMAP_METRICS,
  HEATMAP_METRIC_LABELS,
  bucketSessionsByDay,
  buildMonthGrid,
  formatMetricValue,
  intensityLevel,
  metricValue,
  monthMaxValue,
  monthRange,
  monthTotalValue,
  type HeatmapMetric,
} from '@/utils/activity-heatmap'

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** How far back the heatmap can page. */
const MAX_MONTHS_BACK = 24

type MonthCursor = { year: number; monthIndex: number }

function currentMonth(): MonthCursor {
  const now = new Date()
  return { year: now.getFullYear(), monthIndex: now.getMonth() }
}

function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + cursor.monthIndex + delta
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 }
}

function monthsBetween(a: MonthCursor, b: MonthCursor): number {
  return b.year * 12 + b.monthIndex - (a.year * 12 + a.monthIndex)
}

/**
 * GitHub-style monthly heatmap. Swipe (or use the chevrons) to move between
 * months; the metric row switches what the colors encode.
 */
export function ActivityHeatmap() {
  const { palette, resolved } = useTheme()
  const [cursor, setCursor] = useState<MonthCursor>(currentMonth)
  const [metric, setMetric] = useState<HeatmapMetric>('minutes')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const settings = useQuery(api.userSettings.get)
  const units = settings?.units ?? 'metric'

  const range = useMemo(
    () => monthRange(cursor.year, cursor.monthIndex),
    [cursor]
  )
  const sessions = useQuery(api.profileSummary.getMonthlyActivity, {
    rangeStartMs: range.startMs,
    rangeEndMs: range.endMs,
  })

  const buckets = useMemo(
    () => bucketSessionsByDay(sessions ?? [], cursor.year, cursor.monthIndex),
    [sessions, cursor]
  )
  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.monthIndex),
    [cursor]
  )
  const maxValue = useMemo(
    () => monthMaxValue(buckets, metric),
    [buckets, metric]
  )
  const monthTotal = useMemo(
    () => monthTotalValue(buckets, metric),
    [buckets, metric]
  )

  const today = currentMonth()
  const canGoForward = monthsBetween(cursor, today) > 0
  const canGoBack = monthsBetween(shiftMonth(today, -MAX_MONTHS_BACK), cursor) > 0

  const goToMonth = useCallback((delta: number) => {
    Haptics.selectionAsync()
    setSelectedDay(null)
    setCursor((prev) => shiftMonth(prev, delta))
  }, [])

  const goBack = useCallback(() => {
    if (canGoBack) goToMonth(-1)
  }, [canGoBack, goToMonth])

  const goForward = useCallback(() => {
    if (canGoForward) goToMonth(1)
  }, [canGoForward, goToMonth])

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          'worklet'
          if (event.translationX <= -32) {
            runOnJS(goForward)()
          } else if (event.translationX >= 32) {
            runOnJS(goBack)()
          }
        }),
    [goBack, goForward]
  )

  const levelColors = useMemo(
    () =>
      resolved === 'dark'
        ? [
            palette.surfaceAlt,
            'rgba(255, 122, 122, 0.25)',
            'rgba(255, 122, 122, 0.45)',
            'rgba(255, 122, 122, 0.7)',
            palette.primary,
          ]
        : [
            palette.surfaceAlt,
            'rgba(255, 107, 107, 0.22)',
            'rgba(255, 107, 107, 0.42)',
            'rgba(255, 107, 107, 0.68)',
            palette.primary,
          ],
    [palette, resolved]
  )

  const selectedTotals = selectedDay != null ? buckets.get(selectedDay) : null

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={goBack}
          disabled={!canGoBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={{ opacity: canGoBack ? 1 : 0.3 }}
        >
          <IconSymbol name="chevron.left" size={18} color={palette.textSecondary} />
        </TouchableOpacity>
        <View style={styles.monthCenter}>
          <Text style={[styles.monthTitle, { color: palette.textPrimary }]}>
            {MONTH_LABELS[cursor.monthIndex]} {cursor.year}
          </Text>
          <Text style={[styles.monthTotal, { color: palette.textSecondary }]}>
            {sessions === undefined
              ? 'Loading…'
              : monthTotal > 0
                ? formatMetricValue(monthTotal, metric, units)
                : 'No sessions yet'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={goForward}
          disabled={!canGoForward}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={{ opacity: canGoForward ? 1 : 0.3 }}
        >
          <IconSymbol name="chevron.right" size={18} color={palette.textSecondary} />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={swipe}>
        <View>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text
                key={`${label}-${index}`}
                style={[styles.weekdayLabel, { color: palette.textTertiary }]}
              >
                {label}
              </Text>
            ))}
          </View>
          {grid.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((cell, cellIndex) => {
                if (cell.dayOfMonth === null) {
                  return <View key={cellIndex} style={styles.dayCellEmpty} />
                }
                const totals = buckets.get(cell.dayOfMonth)
                const value = totals ? metricValue(totals, metric) : 0
                const level = intensityLevel(value, maxValue)
                const isSelected = selectedDay === cell.dayOfMonth
                return (
                  <TouchableOpacity
                    key={cellIndex}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setSelectedDay(
                        isSelected ? null : (cell.dayOfMonth as number)
                      )
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${MONTH_LABELS[cursor.monthIndex]} ${cell.dayOfMonth}: ${
                      totals ? formatMetricValue(value, metric, units) : 'rest day'
                    }`}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: levelColors[level],
                        borderColor: isSelected
                          ? palette.textPrimary
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color:
                            level >= 3
                              ? palette.white
                              : palette.textTertiary,
                        },
                      ]}
                    >
                      {cell.dayOfMonth}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}
        </View>
      </GestureDetector>

      {selectedDay != null ? (
        <Text style={[styles.selectedText, { color: palette.textSecondary }]}>
          {MONTH_LABELS[cursor.monthIndex]} {selectedDay} ·{' '}
          {selectedTotals
            ? `${formatMetricValue(metricValue(selectedTotals, metric), metric, units)} · ${selectedTotals.sessions} ${selectedTotals.sessions === 1 ? 'session' : 'sessions'}`
            : 'Rest day'}
        </Text>
      ) : null}

      <View style={styles.metricRow}>
        {HEATMAP_METRICS.map((option) => {
          const active = option === metric
          return (
            <TouchableOpacity
              key={option}
              onPress={() => {
                Haptics.selectionAsync()
                setMetric(option)
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${HEATMAP_METRIC_LABELS[option]}`}
              style={[
                styles.metricChip,
                {
                  backgroundColor: active
                    ? palette.primaryMuted
                    : palette.surfaceAlt,
                  borderColor: active ? palette.primaryBorder : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.metricChipLabel,
                  {
                    color: active ? palette.primary : palette.textSecondary,
                  },
                ]}
              >
                {HEATMAP_METRIC_LABELS[option]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthTitle: {
    ...typography.bodyStrong,
  },
  monthTotal: {
    ...typography.small,
    fontSize: 12,
    marginTop: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    fontSize: 10,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellEmpty: {
    flex: 1,
    aspectRatio: 1,
  },
  dayNumber: {
    ...typography.small,
    fontSize: 10,
    lineHeight: 12,
  },
  selectedText: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  metricChipLabel: {
    ...typography.smallStrong,
    fontSize: 12,
  },
})
