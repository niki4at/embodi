import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'

import ExerciseSetRow, { SetPayload } from './ExerciseSetRow'
import { ExercisePlan, WorkoutSet } from './types'

type WorkoutCardProps = {
  exercise: ExercisePlan
  sets: WorkoutSet[]
  onSaveSet: (setIndex: number, payload: SetPayload) => Promise<void>
  onPrefetchComment: (exerciseId: string) => void
}

export default function WorkoutCard({
  exercise,
  sets,
  onSaveSet,
  onPrefetchComment,
}: WorkoutCardProps) {
  const setArray = Array.from({ length: exercise.targetSets })

  const handleSave = (setIndex: number) => (payload: SetPayload) =>
    onSaveSet(setIndex, payload)

  return (
    <Animated.View
      style={styles.card}
      entering={FadeInUp.duration(600).springify()}
    >
      <Text style={styles.title}>{exercise.name}</Text>
      <Text style={styles.subtitle}>
        {exercise.modality} · {exercise.bodyPart}
      </Text>
      <Text style={styles.instructions}>{exercise.instructions}</Text>

      <View style={styles.tagsRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {exercise.equipment.join(', ') || 'Bodyweight'}
          </Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{exercise.tempo} tempo</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{exercise.restSec}s rest</Text>
        </View>
      </View>

      <View style={styles.cuesContainer}>
        {exercise.cues.map((cue) => (
          <View key={cue} style={styles.cuePill}>
            <Text style={styles.cueText}>{cue}</Text>
          </View>
        ))}
      </View>

      {setArray.map((_, index) => {
        const existingSet = sets.find(
          (set) => set.setIndex === index + 1 && set.exerciseId === exercise.id
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  instructions: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  tagText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600',
  },
  cuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  cuePill: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cueText: {
    fontSize: 12,
    color: '#4c1d95',
    fontWeight: '600',
  },
})

