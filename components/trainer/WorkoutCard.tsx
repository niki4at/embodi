import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import ExerciseSetRow, { SetPayload } from './ExerciseSetRow'
import { ExercisePlan, WorkoutSet } from './types'

type WorkoutCardProps = {
  exercise: ExercisePlan
  sets: WorkoutSet[]
  onSaveSet: (setIndex: number, payload: SetPayload) => Promise<void>
  onPrefetchComment: (exerciseId: string) => void
  onOpenMenu?: (exercise: ExercisePlan) => void
}

export default function WorkoutCard({
  exercise,
  sets,
  onSaveSet,
  onPrefetchComment,
  onOpenMenu,
}: WorkoutCardProps) {
  const { palette } = useTheme()
  const setArray = Array.from({ length: exercise.targetSets })

  const handleSave = (setIndex: number) => (payload: SetPayload) =>
    onSaveSet(setIndex, payload)

  const completedCount = sets.filter(s => s.exerciseId === exercise.id).length

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      entering={FadeInUp.duration(motion.duration.base)}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            {exercise.name}
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            {exercise.modality} · {exercise.bodyPart}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View
            style={[
              styles.setCounter,
              { backgroundColor: palette.surfaceAlt },
            ]}
          >
            <Text style={[styles.setCounterValue, { color: palette.primary }]}>
              {completedCount}
              <Text
                style={[styles.setCounterMax, { color: palette.textTertiary }]}
              >
                /{exercise.targetSets}
              </Text>
            </Text>
            <Text
              style={[styles.setCounterLabel, { color: palette.textTertiary }]}
            >
              SETS
            </Text>
          </View>
          {onOpenMenu ? (
            <TouchableOpacity
              onPress={() => onOpenMenu(exercise)}
              hitSlop={10}
              accessibilityLabel={`Open options for ${exercise.name}`}
              style={[
                styles.menuButton,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                },
              ]}
            >
              <IconSymbol
                name="ellipsis"
                size={18}
                color={palette.textPrimary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {exercise.instructions ? (
        <Text style={[styles.instructions, { color: palette.textSecondary }]}>
          {exercise.instructions}
        </Text>
      ) : null}

      <View style={styles.tagsRow}>
        <Tag label={exercise.equipment.join(', ') || 'Bodyweight'} />
        <Tag label={`${exercise.tempo} tempo`} />
        <Tag label={`${exercise.restSec}s rest`} />
      </View>

      {exercise.cues.length > 0 ? (
        <View style={styles.cuesContainer}>
          {exercise.cues.map(cue => (
            <View
              key={cue}
              style={[
                styles.cuePill,
                {
                  backgroundColor: palette.primaryMuted,
                  borderColor: palette.primaryBorder,
                },
              ]}
            >
              <Text style={[styles.cueText, { color: palette.primary }]}>
                {cue}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: palette.divider }]} />

      {setArray.map((_, index) => {
        const existingSet = sets.find(
          set => set.setIndex === index + 1 && set.exerciseId === exercise.id,
        )
        return (
          <ExerciseSetRow
            key={`${exercise.id}-set-${index + 1}`}
            setNumber={index + 1}
            targetReps={exercise.targetReps}
            tempo={exercise.tempo}
            trackingMetric={exercise.trackingMetric}
            existingSet={existingSet}
            onSave={handleSave(index + 1)}
            onFocusMetric={() => onPrefetchComment(exercise.id)}
          />
        )
      })}
    </Animated.View>
  )
}

function Tag({ label }: { label: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.tagText, { color: palette.textSecondary }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setCounter: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 64,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCounterValue: {
    ...typography.h3,
  },
  setCounterMax: {
    ...typography.small,
    fontWeight: '500',
  },
  setCounterLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  instructions: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tagText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  cuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cuePill: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
  },
  cueText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
})
