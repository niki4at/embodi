import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { FadeInDown } from 'react-native-reanimated'
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

import CitationsPanel from '@/components/trainer/CitationsPanel'
import CoachBubble from '@/components/trainer/CoachBubble'
import ExerciseMenuSheet from '@/components/trainer/ExerciseMenuSheet'
import type { SetPayload } from '@/components/trainer/ExerciseSetRow'
import ExerciseTable from '@/components/trainer/ExerciseTable'
import { MovementJourneyBar } from '@/components/trainer/MovementJourneyBar'
import {
  computePhaseProgress,
  groupPlanByPhase,
  PHASE_META,
} from '@/components/trainer/phases'
import { CoachComment, ExercisePlan } from '@/components/trainer/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type SessionParams = {
  sessionId?: string
}

type TimerHandle = ReturnType<typeof setTimeout>

const SCROLL_HIDE_DELAY_MS = 1200
const SCROLL_THRESHOLD_PX = 6

export default function SessionScreen() {
  const { palette, resolved, shadows } = useTheme()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<SessionParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined

  const sessionData = useQuery(
    api.trainer.getSessionWithSets,
    sessionId ? { sessionId } : 'skip',
  )
  const onboarding = useQuery(api.onboarding.getOnboarding)
  const logSet = useMutation(api.trainer.logSet)
  const removeSet = useMutation(api.trainer.removeSet)
  const insertSetAfter = useMutation(api.trainer.insertSetAfter)
  const deleteSetAt = useMutation(api.trainer.deleteSetAt)
  const setWarmup = useMutation(api.trainer.setWarmup)
  const completeSession = useMutation(api.trainer.completeSession)
  const discardSession = useMutation(api.trainer.discardSession)
  const reorderExercise = useMutation(api.trainer.reorderSessionExercise)
  const removeExercise = useMutation(api.trainer.removeExerciseFromSession)
  const prefetchComments = useAction(api.trainer.prefetchCoachComments)

  const [showCitations, setShowCitations] = useState(false)
  const [activeComment, setActiveComment] = useState<CoachComment | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null)
  const [journeyVisible, setJourneyVisible] = useState(false)

  const hideTimerRef = useRef<TimerHandle | null>(null)
  const journeyTimerRef = useRef<TimerHandle | null>(null)
  const scheduledTimers = useRef<TimerHandle[]>([])
  const coachQueueRef = useRef<CoachComment[]>([])
  const commentsLoaded = useRef(false)
  const lastScrollY = useRef(0)

  const session = sessionData?.session
  const sets = useMemo(() => sessionData?.sets ?? [], [sessionData?.sets])

  const planExercises = useMemo<ExercisePlan[]>(() => {
    if (!session) return []
    return session.plan.map(exercise => ({
      ...exercise,
      targetReps: Array.isArray(exercise.targetReps)
        ? exercise.targetReps
        : [exercise.targetReps ?? 0],
    }))
  }, [session])

  const groups = useMemo(() => {
    if (!planExercises.length) return []
    return groupPlanByPhase(planExercises)
  }, [planExercises])

  const phaseProgress = useMemo(
    () => computePhaseProgress(planExercises, sets.filter(s => !s.isWarmup)),
    [planExercises, sets],
  )

  const totalTargetSets = useMemo(
    () => planExercises.reduce((acc, ex) => acc + ex.targetSets, 0),
    [planExercises],
  )

  // Warm-up sets prime the body but don't count toward the working-set target,
  // so progress and completion track only working sets.
  const workingSetsLogged = useMemo(
    () => sets.filter(s => !s.isWarmup).length,
    [sets],
  )

  const displayComment = useCallback((comment: CoachComment) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setActiveComment(comment)
    hideTimerRef.current = setTimeout(
      () => setActiveComment(null),
      Math.max((comment.delaySec ?? 5) * 1000, 3500),
    )
  }, [])

  const triggerComment = useCallback(
    (trigger: CoachComment['trigger'], exerciseId?: string) => {
      const idx = coachQueueRef.current.findIndex(comment => {
        if (comment.trigger !== trigger) return false
        if (
          exerciseId &&
          comment.exerciseId &&
          comment.exerciseId !== exerciseId
        )
          return false
        return true
      })
      if (idx === -1) return
      const [comment] = coachQueueRef.current.splice(idx, 1)
      displayComment(comment)
    },
    [displayComment],
  )

  useEffect(() => {
    const timers = scheduledTimers.current
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (journeyTimerRef.current) clearTimeout(journeyTimerRef.current)
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (!session || !onboarding || commentsLoaded.current) return
    if (session.status !== 'generated' && session.status !== 'in-progress')
      return
    commentsLoaded.current = true

    const profilePayload = {
      name: onboarding.name,
      age: onboarding.age,
      gender: onboarding.gender,
      goal: onboarding.goal,
      activityLevel: onboarding.activityLevel,
      timeAvailable: onboarding.timeAvailable,
      injuries: onboarding.injuries,
      conditions: onboarding.conditions,
      medications: onboarding.medications,
      smoking: onboarding.smoking,
      alcohol: onboarding.alcohol,
    }

    prefetchComments({
      profile: profilePayload,
      plan: planExercises,
      durationMin: session.durationMin,
      goal: session.goal,
    })
      .then(comments => {
        const timed = comments.filter(c => c.delaySec)
        const immediate = comments.filter(c => !c.delaySec)
        coachQueueRef.current = immediate
        const startComment = immediate.find(
          c => c.trigger === 'session_start',
        )
        if (startComment) {
          displayComment(startComment)
          coachQueueRef.current = coachQueueRef.current.filter(
            c => c.id !== startComment.id,
          )
        }
        timed.forEach(comment => {
          const timer = setTimeout(
            () => displayComment(comment),
            (comment.delaySec ?? 0) * 1000,
          )
          scheduledTimers.current.push(timer)
        })
      })
      .catch(err => console.error('coach comments error', err))
  }, [session, onboarding, prefetchComments, displayComment, planExercises])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y
      const delta = Math.abs(y - lastScrollY.current)
      lastScrollY.current = y

      if (delta < SCROLL_THRESHOLD_PX) return

      if (!journeyVisible) setJourneyVisible(true)

      if (journeyTimerRef.current) {
        clearTimeout(journeyTimerRef.current)
      }
      journeyTimerRef.current = setTimeout(() => {
        setJourneyVisible(false)
      }, SCROLL_HIDE_DELAY_MS)
    },
    [journeyVisible],
  )

  const handleLogSet = useCallback(
    async (exerciseId: string, setIndex: number, payload: SetPayload) => {
      if (!sessionId) return
      await logSet({
        sessionId,
        exerciseId,
        setIndex,
        ...payload,
      })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      triggerComment('after_set', exerciseId)
    },
    [logSet, sessionId, triggerComment],
  )

  const handleRemoveSet = useCallback(
    async (exerciseId: string, setIndex: number) => {
      if (!sessionId) return
      await removeSet({ sessionId, exerciseId, setIndex })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    },
    [removeSet, sessionId],
  )

  const handleInsertSetAfter = useCallback(
    async (exerciseId: string, afterSetIndex: number) => {
      if (!sessionId) return
      await insertSetAfter({ sessionId, exerciseId, afterSetIndex })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    },
    [insertSetAfter, sessionId],
  )

  const handleDeleteSetAt = useCallback(
    async (exerciseId: string, setIndex: number) => {
      if (!sessionId) return
      await deleteSetAt({ sessionId, exerciseId, setIndex })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    },
    [deleteSetAt, sessionId],
  )

  const handleSetWarmup = useCallback(
    async (exerciseId: string, setIndex: number, isWarmup: boolean) => {
      if (!sessionId) return
      await setWarmup({ sessionId, exerciseId, setIndex, isWarmup })
      await Haptics.selectionAsync()
    },
    [setWarmup, sessionId],
  )

  const handlePrefetchComment = useCallback(
    (exerciseId: string) => triggerComment('before_set', exerciseId),
    [triggerComment],
  )

  // Exercise-level notes captured via the per-exercise "Notes" button.
  // Kept in-memory for the active session; new sets logged after notes are
  // entered persist them via the set's notes field (see ExerciseTable).
  // NOTE: this does not back-fill previously-logged sets. A future change
  // can add a dedicated mutation if cross-session persistence is needed.
  const [exerciseNotesMap, setExerciseNotesMap] = useState<
    Record<string, string>
  >({})

  const handleSaveExerciseNotes = useCallback(
    (exerciseId: string, notes: string) => {
      setExerciseNotesMap(prev => ({ ...prev, [exerciseId]: notes }))
    },
    [],
  )

  const exerciseNotesByExerciseId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const set of sets) {
      if (set.notes && set.notes.trim()) {
        map[set.exerciseId] = set.notes
      }
    }
    return { ...map, ...exerciseNotesMap }
  }, [sets, exerciseNotesMap])

  const handleReposition = useCallback(
    async (exerciseId: string, direction: 'up' | 'down') => {
      if (!sessionId) return
      const currentIndex = planExercises.findIndex(ex => ex.id === exerciseId)
      if (currentIndex === -1) return
      const newIndex =
        direction === 'up'
          ? Math.max(0, currentIndex - 1)
          : Math.min(planExercises.length - 1, currentIndex + 1)
      if (newIndex === currentIndex) return
      await Haptics.selectionAsync()
      await reorderExercise({ sessionId, exerciseId, newIndex })
    },
    [sessionId, planExercises, reorderExercise],
  )

  const handleRemove = useCallback(
    (exerciseId: string, hasSets: boolean) => {
      if (!sessionId) return
      const exercise = planExercises.find(ex => ex.id === exerciseId)
      if (!exercise) return
      Alert.alert(
        `Remove ${exercise.name}?`,
        hasSets
          ? "This pulls the exercise out and deletes the sets you logged. You can't undo this."
          : "This pulls the exercise out of today's session.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              )
              await removeExercise({ sessionId, exerciseId })
            },
          },
        ],
      )
    },
    [sessionId, planExercises, removeExercise],
  )

  const handleReplace = useCallback((exerciseId: string) => {
    setMenuExerciseId(exerciseId)
  }, [])

  const handleCloseMenu = useCallback(() => setMenuExerciseId(null), [])

  const menuExercise = useMemo(
    () => planExercises.find(ex => ex.id === menuExerciseId) ?? null,
    [planExercises, menuExerciseId],
  )

  const menuExerciseHasSets = useMemo(() => {
    if (!menuExerciseId) return false
    return sets.some(set => set.exerciseId === menuExerciseId)
  }, [sets, menuExerciseId])

  const handleCompleteSession = useCallback(async () => {
    if (!sessionId || isCompleting) return
    setIsCompleting(true)
    try {
      await completeSession({ sessionId })
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      )
      router.replace('/')
    } catch (err) {
      console.error('complete session error', err)
      setIsCompleting(false)
    }
  }, [sessionId, completeSession, isCompleting])

  const handleDiscardSession = useCallback(() => {
    if (!sessionId) return
    Alert.alert(
      'Discard workout?',
      "This workout won't be completed. It'll be saved to your history as discarded.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              await discardSession({ sessionId })
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              )
              router.replace('/')
            } catch (err) {
              console.error('discard session error', err)
            }
          },
        },
      ],
    )
  }, [sessionId, discardSession])

  const handleOpenMenu = useCallback(() => {
    Haptics.selectionAsync()
    const buttons: AlertButton[] = []
    if (sessionData?.session && sessionData.session.healthFacts.length > 0) {
      buttons.push({
        text: 'Science behind your session',
        onPress: () => setShowCitations(true),
      })
    }
    buttons.push({
      text: 'Discard workout',
      style: 'destructive',
      onPress: handleDiscardSession,
    })
    buttons.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert('Session options', undefined, buttons)
  }, [sessionData, handleDiscardSession])

  if (!sessionId) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Missing session ID.
        </Text>
      </SafeAreaView>
    )
  }

  if (sessionData === undefined) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Session not available.
        </Text>
      </SafeAreaView>
    )
  }

  if (session.status === 'failed') {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.bg }]}
        edges={['top']}
      >
        <View style={[styles.centered, { backgroundColor: palette.bg }]}>
          <View
            style={[
              styles.failedIcon,
              { backgroundColor: palette.dangerMuted },
            ]}
          >
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={36}
              color={palette.danger}
            />
          </View>
          <Text style={[styles.failedTitle, { color: palette.textPrimary }]}>
            Session generation failed
          </Text>
          <Text
            style={[styles.failedBody, { color: palette.textSecondary }]}
          >
            Something went wrong. Head back and try again.
          </Text>
          <PillButton
            label="Go back"
            onPress={() => router.back()}
            fullWidth={false}
          />
        </View>
      </SafeAreaView>
    )
  }

  const sessionShadow =
    resolved === 'dark' ? shadows.primaryDark : shadows.primary
  const allSetsLogged =
    totalTargetSets > 0 && workingSetsLogged >= totalTargetSets

  return (
    <GestureHandlerRootView style={styles.safeArea}>
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.iconButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconSymbol
            name="chevron.left"
            size={20}
            color={palette.textPrimary}
          />
        </TouchableOpacity>
        <Text
          style={[styles.topBarTitle, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {session.goal}
        </Text>
        <TouchableOpacity
          onPress={handleOpenMenu}
          style={[
            styles.iconButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Session options"
        >
          <IconSymbol name="ellipsis" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>

      <MovementJourneyBar
        progress={phaseProgress}
        visible={journeyVisible}
        topInset={insets.top + 44}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
          <Text style={[styles.sessionTitle, { color: palette.textPrimary }]}>
            Movement journey
          </Text>
          <Text
            style={[styles.sessionMeta, { color: palette.textSecondary }]}
          >
            {session.modality} · {session.durationMin} min · {workingSetsLogged}
            /{totalTargetSets} sets
          </Text>
        </Animated.View>

        {groups.map(group =>
          group.exercises.length === 0 ? null : (
            <View key={group.phase} style={styles.phaseBlock}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseEmoji}>
                  {PHASE_META[group.phase].emoji}
                </Text>
                <Text
                  style={[styles.phaseLabel, { color: palette.primary }]}
                >
                  {PHASE_META[group.phase].label}
                </Text>
              </View>
              {group.exercises.map(({ exercise, planIndex }) => {
                const hasSets = sets.some(s => s.exerciseId === exercise.id)
                return (
                  <ExerciseTable
                    key={exercise.id}
                    exercise={exercise}
                    sets={sets}
                    planIndex={planIndex}
                    planLength={planExercises.length}
                    hasLoggedSets={hasSets}
                    showSwipeHint={planIndex === 0}
                    onSaveSet={(setIndex, payload) =>
                      handleLogSet(exercise.id, setIndex, payload)
                    }
                    onRemoveSet={setIndex =>
                      handleRemoveSet(exercise.id, setIndex)
                    }
                    onInsertSetAfter={afterSetIndex =>
                      handleInsertSetAfter(exercise.id, afterSetIndex)
                    }
                    onDeleteSetAt={setIndex =>
                      handleDeleteSetAt(exercise.id, setIndex)
                    }
                    onSetWarmup={(setIndex, isWarmup) =>
                      handleSetWarmup(exercise.id, setIndex, isWarmup)
                    }
                    onPrefetchComment={handlePrefetchComment}
                    exerciseNotes={exerciseNotesByExerciseId[exercise.id]}
                    onSaveExerciseNotes={notes =>
                      handleSaveExerciseNotes(exercise.id, notes)
                    }
                    onReplace={() => handleReplace(exercise.id)}
                    onReposition={direction =>
                      handleReposition(exercise.id, direction)
                    }
                    onRemove={() => handleRemove(exercise.id, hasSets)}
                  />
                )
              })}
            </View>
          ),
        )}

        {session.status === 'generating' ? (
          <View
            style={[
              styles.generatingPill,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <ActivityIndicator size="small" color={palette.primary} />
            <Text
              style={[styles.generatingText, { color: palette.textSecondary }]}
            >
              More moves on the way…
            </Text>
          </View>
        ) : null}

        <View style={{ height: spacing.huge * 2 }} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: palette.bg, borderTopColor: palette.divider },
        ]}
      >
        <View style={sessionShadow}>
          <PillButton
            label={
              isCompleting
                ? 'Saving'
                : allSetsLogged
                  ? 'Finish session'
                  : 'Complete session'
            }
            onPress={handleCompleteSession}
            disabled={isCompleting}
            loading={isCompleting}
          />
        </View>
      </View>

      <CitationsPanel
        visible={showCitations}
        facts={session.healthFacts}
        onClose={() => setShowCitations(false)}
      />
      <ExerciseMenuSheet
        visible={menuExercise !== null}
        sessionId={sessionId}
        exercise={menuExercise}
        plan={planExercises}
        hasLoggedSets={menuExerciseHasSets}
        onClose={handleCloseMenu}
        initialMode="replace"
      />
      <CoachBubble comment={activeComment} />
    </SafeAreaView>
    </GestureHandlerRootView>
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
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    ...typography.body,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    ...typography.bodyStrong,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge + 80,
  },
  sessionTitle: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  sessionMeta: {
    ...typography.small,
    marginBottom: spacing.lg,
  },
  phaseBlock: {
    marginBottom: spacing.xs,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  phaseEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  phaseLabel: {
    ...typography.h3,
    fontSize: 18,
  },
  generatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  generatingText: {
    ...typography.small,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  failedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  failedTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  failedBody: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
})
