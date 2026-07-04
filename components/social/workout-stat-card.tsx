import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { fonts } from '@/constants/fonts'
import { radius, spacing, typography } from '@/constants/design'

import type { PostWorkout } from './types'

const GRADIENTS: [string, string][] = [
  ['#FF6B6B', '#B44BD1'],
  ['#5B7CFA', '#38C6C0'],
  ['#F5A623', '#F55D8D'],
  ['#22B07D', '#3E7BD6'],
  ['#8B5CF6', '#EC4899'],
]

function gradientFor(seed: string): [string, string] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(Math.round(meters / 100) / 10).toLocaleString()} km`
    : `${meters.toLocaleString()} m`
}

/**
 * The gradient stat hero rendered on workout posts (and as the composer
 * preview) when there are no photos — a designed card, not a form dump.
 */
export function WorkoutStatCard({
  workout,
  compact = false,
}: {
  workout: PostWorkout
  compact?: boolean
}) {
  const colors = gradientFor(workout.title + workout.modality)

  const stats: { value: string; label: string }[] = []
  if (workout.durationMin != null) {
    stats.push({ value: `${workout.durationMin}`, label: 'min' })
  }
  if (workout.totalVolumeKg > 0) {
    stats.push({
      value: workout.totalVolumeKg.toLocaleString(),
      label: 'kg lifted',
    })
  }
  if (workout.totalDistanceM > 0) {
    stats.push({ value: formatDistance(workout.totalDistanceM), label: 'covered' })
  }
  stats.push({ value: `${workout.exercisesCompleted}`, label: 'exercises' })
  if (stats.length < 4 && workout.totalReps > 0) {
    stats.push({ value: workout.totalReps.toLocaleString(), label: 'reps' })
  }

  const prCount = workout.highlights.filter((h) => !h.isFirstTime).length

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, compact && styles.cardCompact]}
    >
      <View style={styles.topRow}>
        <Text style={styles.modality} numberOfLines={1}>
          {workout.modality.toUpperCase()}
        </Text>
        {prCount > 0 ? (
          <View style={styles.prBadge}>
            <IconSymbol name="trophy.fill" size={12} color="#FFFFFF" />
            <Text style={styles.prBadgeText}>
              {prCount} PR{prCount > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.title, compact && styles.titleCompact]}
        numberOfLines={2}
      >
        {workout.title}
      </Text>

      <View style={styles.statsRow}>
        {stats.slice(0, compact ? 3 : 4).map((stat, index) => (
          <View key={`${stat.label}-${index}`} style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>
              {stat.value}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {!compact && workout.bodyParts.length > 0 ? (
        <View style={styles.chipsRow}>
          {workout.bodyParts.slice(0, 4).map((part) => (
            <View key={part} style={styles.chip}>
              <Text style={styles.chipText}>{part}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardCompact: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modality: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  prBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  titleCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFFFFF',
  },
  statLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  chipText: {
    ...typography.smallStrong,
    color: '#FFFFFF',
  },
})
