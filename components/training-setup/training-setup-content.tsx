import { useAction, useQuery } from 'convex/react'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'

import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import {
  getTrainingPreferences,
  listEquipment,
  listTrainingPlaces,
} from './api'
import { EquipmentSection } from './equipment-section'
import { PlacesSection } from './places-section'
import { SuggestionsSection } from './suggestions-section'
import { WeeklyRhythmSection } from './weekly-rhythm-section'
import type { TrainingPlace } from './types'

export function TrainingSetupContent() {
  const { palette } = useTheme()
  const preferences = useQuery(getTrainingPreferences)
  const equipment = useQuery(listEquipment)
  const loadPlaces = useAction(listTrainingPlaces)
  const [places, setPlaces] = useState<TrainingPlace[] | undefined>()
  const refreshPlaces = useCallback(async () => {
    const rows = await loadPlaces({})
    setPlaces(
      rows
        .filter(
          (row) =>
            row.trainingEnvironment === 'home' ||
            row.trainingEnvironment === 'gym',
        )
        .map((row) => ({
          _id: row._id,
          kind: row.trainingEnvironment as 'home' | 'gym',
          name: row.label,
          radiusMeters: row.radiusM,
          latitude: row.latitude,
          longitude: row.longitude,
        })),
    )
  }, [loadPlaces])

  useEffect(() => {
    let active = true
    void refreshPlaces()
      .then(() => {
        if (!active) return
      })
      .catch((error: unknown) => {
        console.error('Training places load failed', error)
        if (active) setPlaces([])
      })
    return () => {
      active = false
    }
  }, [refreshPlaces])
  const isLoading =
    preferences === undefined || equipment === undefined || places === undefined

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          Loading your training setup
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <View style={styles.intro}>
        <Text style={[styles.introTitle, { color: palette.textPrimary }]}>
          Build workouts around your real setup
        </Text>
        <Text style={[styles.introText, { color: palette.textSecondary }]}>
          Embodi uses these defaults to suggest a place and equipment intent. You
          can change either before every session.
        </Text>
      </View>

      <EquipmentSection equipment={equipment} />
      <PlacesSection
        places={places}
        locationEnabled={preferences?.locationEnabled ?? false}
        onPlacesChanged={refreshPlaces}
      />
      <WeeklyRhythmSection value={preferences?.weeklyRhythm ?? []} />
      <SuggestionsSection preferences={preferences} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.xl,
  },
  intro: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  introTitle: { ...typography.h3 },
  introText: { ...typography.body },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { ...typography.body },
})
