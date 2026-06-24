import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { ScanEquipment } from '@/components/library/scan-equipment'
import { BodyPartSelector } from '@/components/ui/body-part-selector'
import { IconSymbol } from '@/components/ui/icon-symbol'
import {
  BODY_GROUPS,
  BODY_GROUP_LABELS,
  CATALOG_EXERCISES,
  ICON_BY_MODALITY,
  type BodyGroup,
  type ExerciseEntry,
  type ExerciseModality,
  type LibraryCategory,
} from '@/constants/exercise-catalog'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { setSelectionHandler } from '@/utils/exerciseSelectionBus'

// Re-export so existing imports from this module keep working.
export type { ExerciseEntry, LibraryCategory } from '@/constants/exercise-catalog'
export { CATALOG_EXERCISES as LIBRARY_EXERCISES } from '@/constants/exercise-catalog'

type ViewMode = 'category' | 'body'

const CATEGORIES: { id: LibraryCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'recovery', label: 'Recovery' },
]

const MODALITY_OPTIONS: { id: ExerciseModality; label: string }[] = [
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
  const customExercises = useQuery(api.exercises.listCustomExercises)
  const mediaList = useQuery(api.exerciseMedia.listExerciseMedia)
  const mediaByCatalogId = useMemo(
    () => new Map((mediaList ?? []).map((m) => [m.catalogId, m.gifUrl])),
    [mediaList]
  )
  const deleteCustom = useMutation(api.exercises.deleteCustomExercise)

  const [viewMode, setViewMode] = useState<ViewMode>('category')
  const [category, setCategory] = useState<LibraryCategory>('all')
  const [selectedGroup, setSelectedGroup] = useState<BodyGroup | null>(null)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)

  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds])

  // Merge user-defined exercises into the catalog using a stable `custom-` id.
  const allExercises = useMemo<ExerciseEntry[]>(() => {
    const customs: ExerciseEntry[] = (customExercises ?? []).map((c) => ({
      id: `custom-${c._id}`,
      name: c.name,
      group: c.group as BodyGroup,
      bodyPart: c.bodyPart,
      equipment: c.equipment.join(', ') || 'None',
      modality: c.modality as ExerciseModality,
      iconName: ICON_BY_MODALITY[c.modality as ExerciseModality],
    }))
    return [...customs, ...CATALOG_EXERCISES]
  }, [customExercises])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allExercises.filter((ex) => {
      const matchesView =
        viewMode === 'body'
          ? selectedGroup === null || ex.group === selectedGroup
          : category === 'all' || ex.modality === category
      const matchesQuery =
        q.length === 0 ||
        ex.name.toLowerCase().includes(q) ||
        ex.bodyPart.toLowerCase().includes(q) ||
        BODY_GROUP_LABELS[ex.group].toLowerCase().includes(q)
      return matchesView && matchesQuery
    })
  }, [allExercises, viewMode, category, selectedGroup, query])

  // Group the filtered results under body-group section headers.
  const sections = useMemo(() => {
    return BODY_GROUPS.map((g) => ({
      group: g.id,
      label: g.label,
      items: filtered.filter((ex) => ex.group === g.id),
    })).filter((s) => s.items.length > 0)
  }, [filtered])

  // The detail screen (opened as a modal) reports "Add to workout" taps back
  // here through the selection bus. Map the pick to the matching entry and
  // forward it to the same handler row selection uses.
  useEffect(() => {
    if (!onSelectExercise) return
    setSelectionHandler((pick) => {
      const match = allExercises.find((ex) => ex.id === pick.id)
      onSelectExercise(
        match ?? {
          id: pick.id,
          name: pick.name,
          group: 'core' as BodyGroup,
          bodyPart: pick.bodyPart,
          equipment: pick.equipment || 'None',
          modality: pick.modality as ExerciseModality,
          iconName: ICON_BY_MODALITY[pick.modality as ExerciseModality],
        },
      )
    })
    return () => setSelectionHandler(null)
  }, [onSelectExercise, allExercises])

  const handleSelect = (exercise: ExerciseEntry) => {
    Haptics.selectionAsync()
    onSelectExercise?.(exercise)
  }

  const handleOpenDetail = (exercise: ExerciseEntry) => {
    Haptics.selectionAsync()
    const payload = {
      catalogId: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      modality: exercise.modality,
      equipment: exercise.equipment ? [exercise.equipment] : [],
    }
    router.push({
      pathname: '/exercise/[id]',
      params: {
        id: exercise.id,
        mode: 'library',
        selected: selected.has(exercise.id) ? '1' : '0',
        payload: JSON.stringify(payload),
      },
    })
  }

  const handleDeleteCustom = (exercise: ExerciseEntry) => {
    const rawId = exercise.id.replace('custom-', '')
    Alert.alert('Delete exercise', `Remove "${exercise.name}" from your saved exercises?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustom({
              exerciseId: rawId as Id<'custom_exercises'>,
            })
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            )
          } catch (error) {
            console.error('delete custom exercise', error)
          }
        },
      },
    ])
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
        <ScanEquipment
          catalog={allExercises}
          onSelectExercise={onSelectExercise}
          selectedIds={selected}
        />
      </View>

      <View style={styles.viewToggleRow}>
        <View
          style={[styles.viewToggle, { backgroundColor: palette.surfaceAlt }]}
        >
          {(
            [
              { id: 'category', label: 'Categories', icon: 'square.grid.2x2.fill' },
              { id: 'body', label: 'Body map', icon: 'figure.strengthtraining.traditional' },
            ] as const
          ).map((opt) => {
            const active = opt.id === viewMode
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.viewToggleBtn,
                  active && { backgroundColor: palette.surface },
                ]}
                onPress={() => {
                  Haptics.selectionAsync()
                  setViewMode(opt.id)
                }}
                activeOpacity={0.85}
              >
                <IconSymbol
                  name={opt.icon}
                  size={16}
                  color={active ? palette.primary : palette.textSecondary}
                />
                <Text
                  style={[
                    styles.viewToggleLabel,
                    {
                      color: active
                        ? palette.textPrimary
                        : palette.textSecondary,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {viewMode === 'category' ? (
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
                      {
                        color: isActive ? palette.white : palette.textSecondary,
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
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'body' ? (
          <View style={styles.bodyBlock}>
            <BodyPartSelector
              selectedGroup={selectedGroup}
              onSelectGroup={(g) =>
                setSelectedGroup((prev) => (prev === g ? null : g))
              }
            />
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.addCustomRow,
            {
              backgroundColor: palette.primaryMuted,
              borderColor: palette.primaryBorder,
            },
          ]}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.selectionAsync()
            setShowCustomForm(true)
          }}
        >
          <View
            style={[styles.addCustomIcon, { backgroundColor: palette.primary }]}
          >
            <IconSymbol name="plus" size={18} color={palette.white} />
          </View>
          <View style={styles.exerciseBody}>
            <Text style={[styles.exerciseName, { color: palette.textPrimary }]}>
              Add a custom exercise
            </Text>
            <Text
              style={[styles.exerciseMeta, { color: palette.textSecondary }]}
            >
              Save your own movement to reuse later
            </Text>
          </View>
          <IconSymbol
            name="chevron.right"
            size={18}
            color={palette.textTertiary}
          />
        </TouchableOpacity>

        {sections.length === 0 ? (
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
              Try a different search, category, or body part.
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.group} style={styles.section}>
              <Text
                style={[styles.sectionHeader, { color: palette.textSecondary }]}
              >
                {section.label}
              </Text>
              {section.items.map((ex, index) => {
                const isSelected = selected.has(ex.id)
                const isCustom = ex.id.startsWith('custom-')
                return (
                  <Animated.View
                    key={ex.id}
                    entering={FadeInDown.duration(motion.duration.quick).delay(
                      Math.min(index * 20, 120),
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
                      onPress={() => handleOpenDetail(ex)}
                      onLongPress={
                        isCustom ? () => handleDeleteCustom(ex) : undefined
                      }
                    >
                      {mediaByCatalogId.get(ex.id) ? (
                        <Image
                          source={{ uri: mediaByCatalogId.get(ex.id)! }}
                          style={[
                            styles.exerciseThumb,
                            { backgroundColor: palette.white },
                          ]}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={150}
                          accessibilityLabel={`${ex.name} demonstration`}
                        />
                      ) : (
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
                      )}
                      <View style={styles.exerciseBody}>
                        <View style={styles.nameRow}>
                          <Text
                            style={[
                              styles.exerciseName,
                              { color: palette.textPrimary },
                            ]}
                          >
                            {ex.name}
                          </Text>
                          {isCustom ? (
                            <View
                              style={[
                                styles.customTag,
                                { backgroundColor: palette.primaryMuted },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.customTagText,
                                  { color: palette.primary },
                                ]}
                              >
                                Custom
                              </Text>
                            </View>
                          ) : null}
                        </View>
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
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={
                            isSelected
                              ? `Remove ${ex.name}`
                              : `Add ${ex.name}`
                          }
                          hitSlop={10}
                          onPress={() => handleSelect(ex)}
                          style={styles.selectToggle}
                        >
                          <IconSymbol
                            name={isSelected ? 'checkmark' : 'plus'}
                            size={22}
                            color={
                              isSelected ? palette.primary : palette.textTertiary
                            }
                          />
                        </TouchableOpacity>
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
              })}
            </View>
          ))
        )}
      </ScrollView>

      <CustomExerciseForm
        visible={showCustomForm}
        defaultGroup={viewMode === 'body' ? selectedGroup : null}
        onClose={() => setShowCustomForm(false)}
        onCreated={(entry) => {
          setShowCustomForm(false)
          onSelectExercise?.(entry)
        }}
      />
    </View>
  )
}

interface CustomExerciseFormProps {
  visible: boolean
  defaultGroup: BodyGroup | null
  onClose: () => void
  onCreated: (entry: ExerciseEntry) => void
}

function CustomExerciseForm({
  visible,
  defaultGroup,
  onClose,
  onCreated,
}: CustomExerciseFormProps) {
  const { palette } = useTheme()
  const createCustom = useMutation(api.exercises.createCustomExercise)

  const [name, setName] = useState('')
  const [group, setGroup] = useState<BodyGroup>(defaultGroup ?? 'chest')
  const [modality, setModality] = useState<ExerciseModality>('strength')
  const [equipment, setEquipment] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  React.useEffect(() => {
    if (visible) {
      setName('')
      setGroup(defaultGroup ?? 'chest')
      setModality('strength')
      setEquipment('')
      setIsSaving(false)
    }
  }, [visible, defaultGroup])

  if (!visible) return null

  const canSave = name.trim().length > 0 && !isSaving

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const equipmentList = equipment.trim() ? [equipment.trim()] : []
      const newId = await createCustom({
        name: name.trim(),
        group,
        bodyPart: BODY_GROUP_LABELS[group],
        modality,
        equipment: equipmentList,
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onCreated({
        id: `custom-${newId}`,
        name: name.trim(),
        group,
        bodyPart: BODY_GROUP_LABELS[group],
        equipment: equipmentList.join(', ') || 'None',
        modality,
        iconName: ICON_BY_MODALITY[modality],
      })
    } catch (error) {
      console.error('create custom exercise', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setIsSaving(false)
    }
  }

  return (
    <View style={styles.formOverlay} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.formBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          styles.formPanel,
          { backgroundColor: palette.bgElevated, borderColor: palette.border },
        ]}
      >
        <View style={styles.formHeader}>
          <Text style={[styles.formTitle, { color: palette.textPrimary }]}>
            New exercise
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <IconSymbol name="xmark" size={20} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>
            Name
          </Text>
          <TextInput
            style={[
              styles.formInput,
              {
                color: palette.textPrimary,
                backgroundColor: palette.surface,
                borderColor: palette.borderStrong,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cossack squat"
            placeholderTextColor={palette.textTertiary}
            autoFocus
          />

          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>
            Body part
          </Text>
          <View style={styles.formChips}>
            {BODY_GROUPS.map((g) => {
              const active = g.id === group
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setGroup(g.id)
                  }}
                  style={[
                    styles.formChip,
                    {
                      backgroundColor: active
                        ? palette.primary
                        : palette.surface,
                      borderColor: active
                        ? palette.primary
                        : palette.borderStrong,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.formChipLabel,
                      { color: active ? palette.white : palette.textSecondary },
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>
            Type
          </Text>
          <View style={styles.formChips}>
            {MODALITY_OPTIONS.map((m) => {
              const active = m.id === modality
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setModality(m.id)
                  }}
                  style={[
                    styles.formChip,
                    {
                      backgroundColor: active
                        ? palette.primary
                        : palette.surface,
                      borderColor: active
                        ? palette.primary
                        : palette.borderStrong,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.formChipLabel,
                      { color: active ? palette.white : palette.textSecondary },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>
            Equipment (optional)
          </Text>
          <TextInput
            style={[
              styles.formInput,
              {
                color: palette.textPrimary,
                backgroundColor: palette.surface,
                borderColor: palette.borderStrong,
              },
            ]}
            value={equipment}
            onChangeText={setEquipment}
            placeholder="e.g. Dumbbell"
            placeholderTextColor={palette.textTertiary}
          />

          <TouchableOpacity
            style={[
              styles.formSave,
              {
                backgroundColor: canSave ? palette.primary : palette.surfaceAlt,
              },
            ]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.formSaveText,
                { color: canSave ? palette.white : palette.textTertiary },
              ]}
            >
              {isSaving ? 'Saving…' : 'Save & add'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchInputWrapper: {
    flex: 1,
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
  viewToggleRow: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  viewToggleLabel: {
    ...typography.smallStrong,
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
  bodyBlock: {
    marginBottom: spacing.lg,
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  addCustomIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionHeader: {
    ...typography.smallStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  exerciseIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  exerciseBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  customTagText: {
    ...typography.caption,
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
  formOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  formBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  formPanel: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h2,
  },
  formLabel: {
    ...typography.smallStrong,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  formInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
  },
  formChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  formChipLabel: {
    ...typography.smallStrong,
  },
  formSave: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  formSaveText: {
    ...typography.button,
  },
})
