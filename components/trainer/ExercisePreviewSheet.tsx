import * as Haptics from 'expo-haptics'
import React, { useEffect } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { type ExercisePhase, PHASE_META } from './phases'
import type { ExercisePlan } from './types'

type ExercisePreviewSheetProps = {
  visible: boolean
  exercise: ExercisePlan | null
  phase: ExercisePhase | null
  positionLabel?: string
  onClose: () => void
}

type FocusPoint = {
  icon: 'eye' | 'lungs.fill' | 'stopwatch' | 'lightbulb' | 'heart.fill' | 'bolt.fill'
  label: string
  body: string
}

function pickEmojiForExercise(exercise: ExercisePlan, phase: ExercisePhase): string {
  const haystack = `${exercise.name} ${exercise.bodyPart} ${exercise.modality}`.toLowerCase()

  if (/(bike|cycling|spin)/.test(haystack)) return '🚴'
  if (/(walk|hike|jog|run|treadmill|interval)/.test(haystack)) return '🏃'
  if (/(row|rowing)/.test(haystack)) return '🚣'
  if (/(swim)/.test(haystack)) return '🏊'
  if (/(breath|breathing|pranayama|box breath)/.test(haystack)) return '🫁'
  if (/(stretch|mobility|hip|flow|yoga|savasana)/.test(haystack)) return '🧘'
  if (/(glute|hip thrust|bridge)/.test(haystack)) return '🍑'
  if (/(calf)/.test(haystack)) return '🦵'
  if (/(hamstring|quad|squat|lunge|deadlift|leg)/.test(haystack)) return '🦵'
  if (/(shoulder|press|pull|row|lat|back)/.test(haystack)) return '🏋️'
  if (/(core|plank|abdomen|abs)/.test(haystack)) return '🧱'
  if (/(clamshell|side-lying)/.test(haystack)) return '🌀'

  return PHASE_META[phase].emoji
}

function buildFocusPoints(
  exercise: ExercisePlan,
  phase: ExercisePhase,
): FocusPoint[] {
  const points: FocusPoint[] = []

  if (phase === 'warmup') {
    points.push({
      icon: 'lungs.fill',
      label: 'Breathe through your nose',
      body: 'Aim for an even in-and-out cadence so your heart rate climbs gradually instead of spiking.',
    })
    points.push({
      icon: 'eye',
      label: 'Find smooth range, not max range',
      body: 'Move only as far as your joints feel ready. Loosening up takes a few reps — it shouldn’t hurt.',
    })
  } else if (phase === 'cooldown') {
    points.push({
      icon: 'lungs.fill',
      label: 'Stretch the exhale',
      body: 'Make your exhale longer than your inhale. That’s the cue your nervous system uses to switch off.',
    })
    points.push({
      icon: 'heart.fill',
      label: 'Notice what feels different',
      body: 'Scan how the parts you trained feel right now. Logging this builds your sense of how your body adapts.',
    })
  } else {
    const pace = exercise.tempo ? `Tempo ${exercise.tempo}` : 'Controlled tempo'
    points.push({
      icon: 'stopwatch',
      label: pace,
      body: 'Slow on the lowering phase, steady on the way back up. The eccentric is where the strength gets built.',
    })
    points.push({
      icon: 'bolt.fill',
      label: 'Stop a rep or two before failure',
      body: 'You should finish each set knowing you had a clean rep left. That’s where the strongest signal lives.',
    })
  }

  if (exercise.intensityCue) {
    points.push({
      icon: 'lightbulb',
      label: 'Intensity cue',
      body: exercise.intensityCue,
    })
  }

  if (exercise.contraindications && exercise.contraindications.length > 0) {
    points.push({
      icon: 'lightbulb',
      label: 'Skip or swap if',
      body: exercise.contraindications.join(' · '),
    })
  }

  return points
}

function buildPrimaryStat(exercise: ExercisePlan): {
  label: string
  value: string
} {
  if (exercise.trackingMetric === 'duration' && exercise.durationMin) {
    return { label: 'Duration', value: `${exercise.durationMin} min` }
  }
  if (exercise.trackingMetric === 'breath' && exercise.durationMin) {
    return { label: 'Duration', value: `${exercise.durationMin} min` }
  }
  if (exercise.trackingMetric === 'distance') {
    return { label: 'Sets', value: `${exercise.targetSets}` }
  }
  const reps = exercise.targetReps.length
    ? exercise.targetReps.join('–')
    : '—'
  return {
    label: `${exercise.targetSets} set${exercise.targetSets === 1 ? '' : 's'}`,
    value: `${reps} reps`,
  }
}

