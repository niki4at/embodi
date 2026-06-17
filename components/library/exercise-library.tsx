import * as Haptics from 'expo-haptics'
import React, { useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export type LibraryCategory =
  | 'all'
  | 'strength'
  | 'mobility'
  | 'cardio'
  | 'recovery'

export interface ExerciseEntry {
  id: string
  name: string
  bodyPart: string
  equipment: string
  modality: Exclude<LibraryCategory, 'all'>
  iconName: Parameters<typeof IconSymbol>[0]['name']
}

export const LIBRARY_EXERCISES: ExerciseEntry[] = [
  {
    id: 'goblet-squat',
    name: 'Goblet squat',
    bodyPart: 'Legs',
    equipment: 'Dumbbell',
    modality: 'strength',
    iconName: 'dumbbell.fill',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian deadlift',
    bodyPart: 'Posterior chain',
    equipment: 'Barbell',
    modality: 'strength',
    iconName: 'figure.strengthtraining.traditional',
  },
  {
    id: 'hip-90-90',
    name: '90/90 hip flow',
    bodyPart: 'Hips',
    equipment: 'Bodyweight',
    modality: 'mobility',
    iconName: 'leaf.fill',
  },
  {
    id: 'thoracic-rotations',
    name: 'Thoracic rotations',
    bodyPart: 'Upper back',
    equipment: 'Bodyweight',
    modality: 'mobility',
    iconName: 'leaf.fill',
  },
  {
    id: 'zone-2-row',
    name: 'Zone 2 rower',
    bodyPart: 'Full body',
    equipment: 'Rower',
    modality: 'cardio',
    iconName: 'flame.fill',
  },
  {
    id: 'incline-walk',
    name: 'Incline walk',
    bodyPart: 'Legs',
    equipment: 'Treadmill',
    modality: 'cardio',
    iconName: 'figure.run',
  },
  {
    id: 'box-breathing',
    name: 'Box breathing',
    bodyPart: 'Nervous system',
    equipment: 'None',
    modality: 'recovery',
    iconName: 'heart.fill',
  },
  {
    id: 'foam-roll-quads',
    name: 'Foam roll · quads',
    bodyPart: 'Legs',
    equipment: 'Foam roller',
    modality: 'recovery',
    iconName: 'drop.fill',
  },
]

const CATEGORIES: { id: LibraryCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'recovery', label: 'Recovery' },
]

interface ExerciseLibraryProps {
  /** When provided, tapping a card calls this instead of the default haptic. */
  onSelectExercise?: (exercise: ExerciseEntry) => void
  /** Ids of exercises currently selected, rendered with a check + accent. */
  selectedIds?: string[]
  /** Extra padding at the bottom of the list (e.g. to clear a fixed tray). */
  listBottomPadding?: number
}

export function ExerciseLibrary({
  onSelectExercise,
  selectedIds,
  listBottomPadding = spacing.huge,
}: ExerciseLibraryProps) {
  const { palette } = useTheme()
  const [category, setCategory] = useState<LibraryCategory>('all')
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const selected = useMemo(
    () => new Set(selectedIds ?? []),
    [selectedIds],
  )

  const filtered = useMemo(() => {
    return LIBRARY_EXERCISES.filter((ex) => {
      const matchesCategory = category === 'all' || ex.modality === category
      const matchesQuery =
        query.trim().length === 0 ||
        ex.name.toLowerCase().includes(query.toLowerCase()) ||
        ex.bodyPart.toLowerCase().includes(query.toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  const handlePress = (exercise: ExerciseEntry) => {
    Haptics.selectionAsync()
    onSelectExercise?.(exercise)
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchInputWrapper,
            {
              backgroundColor: palette.surface,
              borderColor: searchFocused
                ? palette.primary
                : palette.borderStrong,
            },
          ]}
        >
          <IconSymbol
            name="magnifyingglass"
            size={18}
            color={palette.textTertiary}
          />
          <TextInput
            style={[styles.searchInput, { color: palette.textPrimary }]}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search exercises"
            placeholderTextColor={palette.textTertiary}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <IconSymbol name="xmark" size={16} color={palette.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.categoryRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORIES.map((c) => {
            const isActive = c.id === category
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  Haptics.selectionAsync()
                  setCategory(c.id)
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive
                      ? palette.primary
                      : palette.surface,
                    borderColor: isActive
                      ? palette.primary
                      : palette.borderStrong,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isActive ? palette.white : palette.textSecondary },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              name="magnifyingglass"
              size={28}
              color={palette.textTertiary}
            />
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No exercises found
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: palette.textSecondary }]}
            >
              Try a different search or category.
            </Text>
          </View>
        ) : (
          filtered.map((ex, index) => {
            const isSelected = selected.has(ex.id)
            return (
              <Animated.View
                key={ex.id}
                entering={FadeInDown.duration(motion.duration.quick).delay(
                  index * 30,
                )}
              >
                <TouchableOpacity
                  style={[
                    styles.exerciseCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: isSelected
                        ? palette.primary
                        : palette.border,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handlePress(ex)}
                >
                  <View
                    style={[
                      styles.exerciseIcon,
                      { backgroundColor: palette.primaryMuted },
                    ]}
                  >
                    <IconSymbol
                      name={ex.iconName}
                      size={22}
                      color={palette.primary}
                    />
                  </View>
                  <View style={styles.exerciseBody}>
                    <Text
                      style={[
                        styles.exerciseName,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {ex.name}
                    </Text>
                    <Text
                      style={[
                        styles.exerciseMeta,
                        { color: palette.textSecondary },
                      ]}
                    >
                      {ex.bodyPart} · {ex.equipment}
                    </Text>
                  </View>
                  {onSelectExercise ? (
                    <View
                      style={[
                        styles.selectToggle,
                        {
                          backgroundColor: isSelected
                            ? palette.primary
                            : 'transparent',
                          borderColor: isSelected
                            ? palette.primary
                            : palette.borderStrong,
                        },
                      ]}
                    >
                      <IconSymbol
                        name={isSelected ? 'checkmark' : 'plus'}
                        size={16}
                        color={isSelected ? palette.white : palette.textTertiary}
                      />
                    </View>
                  ) : (
                    <IconSymbol
                      name="chevron.right"
                      size={18}
                      color={palette.textTertiary}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    padding: 0,
  },
  categoryRow: {
    marginBottom: spacing.md,
  },
  categoryContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    ...typography.smallStrong,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  exerciseIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseBody: {
    flex: 1,
  },
  exerciseName: {
    ...typography.bodyStrong,
  },
  exerciseMeta: {
    ...typography.small,
    marginTop: 2,
  },
  selectToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.small,
  },
})
