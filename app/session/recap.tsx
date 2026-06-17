import { useQuery } from 'convex/react'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { groupPlanByPhase, PHASE_META } from '@/components/trainer/phases'
import type { ExercisePlan } from '@/components/trainer/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type RecapParams = {
  sessionId?: string
}

type LoggedSet = {
  exerciseId: string
  setIndex: number
  weightKg?: number
  reps?: number
  rpe?: number
  durationSec?: number
  distanceM?: number
  notes?: string
}

function formatSet(set: LoggedSet): string {
  const parts: string[] = []
  if (set.weightKg != null) parts.push(`${set.weightKg} kg`)
  if (set.reps != null) parts.push(`${set.reps} reps`)
  if (set.durationSec != null) parts.push(`${set.durationSec}s`)
  if (set.distanceM != null) parts.push(`${set.distanceM} m`)
  if (set.rpe != null) parts.push(`RPE ${set.rpe}`)
  return parts.length ? parts.join(' \u00b7 ') : 'Logged'
}

export default function RecapScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<RecapParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined

  const sessionData = useQuery(
    api.trainer.getSessionWithSets,
    sessionId ? { sessionId } : 'skip',
  )

  const session = sessionData?.session
  const sets = useMemo<LoggedSet[]>(
    () => (sessionData?.sets ?? []) as LoggedSet[],
    [sessionData?.sets],
  )

  const groups = useMemo(() => {
    if (!session) return []
    const planExercises: ExercisePlan[] = session.plan.map((exercise) => ({
      ...exercise,
      targetReps: Array.isArray(exercise.targetReps)
        ? exercise.targetReps
        : [exercise.targetReps ?? 0],
    }))
    return groupPlanByPhase(planExercises)
  }, [session])

  const setsByExercise = useMemo(() => {
    const map = new Map<string, LoggedSet[]>()
    for (const set of sets) {
      const list = map.get(set.exerciseId) ?? []
      list.push(set)
      map.set(set.exerciseId, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.setIndex - b.setIndex)
    }
    return map
  }, [sets])

  const renderHeader = (title: string) => (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[
          styles.iconButton,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <IconSymbol name="chevron.left" size={20} color={palette.textPrimary} />
      </TouchableOpacity>
      <Text
        style={[styles.topBarTitle, { color: palette.textPrimary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.iconButton} />
    </View>
  )

  if (!sessionId) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Missing session ID.
        </Text>
      </SafeAreaView>
    )
  }

  if (sessionData === undefined) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Session not available.
        </Text>
      </SafeAreaView>
    )
  }

  const isDiscarded = session.status === 'discarded'
  const totalTargetSets = session.plan.reduce(
    (acc, exercise) => acc + exercise.targetSets,
    0,
  )
  const dateLabel = new Date(session.updatedAt).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      {renderHeader(session.goal)}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
          <View style={styles.summaryRow}>
            <Text style={[styles.sessionTitle, { color: palette.textPrimary }]}>
              Recap
            </Text>
            <View
              style={[
                styles.statusTag,
                {
                  backgroundColor: isDiscarded
                    ? palette.dangerMuted
                    : palette.successMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusTagText,
                  { color: isDiscarded ? palette.danger : palette.success },
                ]}
              >
                {isDiscarded ? 'Discarded' : 'Completed'}
              </Text>
            </View>
          </View>
          <Text style={[styles.sessionMeta, { color: palette.textSecondary }]}>
            {dateLabel} {'\u00b7'} {session.modality} {'\u00b7'}{' '}
            {session.durationMin} min {'\u00b7'} {sets.length}/{totalTargetSets}{' '}
            sets
          </Text>
        </Animated.View>

        {groups.map((group) =>
          group.exercises.length === 0 ? null : (
            <View key={group.phase} style={styles.phaseBlock}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseEmoji}>
                  {PHASE_META[group.phase].emoji}
                </Text>
                <Text style={[styles.phaseLabel, { color: palette.primary }]}>
                  {PHASE_META[group.phase].label}
                </Text>
              </View>
              {group.exercises.map(({ exercise }) => {
                const loggedSets = setsByExercise.get(exercise.id) ?? []
                return (
                  <View
                    key={exercise.id}
                    style={[
                      styles.exerciseCard,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.exerciseName,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {exercise.name}
                    </Text>
                    {loggedSets.length === 0 ? (
                      <Text
                        style={[
                          styles.notLogged,
                          { color: palette.textTertiary },
                        ]}
                      >
                        Not logged
                      </Text>
                    ) : (
                      loggedSets.map((set, index) => (
                        <View
                          key={`${exercise.id}-${set.setIndex}`}
                          style={[
                            styles.setRow,
                            { borderTopColor: palette.divider },
                          ]}
                        >
                          <Text
                            style={[
                              styles.setNumber,
                              { color: palette.textTertiary },
                            ]}
                          >
                            Set {index + 1}
                          </Text>
                          <Text
                            style={[
                              styles.setValue,
                              { color: palette.textSecondary },
                            ]}
                          >
                            {formatSet(set)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )
              })}
            </View>
          ),
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  topBarTitle: {
    ...typography.bodyStrong,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionTitle: {
    ...typography.h1,
  },
  statusTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusTagText: {
    ...typography.smallStrong,
  },
  sessionMeta: {
    ...typography.small,
    marginTop: 4,
  },
  phaseBlock: {
    marginTop: spacing.xl,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  phaseEmoji: {
    fontSize: 18,
  },
  phaseLabel: {
    ...typography.smallStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  exerciseCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  exerciseName: {
    ...typography.bodyStrong,
    marginBottom: spacing.sm,
  },
  notLogged: {
    ...typography.small,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setNumber: {
    ...typography.small,
  },
  setValue: {
    ...typography.smallStrong,
  },
  bottomSpacing: {
    height: spacing.huge,
  },
})
