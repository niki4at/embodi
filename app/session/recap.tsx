import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { groupPlanByPhase, PHASE_META } from '@/components/trainer/phases'
import type { ExercisePlan } from '@/components/trainer/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type RecapParams = {
  sessionId?: string
  from?: string
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
  isWarmup?: boolean
}

type Highlight = {
  exerciseName: string
  kind: 'weight' | 'oneRm' | 'reps' | 'duration' | 'distance'
  value: number
  unit: string
  previous: number | null
  isFirstTime: boolean
}

type StatTile = {
  key: string
  icon: React.ComponentProps<typeof IconSymbol>['name']
  value: string
  label: string
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

function highlightLabel(kind: Highlight['kind']): string {
  switch (kind) {
    case 'weight':
      return 'New heaviest'
    case 'oneRm':
      return 'New est. 1RM'
    case 'reps':
      return 'New rep record'
    case 'duration':
      return 'New longest hold'
    case 'distance':
      return 'New farthest'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

function highlightValue(h: Highlight): string {
  return `${h.value.toLocaleString()}${h.unit}`
}

export default function RecapScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<RecapParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined
  const isCompletion = params.from === 'completion'

  const sessionData = useQuery(
    api.trainer.getSessionWithSets,
    sessionId ? { sessionId } : 'skip',
  )
  const insights = useQuery(
    api.sessionInsights.getSessionInsights,
    sessionId ? { sessionId } : 'skip',
  )

  const saveRoutineFromSession = useMutation(
    api.routines.saveRoutineFromSession,
  )
  const generateNote = useAction(api.sessionInsights.generateSessionNote)

  const [isSaveModalVisible, setSaveModalVisible] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [coachNote, setCoachNote] = useState<string | null>(null)
  const [noteLoading, setNoteLoading] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(!isCompletion)

  const session = sessionData?.session
  const sets = useMemo<LoggedSet[]>(
    () => (sessionData?.sets ?? []) as LoggedSet[],
    [sessionData?.sets],
  )
  const isDiscarded = session?.status === 'discarded'

  // Celebrate once when arriving fresh off a completed session.
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (!isCompletion || celebratedRef.current || !session) return
    celebratedRef.current = true
    if (session.status !== 'discarded') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [isCompletion, session])

  // Hybrid AI note: computed stats show instantly; the coach reaction streams
  // in once. Fails soft — an empty result just hides the card.
  const noteRequested = useRef(false)
  useEffect(() => {
    if (!sessionId || noteRequested.current) return
    const status = session?.status
    if (!status) return
    noteRequested.current = true
    if (status === 'discarded') return
    setNoteLoading(true)
    generateNote({ sessionId })
      .then((result) => setCoachNote(result?.trim() ? result.trim() : ''))
      .catch((err) => {
        console.error('session note error', err)
        setCoachNote('')
      })
      .finally(() => setNoteLoading(false))
  }, [sessionId, session?.status, generateNote])

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

  const statTiles = useMemo<StatTile[]>(() => {
    if (!insights) return []
    const tiles: StatTile[] = []
    tiles.push({
      key: 'sets',
      icon: 'checkmark.circle.fill',
      value: `${insights.workingSetsLogged}`,
      label:
        insights.totalTargetSets > 0
          ? `of ${insights.totalTargetSets} sets`
          : 'sets logged',
    })
    if (insights.totalVolumeKg > 0) {
      tiles.push({
        key: 'volume',
        icon: 'scalemass.fill',
        value: insights.totalVolumeKg.toLocaleString(),
        label: 'kg lifted',
      })
    }
    if (insights.totalReps > 0) {
      tiles.push({
        key: 'reps',
        icon: 'repeat',
        value: insights.totalReps.toLocaleString(),
        label: 'total reps',
      })
    }
    if (insights.avgRpe != null) {
      tiles.push({
        key: 'rpe',
        icon: 'flame.fill',
        value: `${insights.avgRpe}`,
        label: 'avg RPE',
      })
    }
    if (insights.totalDistanceM > 0) {
      tiles.push({
        key: 'distance',
        icon: 'ruler',
        value: insights.totalDistanceM.toLocaleString(),
        label: 'metres',
      })
    }
    tiles.push({
      key: 'moves',
      icon: 'dumbbell',
      value: `${insights.exercisesCompleted}`,
      label: 'exercises',
    })
    return tiles.slice(0, 4)
  }, [insights])

  const highlights = (insights?.highlights ?? []) as Highlight[]

  const openSaveModal = useCallback(() => {
    void Haptics.selectionAsync()
    setRoutineName(session?.goal ?? '')
    setSaveModalVisible(true)
  }, [session?.goal])

  const handleSaveRoutine = useCallback(async () => {
    if (!sessionId || isSaving) return
    const name = routineName.trim()
    if (!name) return
    setIsSaving(true)
    try {
      await saveRoutineFromSession({ sessionId, name })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setIsSaved(true)
      setSaveModalVisible(false)
    } catch (err) {
      console.error('save routine error', err)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, isSaving, routineName, saveRoutineFromSession])

  const handleClose = useCallback(() => {
    if (isCompletion) {
      router.replace('/')
    } else {
      router.back()
    }
  }, [isCompletion])

  const renderHeader = (title: string) => (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={handleClose}
        style={[
          styles.iconButton,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isCompletion ? 'Close' : 'Go back'}
      >
        <IconSymbol
          name={isCompletion ? 'xmark' : 'chevron.left'}
          size={20}
          color={palette.textPrimary}
        />
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

  const dateLabel = new Date(
    insights?.dateMs ?? session.updatedAt,
  ).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const displayDurationMin = insights?.durationMin ?? session.durationMin

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
        <Animated.View
          entering={FadeInDown.duration(motion.duration.base)}
          style={styles.hero}
        >
          <View
            style={[
              styles.heroBadge,
              {
                backgroundColor: isDiscarded
                  ? palette.dangerMuted
                  : palette.successMuted,
              },
            ]}
          >
            <IconSymbol
              name={isDiscarded ? 'xmark' : 'checkmark.circle.fill'}
              size={30}
              color={isDiscarded ? palette.danger : palette.success}
            />
          </View>
          <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
            {isDiscarded ? 'Workout discarded' : 'Workout complete'}
          </Text>
          <View style={styles.heroTimeRow}>
            <Text style={[styles.heroTime, { color: palette.textPrimary }]}>
              {displayDurationMin}
            </Text>
            <Text style={[styles.heroTimeUnit, { color: palette.textSecondary }]}>
              min
            </Text>
          </View>
          <Text style={[styles.heroMeta, { color: palette.textSecondary }]}>
            {dateLabel} {'\u00b7'} {session.modality}
          </Text>
        </Animated.View>

        {statTiles.length > 0 && (
          <View style={styles.statsGrid}>
            {statTiles.map((tile) => (
              <View
                key={tile.key}
                style={[
                  styles.statTile,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <IconSymbol
                  name={tile.icon}
                  size={18}
                  color={palette.textTertiary}
                />
                <Text
                  style={[styles.statValue, { color: palette.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {tile.value}
                </Text>
                <Text
                  style={[styles.statLabel, { color: palette.textSecondary }]}
                  numberOfLines={1}
                >
                  {tile.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Highlights
            </Text>
            {highlights.map((h, index) => (
              <View
                key={`${h.exerciseName}-${h.kind}-${index}`}
                style={[
                  styles.highlightRow,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.highlightIcon,
                    { backgroundColor: palette.warningMuted },
                  ]}
                >
                  <IconSymbol
                    name="trophy.fill"
                    size={18}
                    color={palette.warning}
                  />
                </View>
                <View style={styles.highlightBody}>
                  <Text
                    style={[
                      styles.highlightLabel,
                      { color: palette.textSecondary },
                    ]}
                  >
                    {h.isFirstTime ? 'First time logged' : highlightLabel(h.kind)}
                  </Text>
                  <Text
                    style={[
                      styles.highlightName,
                      { color: palette.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {h.exerciseName}
                  </Text>
                </View>
                <View style={styles.highlightValueBox}>
                  <Text
                    style={[styles.highlightValue, { color: palette.success }]}
                  >
                    {highlightValue(h)}
                  </Text>
                  {!h.isFirstTime && h.previous != null && (
                    <Text
                      style={[
                        styles.highlightPrev,
                        { color: palette.textTertiary },
                      ]}
                    >
                      was {h.previous.toLocaleString()}
                      {h.unit}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {!isDiscarded && (noteLoading || (coachNote && coachNote.length > 0)) && (
          <View
            style={[
              styles.noteCard,
              {
                backgroundColor: palette.primaryMuted,
                borderColor: palette.primaryBorder,
              },
            ]}
          >
            <IconSymbol name="sparkles" size={18} color={palette.primary} />
            {noteLoading && !coachNote ? (
              <View style={styles.noteLoadingRow}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text
                  style={[styles.noteLoadingText, { color: palette.textSecondary }]}
                >
                  Coach is reading your session…
                </Text>
              </View>
            ) : (
              <Text style={[styles.noteText, { color: palette.textPrimary }]}>
                {coachNote}
              </Text>
            )}
          </View>
        )}

        {!isDiscarded && (
          <TouchableOpacity
            onPress={openSaveModal}
            disabled={isSaved}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              isSaved ? 'Saved to routines' : 'Save this workout as a routine'
            }
            style={[
              styles.saveButton,
              {
                backgroundColor: isSaved ? palette.surface : palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <IconSymbol
              name={isSaved ? 'checkmark' : 'bookmark'}
              size={18}
              color={isSaved ? palette.success : palette.textPrimary}
            />
            <Text
              style={[styles.saveButtonText, { color: palette.textPrimary }]}
            >
              {isSaved ? 'Saved to routines' : 'Save as routine'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => {
            void Haptics.selectionAsync()
            setBreakdownOpen((prev) => !prev)
          }}
          activeOpacity={0.7}
          style={styles.breakdownToggle}
          accessibilityRole="button"
          accessibilityLabel={
            breakdownOpen ? 'Hide full breakdown' : 'Show full breakdown'
          }
        >
          <Text
            style={[styles.breakdownToggleText, { color: palette.textPrimary }]}
          >
            Full breakdown
          </Text>
          <IconSymbol
            name={breakdownOpen ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={palette.textSecondary}
          />
        </TouchableOpacity>

        {breakdownOpen &&
          groups.map((group) =>
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
                  let warmupCount = 0
                  let workingCount = 0
                  const labeledSets = loggedSets.map((set) => {
                    if (set.isWarmup) {
                      warmupCount += 1
                      return {
                        set,
                        label: `Warm-up ${warmupCount}`,
                        isWarmup: true,
                      }
                    }
                    workingCount += 1
                    return { set, label: `Set ${workingCount}`, isWarmup: false }
                  })
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
                        labeledSets.map(({ set, label, isWarmup }) => (
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
                                {
                                  color: isWarmup
                                    ? palette.warning
                                    : palette.textTertiary,
                                },
                              ]}
                            >
                              {label}
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

        {isCompletion && (
          <View style={styles.doneButton}>
            <PillButton label="Done" onPress={() => router.replace('/')} />
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal
        visible={isSaveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSaveModalVisible(false)}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
              Save as routine
            </Text>
            <Text style={[styles.modalHint, { color: palette.textSecondary }]}>
              Give it a name so you can run it again later.
            </Text>
            <TextInput
              value={routineName}
              onChangeText={setRoutineName}
              placeholder="Routine name"
              placeholderTextColor={palette.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveRoutine}
              maxLength={60}
              style={[
                styles.modalInput,
                {
                  color: palette.textPrimary,
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setSaveModalVisible(false)}
                style={styles.modalCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text
                  style={[styles.modalCancelText, { color: palette.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveRoutine}
                disabled={isSaving || routineName.trim().length === 0}
                style={[
                  styles.modalSave,
                  {
                    backgroundColor: palette.primary,
                    opacity:
                      isSaving || routineName.trim().length === 0 ? 0.5 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Save routine"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  hero: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  heroTime: {
    ...typography.display,
  },
  heroTimeUnit: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  heroMeta: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  statValue: {
    ...typography.metric,
  },
  statLabel: {
    ...typography.small,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightBody: {
    flex: 1,
    gap: 2,
  },
  highlightLabel: {
    ...typography.caption,
  },
  highlightName: {
    ...typography.bodyStrong,
  },
  highlightValueBox: {
    alignItems: 'flex-end',
  },
  highlightValue: {
    ...typography.bodyStrong,
  },
  highlightPrev: {
    ...typography.small,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  noteText: {
    ...typography.body,
    flex: 1,
  },
  noteLoadingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noteLoadingText: {
    ...typography.small,
  },
  saveButton: {
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveButtonText: {
    ...typography.button,
  },
  breakdownToggle: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  breakdownToggleText: {
    ...typography.h3,
  },
  phaseBlock: {
    marginTop: spacing.lg,
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
  doneButton: {
    marginTop: spacing.xxl,
  },
  bottomSpacing: {
    height: spacing.huge,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
  },
  modalHint: {
    ...typography.small,
  },
  modalInput: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalCancel: {
    height: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    ...typography.button,
  },
  modalSave: {
    height: 44,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    ...typography.button,
    color: '#FFFFFF',
  },
})
