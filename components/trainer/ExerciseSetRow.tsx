import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { TrackingMetric, WorkoutSet } from './types'

export type SetPayload = {
  weightKg?: number
  reps?: number
  rpe?: number
  durationSec?: number
  distanceM?: number
  notes?: string
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
  const [metricValue, setMetricValue] = useState(
    existingSet?.weightKg?.toString() ||
      existingSet?.durationSec?.toString() ||
      existingSet?.distanceM?.toString() ||
      ''
  )
  const [secondaryValue, setSecondaryValue] = useState(
    existingSet?.reps?.toString() || existingSet?.rpe?.toString() || ''
  )
  const [notes, setNotes] = useState(existingSet?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

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

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.setLabel}>Set {setNumber}</Text>
        <Text style={styles.targetLabel}>{targetLabel}</Text>
        {completed && <Text style={styles.completedBadge}>✓ Logged</Text>}
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>{metricMeta.label}</Text>
          <TextInput
            style={styles.input}
            value={metricValue}
            onChangeText={setMetricValue}
            placeholder={metricMeta.placeholder}
            keyboardType="numeric"
            onFocus={onFocusMetric}
          />
        </View>

        {trackingMetric !== 'custom' && (
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>{secondaryLabel}</Text>
            <TextInput
              style={styles.input}
              value={secondaryValue}
              onChangeText={setSecondaryValue}
              placeholder={showReps ? '10' : '6'}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>

      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes or discomfort?"
        value={notes}
        onChangeText={setNotes}
      />

      <TouchableOpacity
        style={[styles.saveButton, completed && styles.saveButtonGhost]}
        onPress={handleSave}
        activeOpacity={0.8}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
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
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  setLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  targetLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  completedBadge: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputBlock: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  notesInput: {
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonGhost: {
    backgroundColor: '#4f46e5',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})

