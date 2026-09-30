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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'

import AddExerciseSheet from '@/components/trainer/AddExerciseSheet'
import CitationsPanel from '@/components/trainer/CitationsPanel'
import CoachBubble from '@/components/trainer/CoachBubble'
import ExerciseMenuSheet from '@/components/trainer/ExerciseMenuSheet'
import ExerciseTable from '@/components/trainer/ExerciseTable'
import { HurtSheet, type HurtReport } from '@/components/trainer/HurtSheet'
import {
  computePhaseProgress,
  groupPlanByPhase,
  PHASE_META,
  type ExercisePhase,
} from '@/components/trainer/phases'
import { CoachComment, ExercisePlan } from '@/components/trainer/types'
import WorkoutTimer from '@/components/trainer/WorkoutTimer'
import { BodfitWordmark } from '@/components/ui/bodfit-logo'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { Eyebrow } from '@/components/ui/primitives'
import { gradients, motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useSessionLogging } from '@/hooks/use-session-logging'

type SessionParams = {
  sessionId?: string
  intent?: string
}

type TimerHandle = ReturnType<typeof setTimeout>

const PHASE_DOT: Record<ExercisePhase, 'energyOkay' | 'energyLow' | 'flare'> = {
  warmup: 'energyOkay',
  main: 'energyLow',
  cooldown: 'flare',
}

