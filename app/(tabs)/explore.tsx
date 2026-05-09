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
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

type Category = 'all' | 'strength' | 'mobility' | 'cardio' | 'recovery'

interface ExerciseEntry {
  id: string
  name: string
  bodyPart: string
  equipment: string
  modality: Exclude<Category, 'all'>
  iconName: Parameters<typeof IconSymbol>[0]['name']
}

const EXERCISES: ExerciseEntry[] = [
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

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'recovery', label: 'Recovery' },
]

export default function ExploreScreen() {
  const { palette } = useTheme()
  const [category, setCategory] = useState<Category>('all')
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const filtered = useMemo(() => {
    return EXERCISES.filter(ex => {
      const matchesCategory = category === 'all' || ex.modality === category
      const matchesQuery =
        query.trim().length === 0 ||
        ex.name.toLowerCase().includes(query.toLowerCase()) ||
        ex.bodyPart.toLowerCase().includes(query.toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Library
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Browse exercises, programs, and recovery flows.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInputWrapper,
              {
                backgroundColor: palette.surface,
                borderColor: searchFocused ? palette.primary : palette.borderStrong,
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
                <IconSymbol
                  name="xmark"
                  size={16}
                  color={palette.textTertiary}
                />
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
            {CATEGORIES.map(c => {
              const selected = c.id === category
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
                      backgroundColor: selected
                        ? palette.primary
                        : palette.surface,
                      borderColor: selected ? palette.primary : palette.borderStrong,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      {
                        color: selected ? palette.white : palette.textSecondary,
                      },
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                name="magnifyingglass"
                size={28}
                color={palette.textTertiary}
              />
              <Text
                style={[styles.emptyTitle, { color: palette.textPrimary }]}
              >
                No exercises found
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: palette.textSecondary }]}
              >
                Try a different search or category.
              </Text>
            </View>
          ) : (
            filtered.map((ex, index) => (
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
                      borderColor: palette.border,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => Haptics.selectionAsync()}
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
                      style={[styles.exerciseName, { color: palette.textPrimary }]}
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
                  <IconSymbol
                    name="chevron.right"
                    size={18}
                    color={palette.textTertiary}
                  />
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
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
    paddingBottom: spacing.huge,
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
