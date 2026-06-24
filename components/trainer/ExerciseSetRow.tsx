import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { SetType, TrackingMetric, WorkoutSet } from './types'

export type SetPayload = {
  weightKg?: number
  reps?: number
  rpe?: number
  durationSec?: number
  distanceM?: number
  notes?: string
  isWarmup?: boolean
  setType?: SetType
}

interface ExerciseSetRowProps {
  setNumber: number
  targetReps: number[]
  tempo: string
  trackingMetric: TrackingMetric
  existingSet?: WorkoutSet
  onSave: (payload: SetPayload) => Promise<void>
  onFocusMetric?: () => void
}

const metricConfig: Record<
  TrackingMetric,
  { label: string; placeholder: string; key: keyof SetPayload }
> = {
  weight_reps: { label: 'Weight (kg)', placeholder: '20', key: 'weightKg' },
  duration: { label: 'Time (sec)', placeholder: '45', key: 'durationSec' },
  distance: { label: 'Distance (m)', placeholder: '400', key: 'distanceM' },
  breath: { label: 'Breath count', placeholder: '6', key: 'durationSec' },
  custom: { label: 'Metric', placeholder: 'Felt smooth', key: 'notes' },
}

function parseNumber(value: string) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

export default function ExerciseSetRow({
  setNumber,
  targetReps,
  tempo,
  trackingMetric,
  existingSet,
  onSave,
  onFocusMetric,
}: ExerciseSetRowProps) {
  const { palette } = useTheme()
  const [metricValue, setMetricValue] = useState(
    existingSet?.weightKg?.toString() ||
      existingSet?.durationSec?.toString() ||
      existingSet?.distanceM?.toString() ||
      '',
  )
  const [secondaryValue, setSecondaryValue] = useState(
    existingSet?.reps?.toString() || existingSet?.rpe?.toString() || '',
  )
  const [notes, setNotes] = useState(existingSet?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const targetLabel = useMemo(() => {
    const min = targetReps[0]
    const max = targetReps[targetReps.length - 1]
    const range =
      targetReps.length > 1 && min !== max ? `${min}-${max}` : String(min)
    const unit = trackingMetric === 'duration' ? 'rounds' : 'reps'
    return `${range} ${unit} @ ${tempo}`
  }, [targetReps, tempo, trackingMetric])

  const completed = Boolean(existingSet)
  const metricMeta = metricConfig[trackingMetric]
  const showReps = trackingMetric === 'weight_reps'
  const secondaryLabel = showReps ? 'Reps' : 'RPE'

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const payload: SetPayload = {}
      if (metricMeta.key === 'notes') {
        payload.notes = metricValue || undefined
      } else {
        payload[metricMeta.key] = parseNumber(metricValue)
      }
      if (showReps) {
        payload.reps = parseNumber(secondaryValue)
      } else if (trackingMetric !== 'custom') {
        payload.rpe = parseNumber(secondaryValue)
      }
      payload.notes = notes.trim() ? notes.trim() : payload.notes

      await onSave(payload)
    } finally {
      setIsSaving(false)
    }
  }

  const inputBackground = (focused: boolean) =>
    focused ? palette.surfaceAlt : palette.surface
  const inputBorder = (focused: boolean) =>
    focused ? palette.primary : palette.border

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: completed ? palette.successMuted : palette.border,
          backgroundColor: completed
            ? palette.successMuted
            : palette.bgElevated,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <View style={[styles.setBadge, { backgroundColor: palette.surfaceAlt }]}>
          <Text style={[styles.setBadgeText, { color: palette.textPrimary }]}>
            {setNumber}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.setLabel, { color: palette.textPrimary }]}>
            Set {setNumber}
          </Text>
          <Text style={[styles.targetLabel, { color: palette.textTertiary }]}>
            {targetLabel}
          </Text>
        </View>
        {completed ? (
          <View
            style={[
              styles.completedBadge,
              { backgroundColor: palette.successMuted },
            ]}
          >
            <IconSymbol
              name="checkmark.circle.fill"
              size={16}
              color={palette.success}
            />
            <Text
              style={[styles.completedBadgeText, { color: palette.success }]}
            >
              Logged
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: palette.textTertiary }]}>
            {metricMeta.label}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                backgroundColor: inputBackground(focusedField === 'metric'),
                borderColor: inputBorder(focusedField === 'metric'),
              },
            ]}
            value={metricValue}
            onChangeText={setMetricValue}
            placeholder={metricMeta.placeholder}
            placeholderTextColor={palette.textMuted}
            keyboardType="numeric"
            onFocus={() => {
              setFocusedField('metric')
              onFocusMetric?.()
            }}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        {trackingMetric !== 'custom' && (
          <View style={styles.inputBlock}>
            <Text style={[styles.inputLabel, { color: palette.textTertiary }]}>
              {secondaryLabel}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: palette.textPrimary,
                  backgroundColor: inputBackground(
                    focusedField === 'secondary',
                  ),
                  borderColor: inputBorder(focusedField === 'secondary'),
                },
              ]}
              value={secondaryValue}
              onChangeText={setSecondaryValue}
              placeholder={showReps ? '10' : '6'}
              placeholderTextColor={palette.textMuted}
              keyboardType="numeric"
              onFocus={() => setFocusedField('secondary')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        )}
      </View>

      <TextInput
        style={[
          styles.input,
          styles.notesInput,
          {
            color: palette.textPrimary,
            backgroundColor: inputBackground(focusedField === 'notes'),
            borderColor: inputBorder(focusedField === 'notes'),
          },
        ]}
        placeholder="Notes or discomfort?"
        placeholderTextColor={palette.textMuted}
        value={notes}
        onChangeText={setNotes}
        onFocus={() => setFocusedField('notes')}
        onBlur={() => setFocusedField(null)}
      />

      <TouchableOpacity
        style={[
          styles.saveButton,
          {
            backgroundColor: completed ? palette.surfaceAlt : palette.primary,
            borderColor: palette.border,
            borderWidth: completed ? 1 : 0,
          },
        ]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color={palette.white} />
        ) : (
          <Text
            style={[
              styles.saveButtonText,
              { color: completed ? palette.textPrimary : palette.white },
            ]}
          >
            {completed ? 'Update set' : 'Log set'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  setBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBadgeText: {
    ...typography.bodyStrong,
  },
  headerInfo: {
    flex: 1,
  },
  setLabel: {
    ...typography.bodyStrong,
  },
  targetLabel: {
    ...typography.small,
    marginTop: 2,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  completedBadgeText: {
    ...typography.caption,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inputBlock: {
    flex: 1,
  },
  inputLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.body,
  },
  notesInput: {
    marginBottom: spacing.md,
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.bodyStrong,
  },
})
