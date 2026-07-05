import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { MuscleFigure } from '@/components/social/muscle-figure'
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

type Highlight = PostWorkout['highlights'][number]

const PR_KIND_LABEL: Record<string, string> = {
  oneRm: 'New est. 1RM',
  weight: 'New top weight',
  reps: 'New rep record',
  duration: 'New duration PR',
  distance: 'New distance PR',
}

const PR_KIND_PRIORITY = ['oneRm', 'weight', 'reps', 'duration', 'distance']

export function bestPr(workout: PostWorkout): Highlight | null {
  const prs = workout.highlights.filter((h) => !h.isFirstTime)
  if (prs.length === 0) return null
  return [...prs].sort(
    (a, b) =>
      PR_KIND_PRIORITY.indexOf(a.kind) - PR_KIND_PRIORITY.indexOf(b.kind)
  )[0]
}

export function formatHighlightValue(h: Highlight): string {
  if (h.kind === 'distance') return formatDistance(h.value)
  if (h.kind === 'duration') {
    return h.value >= 90 ? `${Math.round(h.value / 60)} min` : `${h.value}s`
  }
  return `${h.value.toLocaleString()} ${h.unit}`
}

function buildStats(workout: PostWorkout): { value: string; label: string }[] {
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
    stats.push({
      value: formatDistance(workout.totalDistanceM),
      label: 'covered',
    })
  }
  stats.push({ value: `${workout.exercisesCompleted}`, label: 'exercises' })
  if (stats.length < 4 && workout.totalReps > 0) {
    stats.push({ value: workout.totalReps.toLocaleString(), label: 'reps' })
  }
  return stats
}

/**
 * The gradient stat hero rendered on workout posts (and as the composer
 * preview) when there are no photos. When the workout set a PR, the PR takes
 * over the hero and the totals shrink to a single strip.
 */
export function WorkoutStatCard({
  workout,
  compact = false,
}: {
  workout: PostWorkout
  compact?: boolean
}) {
  const colors = gradientFor(workout.title + workout.modality)
  const stats = buildStats(workout)
  const pr = compact ? null : bestPr(workout)
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

      {pr ? (
        <>
          <View style={styles.prHeroRow}>
            <View style={styles.prHeroText}>
              <Text style={styles.prKicker} numberOfLines={1}>
                {(PR_KIND_LABEL[pr.kind] ?? 'New record').toUpperCase()}
              </Text>
              <Text style={styles.prValue} numberOfLines={1}>
                {formatHighlightValue(pr)}
              </Text>
              <Text style={styles.prExercise} numberOfLines={1}>
                {pr.exerciseName}
              </Text>
            </View>
            <IconSymbol
              name="trophy.fill"
              size={44}
              color="rgba(255,255,255,0.9)"
            />
          </View>
          <Text style={styles.prWorkoutTitle} numberOfLines={1}>
            {workout.title}
          </Text>
          <Text style={styles.prStatsStrip} numberOfLines={1}>
            {stats.map((s) => `${s.value} ${s.label}`).join('  \u00b7  ')}
          </Text>
        </>
      ) : (
        <>
          <Text
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={2}
          >
            {workout.title}
          </Text>

          <View style={styles.statsRow}>
            {stats.slice(0, 3).map((stat, index) => (
              <View key={`${stat.label}-${index}`} style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
            {!compact && workout.bodyParts.length > 0 ? (
              <MuscleFigure bodyParts={workout.bodyParts} height={60} />
            ) : null}
          </View>
        </>
      )}
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
  prHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  prHeroText: {
    flex: 1,
  },
  prKicker: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  prValue: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 34,
    lineHeight: 40,
    color: '#FFFFFF',
  },
  prExercise: {
    ...typography.bodyStrong,
    color: 'rgba(255,255,255,0.95)',
  },
  prWorkoutTitle: {
    ...typography.smallStrong,
    color: 'rgba(255,255,255,0.9)',
  },
  prStatsStrip: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
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
    alignItems: 'center',
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
})