export default function ExercisePreviewSheet({
  visible,
  exercise,
  phase,
  positionLabel,
  onClose,
}: ExercisePreviewSheetProps) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (visible) {
      Haptics.selectionAsync().catch(() => {})
    }
  }, [visible])

  if (!visible || !exercise || !phase) return null

  const meta = PHASE_META[phase]
  const emoji = pickEmojiForExercise(exercise, phase)
  const primary = buildPrimaryStat(exercise)
  const focusPoints = buildFocusPoints(exercise, phase)
  const equipmentLabel = exercise.equipment.length
    ? exercise.equipment.join(' · ')
    : 'Bodyweight'

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close exercise preview"
      />
      <Animated.View
        entering={SlideInDown.duration(280).easing(
          Easing.bezier(0.22, 1, 0.36, 1),
        )}
        exiting={SlideOutDown.duration(220).easing(
          Easing.bezier(0.4, 0, 1, 1),
        )}
        style={[
          styles.panel,
          shadows.lg,
          {
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            backgroundColor: palette.bgElevated,
            borderColor: palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.handle,
            { backgroundColor: palette.borderStrong },
          ]}
        />

        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.phaseLabel, { color: palette.primary }]}>
            {meta.emoji} {meta.label}
            {positionLabel ? ` · ${positionLabel}` : ''}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <IconSymbol name="xmark" size={16} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.hero,
              {
                backgroundColor: palette.primaryMuted,
                borderColor: palette.primaryBorder,
              },
            ]}
          >
            <View
              style={[
                styles.emojiBadge,
                {
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.primaryBorder,
                },
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text
              style={[styles.stageHeadline, { color: palette.primary }]}
            >
              {meta.stageHeadline}
            </Text>
            <Text style={[styles.exerciseName, { color: palette.textPrimary }]}>
              {exercise.name}
            </Text>
            <View style={styles.heroChips}>
              <Chip label={exercise.bodyPart} />
              <Chip label={exercise.modality} />
              <Chip label={equipmentLabel} />
            </View>
          </View>

          <View
            style={[
              styles.tipCard,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.border,
              },
            ]}
          >
            <IconSymbol
              name="lightbulb"
              size={18}
              color={palette.primary}
            />
            <Text style={[styles.tipText, { color: palette.textSecondary }]}>
              {meta.tip}
            </Text>
          </View>

          <View style={styles.statRow}>
            <StatCell label={primary.label} value={primary.value} />
            <StatCell
              label="Tempo"
              value={exercise.tempo || '—'}
            />
            <StatCell
              label="Rest"
              value={exercise.restSec ? `${exercise.restSec}s` : '—'}
            />
          </View>

          {exercise.instructions ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: palette.textTertiary }]}
              >
                HOW TO DO IT
              </Text>
              <Text
                style={[styles.bodyText, { color: palette.textPrimary }]}
              >
                {exercise.instructions}
              </Text>
            </View>
          ) : null}

          {exercise.cues.length > 0 ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: palette.textTertiary }]}
              >
                FORM CUES
              </Text>
              <View style={styles.cueRow}>
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
            </View>
          ) : null}

          {focusPoints.length > 0 ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: palette.textTertiary }]}
              >
                WHAT TO FOCUS ON
              </Text>
              {focusPoints.map(point => (
                <View
                  key={point.label}
                  style={[
                    styles.focusRow,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.focusIcon,
                      { backgroundColor: palette.primaryMuted },
                    ]}
                  >
                    <IconSymbol
                      name={point.icon}
                      size={16}
                      color={palette.primary}
                    />
                  </View>
                  <View style={styles.focusBody}>
                    <Text
                      style={[
                        styles.focusLabel,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {point.label}
                    </Text>
                    <Text
                      style={[
                        styles.focusText,
                        { color: palette.textSecondary },
                      ]}
                    >
                      {point.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

function Chip({ label }: { label: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.bgElevated, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.chipText, { color: palette.textSecondary }]}>
        {label}
      </Text>
    </View>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.statCell,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.statValue, { color: palette.textPrimary }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: palette.textTertiary }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  headerSpacer: {
    width: 32,
  },
  phaseLabel: {
    ...typography.smallStrong,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  emojiBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 44,
    lineHeight: 52,
  },
  stageHeadline: {
    ...typography.smallStrong,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  exerciseName: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: 2,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  tipText: {
    ...typography.body,
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCell: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...typography.h3,
    fontSize: 17,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  bodyText: {
    ...typography.body,
  },
  cueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  cuePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  cueText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  focusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  focusIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBody: {
    flex: 1,
  },
  focusLabel: {
    ...typography.bodyStrong,
    marginBottom: 2,
  },
  focusText: {
    ...typography.small,
  },
})