export default function SessionScreen() {
  const { palette } = useTheme()
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
  const completeSession = useMutation(api.trainer.completeSession)
  const discardSession = useMutation(api.trainer.discardSession)
  const markSessionStarted = useMutation(api.trainer.markSessionStarted)
  const reorderExercise = useMutation(api.trainer.reorderSessionExercise)
  const removeExercise = useMutation(api.trainer.removeExerciseFromSession)
  const setExerciseSkipped = useMutation(api.trainer.setExerciseSkipped)
  const setFlareUp = useMutation(api.flareUp.setFlareUp)
  const flare = useQuery(api.flareUp.getFlareUp)
  const prefetchComments = useAction(api.trainer.prefetchCoachComments)

  const [showCitations, setShowCitations] = useState(false)
  const [activeComment, setActiveComment] = useState<CoachComment | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [hurtOpen, setHurtOpen] = useState(false)
  const [menuPrompt, setMenuPrompt] = useState<string | undefined>(undefined)
  const swapIntentHandled = useRef(false)

  const hideTimerRef = useRef<TimerHandle | null>(null)
  const scheduledTimers = useRef<TimerHandle[]>([])
  const coachQueueRef = useRef<CoachComment[]>([])
  const commentsLoaded = useRef(false)

  const session = sessionData?.session
  const isCustomSession = session?.source === 'custom'
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
    if (!planExercises.length || isCustomSession) return []
    return groupPlanByPhase(planExercises)
  }, [isCustomSession, planExercises])

  const phaseProgress = useMemo(
    () => computePhaseProgress(planExercises, sets.filter(s => !s.isWarmup)),
    [planExercises, sets],
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

    const coachCommentPlan = planExercises.map(
      ({ skipped: _skipped, ...exercise }) => exercise,
    )

    prefetchComments({
      profile: profilePayload,
      plan: coachCommentPlan,
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

  // Stamp startedAt the first time the live screen opens for this session so
  // the overall workout timer survives backgrounding and app restarts.
  const startMarkedRef = useRef(false)
  useEffect(() => {
    if (!sessionId || !session || startMarkedRef.current) return
    if (session.startedAt != null) {
      startMarkedRef.current = true
      return
    }
    if (session.status === 'generated' || session.status === 'in-progress') {
      startMarkedRef.current = true
      markSessionStarted({ sessionId }).catch(err =>
        console.error('mark session started error', err),
      )
    }
  }, [session, sessionId, markSessionStarted])

  const handleAfterSetLogged = useCallback(
    (exerciseId: string) => triggerComment('after_set', exerciseId),
    [triggerComment],
  )

  const {
    totalTargetSets,
    workingSetsLogged,
    handleLogSet,
    handleRemoveSet,
    handleInsertSetAfter,
    handleDeleteSetAt,
    handleSetType,
    handleSetRest,
    handleToggleSkip,
  } = useSessionLogging({
    sessionId,
    planExercises,
    sets,
    onAfterSetLogged: handleAfterSetLogged,
  })

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
    setMenuPrompt(undefined)
    setMenuExerciseId(exerciseId)
  }, [])

  const handleCloseMenu = useCallback(() => {
    setMenuExerciseId(null)
    setMenuPrompt(undefined)
  }, [])

  // Per-exercise journey status: done when all target sets are logged, "now"
  // is the first unfinished exercise, "next" the one after it.
  const exerciseStatus = useMemo(() => {
    const map = new Map<string, 'done' | 'now' | 'next' | 'idle'>()
    let nowAssigned = false
    let nextAssigned = false
    for (const exercise of planExercises) {
      if (exercise.skipped) {
        map.set(exercise.id, 'idle')
        continue
      }
      const logged = sets.filter(
        s => s.exerciseId === exercise.id && !s.isWarmup,
      ).length
      if (exercise.targetSets > 0 && logged >= exercise.targetSets) {
        map.set(exercise.id, 'done')
      } else if (!nowAssigned) {
        map.set(exercise.id, 'now')
        nowAssigned = true
      } else if (!nextAssigned) {
        map.set(exercise.id, 'next')
        nextAssigned = true
      } else {
        map.set(exercise.id, 'idle')
      }
    }
    return map
  }, [planExercises, sets])

  const currentExercise = useMemo(
    () =>
      planExercises.find(ex => exerciseStatus.get(ex.id) === 'now') ?? null,
    [planExercises, exerciseStatus],
  )

  // "Swap a move or shorten it" from the ready screen lands here with
  // intent=swap: open the replace sheet on the current exercise once.
  useEffect(() => {
    if (params.intent !== 'swap' || swapIntentHandled.current) return
    if (!currentExercise) return
    swapIntentHandled.current = true
    setMenuExerciseId(currentExercise.id)
  }, [params.intent, currentExercise])

  const persistHurtArea = useCallback(
    async (area: string) => {
      const regions = Array.from(new Set([...(flare?.regions ?? []), area]))
      await setFlareUp({ active: true, regions }).catch(err =>
        console.error('flare-up update error', err),
      )
    },
    [flare?.regions, setFlareUp],
  )

  const handleHurtAccept = useCallback(
    async (report: HurtReport) => {
      setHurtOpen(false)
      await persistHurtArea(report.area)
      if (!sessionId || !currentExercise) return
      switch (report.severity) {
        case 'twinge':
          return
        case 'sore':
          setMenuPrompt(
            `Swap this for a variation that spares my ${report.areaLabel.toLowerCase()} and keeps the same muscle group.`,
          )
          setMenuExerciseId(currentExercise.id)
          return
        case 'stop':
          await setExerciseSkipped({
            sessionId,
            exerciseId: currentExercise.id,
            skipped: true,
          }).catch(err => console.error('skip error', err))
          return
        default: {
          const _exhaustive: never = report.severity
          return _exhaustive
        }
      }
    },
    [persistHurtArea, sessionId, currentExercise, setExerciseSkipped],
  )

  const handleHurtNote = useCallback(
    async (report: HurtReport) => {
      setHurtOpen(false)
      await persistHurtArea(report.area)
    },
    [persistHurtArea],
  )

  const handleOpenAddExercise = useCallback(() => {
    Haptics.selectionAsync()
    setAddSheetOpen(true)
  }, [])

  const handleCloseAddExercise = useCallback(() => setAddSheetOpen(false), [])

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
      const streak = await completeSession({ sessionId })
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      )
      router.replace({
        pathname: '/session/recap',
        params: {
          sessionId: String(sessionId),
          from: 'completion',
          ...(streak?.streakIncremented
            ? { streakWeeks: String(streak.currentStreakWeeks) }
            : {}),
        },
      })
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

  const allSetsLogged =
    totalTargetSets > 0 && workingSetsLogged >= totalTargetSets
  const setsProgress =
    totalTargetSets > 0 ? Math.min(1, workingSetsLogged / totalTargetSets) : 0

  const currentSetNumber = currentExercise
    ? sets.filter(s => s.exerciseId === currentExercise.id && !s.isWarmup)
        .length + 1
    : null

  const renderExerciseTable = (exercise: ExercisePlan, planIndex: number) => {
    const hasSets = sets.some(s => s.exerciseId === exercise.id)
    return (
      <View key={exercise.id} style={styles.tableWrap}>
        <ExerciseTable
          exercise={exercise}
          sets={sets}
          sessionId={sessionId}
          planIndex={planIndex}
          planLength={planExercises.length}
          hasLoggedSets={hasSets}
          showSwipeHint={planIndex === 0}
          status={exerciseStatus.get(exercise.id) ?? 'idle'}
          onSaveSet={(setIndex, payload) =>
            handleLogSet(exercise.id, setIndex, payload)
          }
          onRemoveSet={setIndex => handleRemoveSet(exercise.id, setIndex)}
          onInsertSetAfter={afterSetIndex =>
            handleInsertSetAfter(exercise.id, afterSetIndex)
          }
          onDeleteSetAt={setIndex => handleDeleteSetAt(exercise.id, setIndex)}
          onSetType={(setIndex, setType) =>
            handleSetType(exercise.id, setIndex, setType)
          }
          onSetRest={restSec => handleSetRest(exercise.id, restSec)}
          onPrefetchComment={handlePrefetchComment}
          exerciseNotes={exerciseNotesByExerciseId[exercise.id]}
          onSaveExerciseNotes={notes => handleSaveExerciseNotes(exercise.id, notes)}
          onReplace={() => handleReplace(exercise.id)}
          onReposition={direction => handleReposition(exercise.id, direction)}
          onRemove={() => handleRemove(exercise.id, hasSets)}
          skipped={exercise.skipped}
          onToggleSkip={next => handleToggleSkip(exercise.id, next)}
        />
      </View>
    )
  }

  const phaseStatus = (phase: ExercisePhase) => {
    const stats = phaseProgress.find(p => p.phase === phase)
    if (!stats || stats.total === 0) return null
    if (stats.completed >= stats.total) return 'done' as const
    if (stats.completed > 0) return 'in-progress' as const
    return 'start' as const
  }

  return (
    <GestureHandlerRootView style={styles.safeArea}>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.bg }]}
        edges={['top']}
      >
        <View style={[styles.topBar, { borderBottomColor: palette.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.topBarSide}
          >
            <IconSymbol name="arrow.left" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            {session.status === 'generated' ||
            session.status === 'in-progress' ? (
              <WorkoutTimer
                startedAt={session.startedAt}
                plannedDurationMin={session.durationMin}
              />
            ) : null}
          </View>
          <View style={[styles.topBarSide, styles.topBarRight]}>
            <TouchableOpacity
              onPress={handleOpenMenu}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Session options"
            >
              <BodfitWordmark variant="header" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
        >
          <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
            <View style={styles.titleRow}>
              <Text style={[styles.sessionTitle, { color: palette.textPrimary }]}>
                {isCustomSession ? session.goal : 'Movement journey'}
              </Text>
              <Text
                style={[styles.setsCount, { color: palette.textSecondary }]}
                accessibilityLabel={`${workingSetsLogged} of ${totalTargetSets} sets logged`}
              >
                {workingSetsLogged} / {totalTargetSets} SETS
              </Text>
            </View>
            <View
              style={[styles.progressTrack, { backgroundColor: palette.surfaceHigh }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(setsProgress * 100) }}
            >
              <LinearGradient
                colors={[...gradients.hero]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.progressFill, { width: `${Math.max(2, setsProgress * 100)}%` }]}
              />
            </View>
          </Animated.View>

          {isCustomSession
            ? planExercises.map((exercise, planIndex) =>
                renderExerciseTable(exercise, planIndex),
              )
            : groups.map(group => {
                if (group.exercises.length === 0) return null
                const status = phaseStatus(group.phase)
                return (
                  <View key={group.phase} style={styles.phaseBlock}>
                    <Eyebrow
                      dot={palette[PHASE_DOT[group.phase]]}
                      right={
                        status ? (
                          <View
                            style={[
                              styles.statusPill,
                              {
                                backgroundColor:
                                  status === 'done'
                                    ? palette.successMuted
                                    : status === 'in-progress'
                                      ? palette.warningMuted
                                      : palette.flareMuted,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                {
                                  color:
                                    status === 'done'
                                      ? palette.success
                                      : status === 'in-progress'
                                        ? palette.warning
                                        : palette.flare,
                                },
                              ]}
                            >
                              {status === 'done'
                                ? 'DONE'
                                : status === 'in-progress'
                                  ? 'IN PROGRESS'
                                  : 'START'}
                            </Text>
                          </View>
                        ) : undefined
                      }
                      style={styles.phaseHeader}
                    >
                      {PHASE_META[group.phase].label}
                    </Eyebrow>
                    {group.exercises.map(({ exercise, planIndex }) =>
                      renderExerciseTable(exercise, planIndex),
                    )}
                  </View>
                )
              })}

          {session.status === 'generating' ? (
            <View style={styles.generatingPill} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={palette.primary} />
              <Text
                style={[styles.generatingText, { color: palette.textSecondary }]}
              >
                More moves on the way
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleOpenAddExercise}
            accessibilityRole="button"
            accessibilityLabel="Add an exercise"
            style={styles.addRow}
          >
            <IconSymbol name="plus" size={16} color={palette.primary} />
            <Text style={[styles.addText, { color: palette.primary }]}>Add a move</Text>
          </TouchableOpacity>

          <View style={{ height: spacing.huge * 2 + 40 }} />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: palette.bg }]}>
          <CoachBubble comment={activeComment} />
          <PillButton
            variant="gradient"
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
          <PillButton
            label="Something hurts"
            variant="secondary"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              setHurtOpen(true)
            }}
          />
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
          initialPrompt={menuPrompt}
        />
        <AddExerciseSheet
          visible={addSheetOpen}
          sessionId={sessionId}
          onClose={handleCloseAddExercise}
        />
        <HurtSheet
          visible={hurtOpen}
          onClose={() => setHurtOpen(false)}
          exerciseName={currentExercise?.name ?? null}
          contextLine={
            currentExercise
              ? `${currentExercise.name}, set ${currentSetNumber}. Picked up from this move.`
              : 'Tell the coach where it hurts and today adapts.'
          }
          onAccept={report => void handleHurtAccept(report)}
          onNoteOnly={report => void handleHurtNote(report)}
        />
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarSide: {
    width: 90,
    justifyContent: 'center',
  },
  topBarRight: {
    alignItems: 'flex-end',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionTitle: {
    ...typography.h1,
    fontSize: 22,
    flexShrink: 1,
  },
  setsCount: {
    ...typography.mono,
    fontSize: 11,
    paddingBottom: 4,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  phaseBlock: {
    marginTop: spacing.xl,
  },
  phaseHeader: {
    marginBottom: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  statusPillText: {
    ...typography.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  tableWrap: {
    marginBottom: spacing.md,
  },
  generatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  generatingText: {
    ...typography.small,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  addText: {
    ...typography.smallStrong,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
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
