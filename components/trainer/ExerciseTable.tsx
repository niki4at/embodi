import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { SetPayload } from './ExerciseSetRow'
import SetTypePopover, {
  type AnchorRect,
  useSetTypeColors,
} from './SetTypePopover'
import { ExercisePlan, SetType, TrackingMetric, WorkoutSet } from './types'

type ExerciseTableProps = {
  exercise: ExercisePlan
  sets: WorkoutSet[]
  planIndex: number
  planLength: number
  hasLoggedSets: boolean
  showSwipeHint?: boolean
  exerciseNotes?: string
  onSaveSet: (setIndex: number, payload: SetPayload) => Promise<void>
  onRemoveSet?: (setIndex: number) => Promise<void>
  onInsertSetAfter?: (afterSetIndex: number) => Promise<void>
  onDeleteSetAt?: (setIndex: number) => Promise<void>
  onSetType?: (setIndex: number, setType: SetType) => Promise<void>
  onSetRest?: (restSec: number) => Promise<void>
  onPrefetchComment?: (exerciseId: string) => void
  onSaveExerciseNotes?: (notes: string) => Promise<void> | void
  onReplace?: () => void
  onReposition?: (direction: 'up' | 'down') => void
  onRemove?: () => void
}

// Module-level flag so the discoverability wiggle plays at most once per
// app session — enough to surface the gesture without becoming noise.
let hasShownSwipeHint = false

type ColumnConfig = {
  primaryLabel: string
  primaryPlaceholder: string
  primaryKey: keyof SetPayload
  secondaryLabel: string | null
  secondaryPlaceholder: string
  secondaryKey: keyof SetPayload | null
  tertiaryLabel: string | null
  tertiaryPlaceholder: string
  tertiaryKey: keyof SetPayload | null
}

const COLUMN_CONFIG: Record<TrackingMetric, ColumnConfig> = {
  weight_reps: {
    primaryLabel: 'KG',
    primaryPlaceholder: '—',
    primaryKey: 'weightKg',
    secondaryLabel: 'REPS',
    secondaryPlaceholder: '—',
    secondaryKey: 'reps',
    tertiaryLabel: 'RPE',
    tertiaryPlaceholder: '—',
    tertiaryKey: 'rpe',
  },
  duration: {
    primaryLabel: 'SEC',
    primaryPlaceholder: '—',
    primaryKey: 'durationSec',
    secondaryLabel: 'RPE',
    secondaryPlaceholder: '—',
    secondaryKey: 'rpe',
    tertiaryLabel: null,
    tertiaryPlaceholder: '',
    tertiaryKey: null,
  },
  distance: {
    primaryLabel: 'M',
    primaryPlaceholder: '—',
    primaryKey: 'distanceM',
    secondaryLabel: 'RPE',
    secondaryPlaceholder: '—',
    secondaryKey: 'rpe',
    tertiaryLabel: null,
    tertiaryPlaceholder: '',
    tertiaryKey: null,
  },
  breath: {
    primaryLabel: 'COUNT',
    primaryPlaceholder: '—',
    primaryKey: 'durationSec',
    secondaryLabel: null,
    secondaryPlaceholder: '',
    secondaryKey: null,
    tertiaryLabel: null,
    tertiaryPlaceholder: '',
    tertiaryKey: null,
  },
  custom: {
    primaryLabel: 'NOTES',
    primaryPlaceholder: 'How it felt',
    primaryKey: 'notes',
    secondaryLabel: null,
    secondaryPlaceholder: '',
    secondaryKey: null,
    tertiaryLabel: null,
    tertiaryPlaceholder: '',
    tertiaryKey: null,
  },
}

function formatRest(seconds: number): string {
  if (seconds <= 0) return 'Off'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}:${s.toString().padStart(2, '0')}`
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function formatPrevious(set: WorkoutSet | undefined, metric: TrackingMetric) {
  if (!set) return '—'
  if (metric === 'weight_reps') {
    const w = set.weightKg
    const r = set.reps
    if (w == null && r == null) return '—'
    return `${w ?? '–'}kg×${r ?? '–'}`
  }
  if (metric === 'duration' || metric === 'breath') {
    return set.durationSec != null ? `${set.durationSec}s` : '—'
  }
  if (metric === 'distance') {
    return set.distanceM != null ? `${set.distanceM}m` : '—'
  }
  return set.notes ? set.notes.slice(0, 18) : '—'
}

/**
 * Minimal table-style exercise card with expandable details. Replaces the
 * verbose WorkoutCard with a row-based layout that matches the "Movement
 * journey" Figma. Per-set RPE + notes live in an inline row expansion;
 * coaching cues, instructions, and the options menu live behind the
 * card-level chevron.
 */
export default function ExerciseTable({
  exercise,
  sets,
  planIndex,
  planLength,
  hasLoggedSets,
  showSwipeHint,
  exerciseNotes,
  onSaveSet,
  onRemoveSet,
  onInsertSetAfter,
  onDeleteSetAt,
  onSetType,
  onSetRest,
  onPrefetchComment,
  onSaveExerciseNotes,
  onReplace,
  onReposition,
  onRemove,
}: ExerciseTableProps) {
  const { palette } = useTheme()
  // Tapping the exercise name opens the full detail screen (demo + how-to +
  // stats + coach). Actions (Notes / Replace / Move / Remove) live behind the
  // chevron.
  const [actionsOpen, setActionsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(exerciseNotes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [restDraft, setRestDraft] = useState(exercise.restSec)

  useEffect(() => {
    setRestDraft(exercise.restSec)
  }, [exercise.restSec])

  const adjustRest = useCallback(
    (delta: number) => {
      setRestDraft(prev => {
        const next = Math.max(0, Math.min(600, prev + delta))
        if (next !== prev && onSetRest) {
          void onSetRest(next).catch(() => {})
        }
        return next
      })
      void Haptics.selectionAsync().catch(() => {})
    },
    [onSetRest],
  )

  const hasNotes = (exerciseNotes ?? '').trim().length > 0

  useEffect(() => {
    if (!notesOpen) setNotesDraft(exerciseNotes ?? '')
  }, [exerciseNotes, notesOpen])

  const openNotes = useCallback(() => {
    setNotesDraft(exerciseNotes ?? '')
    setNotesOpen(true)
  }, [exerciseNotes])

  const closeNotes = useCallback(() => {
    setNotesOpen(false)
  }, [])

  const saveNotes = useCallback(async () => {
    if (savingNotes) return
    setSavingNotes(true)
    try {
      await Promise.resolve(onSaveExerciseNotes?.(notesDraft.trim()))
      setNotesOpen(false)
    } finally {
      setSavingNotes(false)
    }
  }, [notesDraft, onSaveExerciseNotes, savingNotes])

  const columns = COLUMN_CONFIG[exercise.trackingMetric]

  const exerciseSets = useMemo(
    () => sets.filter(s => s.exerciseId === exercise.id),
    [sets, exercise.id],
  )

  const maxLoggedSetIndex = useMemo(
    () =>
      exerciseSets.reduce((max, set) => Math.max(max, set.setIndex), 0),
    [exerciseSets],
  )

  // Each row gets a stable key independent of its current setIndex so
  // splicing in/out animates the actually-swiped row, not the last row.
  // The position of a key in `slots` is its 1-indexed setIndex.
  const slotIdRef = useRef(0)
  const allocateSlotKey = useCallback(
    () => `slot-${exercise.id}-${++slotIdRef.current}`,
    [exercise.id],
  )

  const [slots, setSlots] = useState<string[]>(() =>
    Array.from({ length: Math.max(1, exercise.targetSets) }, () => {
      slotIdRef.current += 1
      return `slot-${exercise.id}-${slotIdRef.current}`
    }),
  )
  const [prefills, setPrefills] = useState<Record<string, SetPayload>>({})
  // Set-type intent keyed by stable slot key (not setIndex, which shifts when
  // rows are added/removed). A logged set's persisted type is the fallback;
  // the local override gives instant feedback before the backend round-trips
  // and carries intent for rows that aren't logged yet.
  const [setTypeBySlot, setSetTypeBySlot] = useState<Record<string, SetType>>(
    {},
  )
  // Which row (by 1-indexed setNumber) currently has the set-type popover
  // open, plus the screen-space rect of its chip so the popover can anchor
  // itself right over the tapped set.
  const [sheetForSet, setSheetForSet] = useState<number | null>(null)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const setRowRefs = useRef(new Map<string, SetRowHandle | null>())

  // Logged data on the backend can outpace local slot count (e.g. another
  // device added a set). Grow slots so every logged setIndex has a row.
  useEffect(() => {
    if (maxLoggedSetIndex > slots.length) {
      const additional = maxLoggedSetIndex - slots.length
      setSlots(prev => {
        const next = [...prev]
        for (let i = 0; i < additional; i += 1) {
          slotIdRef.current += 1
          next.push(`slot-${exercise.id}-${slotIdRef.current}`)
        }
        return next
      })
    }
  }, [maxLoggedSetIndex, slots.length, exercise.id])

  const rowCount = slots.length

  const resolveSetType = useCallback(
    (slotKey: string, existing: WorkoutSet | undefined): SetType =>
      setTypeBySlot[slotKey] ??
      existing?.setType ??
      (existing?.isWarmup ? 'warmup' : 'normal'),
    [setTypeBySlot],
  )

  // Resolve each visible row to its data + set type, then number warm-up and
  // working sets on separate tracks (W1, W2… vs 1, 2, 3…). Failure/drop sets
  // show their letter so the set column communicates the role at a glance.
  const rows = useMemo(() => {
    let warmupCount = 0
    let workingCount = 0
    return slots.map((slotKey, idx) => {
      const setNumber = idx + 1
      const existing = exerciseSets.find(s => s.setIndex === setNumber)
      const setType = resolveSetType(slotKey, existing)
      let label: string
      if (setType === 'warmup') {
        warmupCount += 1
        label = `W${warmupCount}`
      } else if (setType === 'failure') {
        label = 'F'
      } else if (setType === 'drop') {
        label = 'D'
      } else {
        workingCount += 1
        label = String(workingCount)
      }
      return { slotKey, setNumber, existing, setType, label }
    })
  }, [slots, exerciseSets, resolveSetType])

  const handleOpenSetType = useCallback(
    (setNumber: number, rect: AnchorRect) => {
      void Haptics.selectionAsync().catch(() => {})
      setAnchorRect(rect)
      setSheetForSet(setNumber)
    },
    [],
  )

  const handleSelectSetType = useCallback(
    (setNumber: number, type: SetType) => {
      const slotKey = slots[setNumber - 1]
      if (!slotKey) return
      setSetTypeBySlot(prev => ({ ...prev, [slotKey]: type }))
      const existing = exerciseSets.find(s => s.setIndex === setNumber)
      if (existing && onSetType) {
        void onSetType(setNumber, type).catch(() => {})
      }
    },
    [slots, exerciseSets, onSetType],
  )

  const handleOpenDetail = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
    const payload = {
      catalogId: exercise.catalogId,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      modality: exercise.modality,
      equipment: exercise.equipment,
      instructions: exercise.instructions,
      cues: exercise.cues,
      tempo: exercise.tempo,
      restSec: exercise.restSec,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      durationMin: exercise.durationMin,
      intensityCue: exercise.intensityCue,
      contraindications: exercise.contraindications,
      trackingMetric: exercise.trackingMetric,
    }
    router.push({
      pathname: '/exercise/[id]',
      params: {
        id: exercise.catalogId ?? exercise.id,
        mode: 'session',
        payload: JSON.stringify(payload),
      },
    })
  }, [exercise])
  const handleToggleActions = useCallback(() => {
    setActionsOpen(prev => !prev)
  }, [])

  const handlePrefetchComment = useCallback(() => {
    onPrefetchComment?.(exercise.id)
  }, [exercise.id, onPrefetchComment])

  const registerRowRef = useCallback(
    (slotKey: string) => (handle: SetRowHandle | null) => {
      if (handle) {
        setRowRefs.current.set(slotKey, handle)
      } else {
        setRowRefs.current.delete(slotKey)
      }
    },
    [],
  )

  const handleSwipeAddAfter = useCallback(
    async (setNumber: number) => {
      const sourceKey = slots[setNumber - 1]
      const draft =
        setRowRefs.current.get(sourceKey)?.getDraftPayload() ?? {}
      const sourceType = resolveSetType(
        sourceKey,
        exerciseSets.find(s => s.setIndex === setNumber),
      )
      const newKey = allocateSlotKey()
      setPrefills(prev =>
        Object.keys(draft).length > 0 ? { ...prev, [newKey]: draft } : prev,
      )
      // A cloned row inherits the source's role so swiping under a warm-up
      // keeps building warm-ups (and likewise for failure/drop sets).
      setSetTypeBySlot(prev =>
        sourceType !== 'normal' ? { ...prev, [newKey]: sourceType } : prev,
      )
      // Splice after the swiped row so the new placeholder is the next
      // setIndex; rows below shift down by one.
      setSlots(prev => {
        const next = [...prev]
        next.splice(setNumber, 0, newKey)
        return next
      })
      if (onInsertSetAfter) {
        await onInsertSetAfter(setNumber).catch(() => {})
      }
    },
    [slots, exerciseSets, resolveSetType, allocateSlotKey, onInsertSetAfter],
  )

  const handleSwipeDelete = useCallback(
    async (setNumber: number) => {
      // Refuse to drop the last visible row — there must always be at
      // least one slot so the user can keep logging.
      if (slots.length <= 1) return
      const slotKey = slots[setNumber - 1]
      setSlots(prev => prev.filter((_, i) => i + 1 !== setNumber))
      setPrefills(prev => {
        if (!(slotKey in prev)) return prev
        const next = { ...prev }
        delete next[slotKey]
        return next
      })
      setSetTypeBySlot(prev => {
        if (!(slotKey in prev)) return prev
        const next = { ...prev }
        delete next[slotKey]
        return next
      })
      if (onDeleteSetAt) {
        await onDeleteSetAt(setNumber).catch(() => {})
      }
    },
    [slots, onDeleteSetAt],
  )

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[
        styles.card,
        {
          backgroundColor: palette.bgElevated,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleOpenDetail}
          accessibilityRole="button"
          accessibilityLabel="Open exercise details"
          style={styles.headerText}
        >
          <Text style={[styles.title, { color: palette.primary }]}>
            {exercise.name}
          </Text>
          <Text
            style={[styles.subtitle, { color: palette.textTertiary }]}
            numberOfLines={1}
          >
            {exercise.bodyPart}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleToggleActions}
          accessibilityRole="button"
          accessibilityLabel={
            actionsOpen ? 'Hide exercise actions' : 'Show exercise actions'
          }
          style={[
            styles.chevWrap,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
            },
          ]}
        >
          <IconSymbol
            name={actionsOpen ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={palette.textPrimary}
          />
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.divider }]} />

      <View style={styles.headRow}>
        <Text style={[styles.headCellSet, { color: palette.textTertiary }]}>
          SET
        </Text>
        <Text
          style={[
            styles.headCellPrev,
            columns.tertiaryLabel ? styles.headCellPrevCompact : null,
            { color: palette.textTertiary },
          ]}
        >
          PREVIOUS
        </Text>
        <Text style={[styles.headCellInput, { color: palette.textTertiary }]}>
          {columns.primaryLabel}
        </Text>
        {columns.secondaryLabel ? (
          <Text
            style={[styles.headCellInput, { color: palette.textTertiary }]}
          >
            {columns.secondaryLabel}
          </Text>
        ) : (
          <View style={styles.headCellInput} />
        )}
        {columns.tertiaryLabel ? (
          <Text
            style={[styles.headCellInput, { color: palette.textTertiary }]}
          >
            {columns.tertiaryLabel}
          </Text>
        ) : null}
        <View style={styles.headCellCheck} />
      </View>

      {rows.map(({ slotKey, setNumber, existing, setType, label }) => (
        <SwipeableRow
          key={slotKey}
          showHint={showSwipeHint && setNumber === 1}
          canDelete={rowCount > 1}
          onSwipeAddAfter={() => handleSwipeAddAfter(setNumber)}
          onSwipeDelete={() => handleSwipeDelete(setNumber)}
        >
          <SetRow
            ref={registerRowRef(slotKey)}
            setNumber={setNumber}
            displayLabel={label}
            setType={setType}
            previousLabel={formatPrevious(existing, exercise.trackingMetric)}
            columns={columns}
            existing={existing}
            prefill={prefills[slotKey]}
            exerciseNotes={exerciseNotes}
            onSave={payload => onSaveSet(setNumber, payload)}
            onClear={onRemoveSet ? () => onRemoveSet(setNumber) : undefined}
            onOpenSetType={rect => handleOpenSetType(setNumber, rect)}
            onFirstFocus={handlePrefetchComment}
          />
        </SwipeableRow>
      ))}

      <SetTypePopover
        visible={sheetForSet != null}
        anchor={anchorRect}
        current={
          sheetForSet != null
            ? resolveSetType(
                slots[sheetForSet - 1],
                exerciseSets.find(s => s.setIndex === sheetForSet),
              )
            : 'normal'
        }
        canRemove={rowCount > 1}
        onSelect={type => {
          if (sheetForSet != null) handleSelectSetType(sheetForSet, type)
        }}
        onRemove={() => {
          if (sheetForSet != null) void handleSwipeDelete(sheetForSet)
        }}
        onClose={() => setSheetForSet(null)}
      />

      {actionsOpen ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.actionsBlock,
            { borderTopColor: palette.divider },
          ]}
        >
          {onSetRest ? (
            <View
              style={[
                styles.restStepper,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <IconSymbol name="timer" size={14} color={palette.textTertiary} />
              <Pressable
                onPress={() => adjustRest(-15)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Decrease rest by 15 seconds"
                style={styles.restStepBtn}
              >
                <IconSymbol name="minus" size={14} color={palette.textPrimary} />
              </Pressable>
              <Text style={[styles.restValue, { color: palette.textPrimary }]}>
                {formatRest(restDraft)}
              </Text>
              <Pressable
                onPress={() => adjustRest(15)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Increase rest by 15 seconds"
                style={styles.restStepBtn}
              >
                <IconSymbol name="plus" size={14} color={palette.textPrimary} />
              </Pressable>
            </View>
          ) : null}
          <ActionButton
            icon="square.and.pencil"
            label="Notes"
            onPress={openNotes}
            active={hasNotes}
          />
          {onReplace ? (
            <ActionButton
              icon="arrow.clockwise"
              label="Replace"
              onPress={onReplace}
            />
          ) : null}
          {onReposition && planLength > 1 ? (
            <>
              <ActionButton
                icon="chevron.up"
                label="Move up"
                disabled={planIndex === 0}
                onPress={() => onReposition('up')}
              />
              <ActionButton
                icon="chevron.down"
                label="Move down"
                disabled={planIndex === planLength - 1}
                onPress={() => onReposition('down')}
              />
            </>
          ) : null}
          {onRemove ? (
            <ActionButton
              icon="trash"
              label="Remove"
              destructive
              onPress={onRemove}
              danger={hasLoggedSets}
            />
          ) : null}
        </Animated.View>
      ) : null}

      <Modal
        visible={notesOpen}
        transparent
        animationType="fade"
        onRequestClose={closeNotes}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.notesModalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeNotes}
            accessibilityRole="button"
            accessibilityLabel="Close notes"
          />
          <View
            style={[
              styles.notesModalCard,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.notesModalHeader}>
              <Text
                style={[
                  styles.notesModalTitle,
                  { color: palette.textPrimary },
                ]}
                numberOfLines={1}
              >
                {exercise.name} notes
              </Text>
              <Pressable
                onPress={closeNotes}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[
                  styles.notesModalClose,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                ]}
              >
                <IconSymbol name="xmark" size={14} color={palette.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Form cues, energy, anything to remember next time..."
              placeholderTextColor={palette.textMuted}
              multiline
              autoFocus
              style={[
                styles.notesModalInput,
                {
                  color: palette.textPrimary,
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            />
            <Pressable
              onPress={saveNotes}
              disabled={savingNotes}
              accessibilityRole="button"
              style={[
                styles.notesModalSave,
                { backgroundColor: palette.primary },
                savingNotes ? styles.notesModalSaveBusy : null,
              ]}
            >
              {savingNotes ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text
                  style={[styles.notesModalSaveText, { color: palette.white }]}
                >
                  Save notes
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  )
}

const SWIPE_TRIGGER = 72
const SWIPE_SPACER_WIDTH = 120
const SNAPPY_LAYOUT = LinearTransition.springify()
  .damping(20)
  .stiffness(380)
  .mass(0.55)

type SwipeableRowProps = {
  children: React.ReactNode
  onSwipeAddAfter: () => Promise<void>
  onSwipeDelete: () => Promise<void>
  showHint?: boolean
  canDelete: boolean
}

/**
 * Each row sits over a split backdrop: a green "Add set" panel anchored
 * to the leading edge (revealed by swiping the row to the right) and a
 * red "Delete" panel on the trailing edge (revealed by swiping left).
 * The row's own surface stays opaque, so colour only appears in the
 * revealed strip — never bleeds through the card at rest.
 */
function SwipeableRow({
  children,
  onSwipeAddAfter,
  onSwipeDelete,
  showHint,
  canDelete,
}: SwipeableRowProps) {
  const { palette } = useTheme()
  const ref = useRef<SwipeableMethods>(null)
  // Programmatic open during the discoverability hint would otherwise
  // fire the same callbacks as a real user swipe. This ref guards the
  // open handler for the brief duration of the nudge.
  const hintActive = useRef(false)

  const handleOpen = useCallback(
    (direction: 'left' | 'right') => {
      if (hintActive.current) return
      // ReanimatedSwipeable reports the swipe direction (where the finger
      // travelled), not the side that opened. Right swipe reveals the
      // left/green "Add" panel; left swipe reveals the right/red "Delete".
      if (direction === 'right') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        void onSwipeAddAfter()
        ref.current?.close()
      } else if (direction === 'left') {
        if (!canDelete) {
          ref.current?.close()
          return
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        void onSwipeDelete()
        // For non-trailing deletes the row component is reused with the
        // shifted-up data, so close so the new content lands centered.
        setTimeout(() => ref.current?.close(), 80)
      }
    },
    [canDelete, onSwipeAddAfter, onSwipeDelete],
  )

  useEffect(() => {
    if (!showHint || hasShownSwipeHint) return
    hasShownSwipeHint = true
    const open = setTimeout(() => {
      hintActive.current = true
      ref.current?.openLeft()
    }, 600)
    const close = setTimeout(() => {
      ref.current?.close()
    }, 1050)
    const reset = setTimeout(() => {
      hintActive.current = false
    }, 1500)
    return () => {
      clearTimeout(open)
      clearTimeout(close)
      clearTimeout(reset)
    }
  }, [showHint])

  return (
    <Animated.View layout={SNAPPY_LAYOUT} style={styles.swipeWrap}>
      <View style={styles.swipeBackdrop} pointerEvents="none">
        <View
          style={[
            styles.swipeBackdropHalf,
            styles.swipeBackdropLeft,
            { backgroundColor: palette.successMuted },
          ]}
        >
          <IconSymbol name="plus" size={18} color={palette.success} />
          <Text style={[styles.swipeActionLabel, { color: palette.success }]}>
            Add set
          </Text>
        </View>
        {canDelete ? (
          <View
            style={[
              styles.swipeBackdropHalf,
              styles.swipeBackdropRight,
              { backgroundColor: palette.dangerMuted },
            ]}
          >
            <Text style={[styles.swipeActionLabel, { color: palette.danger }]}>
              Delete
            </Text>
            <IconSymbol name="trash" size={18} color={palette.danger} />
          </View>
        ) : (
          <View style={styles.swipeBackdropHalf} />
        )}
      </View>
      <ReanimatedSwipeable
        ref={ref}
        friction={1}
        leftThreshold={SWIPE_TRIGGER}
        rightThreshold={SWIPE_TRIGGER}
        overshootFriction={8}
        overshootLeft={false}
        overshootRight={false}
        // Right-side (delete) gesture stays armed only when there's a row
        // to actually remove. Lifting the activation threshold prevents a
        // single-row card from registering a left swipe at all, so the
        // tap-to-expand handler won't fire by accident.
        dragOffsetFromRightEdge={canDelete ? 10 : 9999}
        renderLeftActions={() => <View style={styles.swipeSpacer} />}
        renderRightActions={
          canDelete ? () => <View style={styles.swipeSpacer} /> : undefined
        }
        onSwipeableOpen={handleOpen}
      >
        {children}
      </ReanimatedSwipeable>
    </Animated.View>
  )
}

type SetRowProps = {
  setNumber: number
  /** Role-aware label shown in the SET column ("1", "2" …, "W1", "F", "D"). */
  displayLabel: string
  setType: SetType
  previousLabel: string
  columns: ColumnConfig
  existing: WorkoutSet | undefined
  /**
   * Optional pre-filled draft for placeholder rows created by swipe-to-add.
   * Used only when `existing` is undefined; existing logged data always wins.
   */
  prefill?: SetPayload
  /**
   * Exercise-level notes piggybacked into each saved set so notes captured
   * via the header "Notes" button persist alongside metric data.
   */
  exerciseNotes?: string
  onSave: (payload: SetPayload) => Promise<void>
  onClear?: () => Promise<void>
  onOpenSetType?: (rect: AnchorRect) => void
  onFirstFocus?: () => void
}

type SetRowHandle = {
  /**
   * Snapshots the row's current input values so swipe-to-add can clone
   * them into the new unchecked row that appears beneath it.
   */
  getDraftPayload: () => SetPayload
}

function fieldFromSource<K extends keyof WorkoutSet>(
  source: WorkoutSet | SetPayload | undefined,
  key: K,
): WorkoutSet[K] | undefined {
  if (!source) return undefined
  return (source as Partial<WorkoutSet>)[key]
}

type CellInputProps = {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  keyboardType?: 'default' | 'numeric'
  onActivate?: () => void
}

/**
 * Cell input that stays inert (editable={false}) until the user taps it.
 * The wrapping Pressable handles the "is this a tap" decision; horizontal
 * swipes and vertical scrolls travel through to the parent gesture
 * handlers because a non-editable TextInput never claims the touch.
 */
function CellInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'numeric',
  onActivate,
}: CellInputProps) {
  const { palette } = useTheme()
  const inputRef = useRef<TextInput>(null)
  const [editing, setEditing] = useState(false)

  // Focus only after the editable=true prop has rendered, otherwise the
  // native side ignores the focus call.
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handlePress = useCallback(() => {
    if (editing) return
    setEditing(true)
    onActivate?.()
  }, [editing, onActivate])

  return (
    <Pressable
      onPress={handlePress}
      style={styles.cellInput}
      android_disableSound
    >
      <TextInput
        ref={inputRef}
        editable={editing}
        value={value}
        onChangeText={onChangeText}
        placeholder={editing ? '' : placeholder}
        placeholderTextColor={palette.textMuted}
        keyboardType={keyboardType}
        onBlur={() => setEditing(false)}
        style={[styles.cellInputText, { color: palette.textPrimary }]}
      />
    </Pressable>
  )
}

const SetRow = forwardRef<SetRowHandle, SetRowProps>(function SetRow(
  {
    setNumber,
    displayLabel,
    setType,
    previousLabel,
    columns,
    existing,
    prefill,
    exerciseNotes,
    onSave,
    onClear,
    onOpenSetType,
    onFirstFocus,
  },
  ref,
) {
  const { palette } = useTheme()
  const setTypeColors = useSetTypeColors()
  const typeColor = setTypeColors[setType]
  const isNormal = setType === 'normal'
  const completed = Boolean(existing)
  // Logged data wins; otherwise fall back to a swipe-to-add prefill so the
  // new row arrives populated with the same kg/reps/sec/rpe/notes the user
  // is staring at on the row above.
  const source: WorkoutSet | SetPayload | undefined = existing ?? prefill

  const initialPrimary =
    columns.primaryKey === 'notes'
      ? ((fieldFromSource(source, 'notes') as string | undefined) ?? '')
      : source != null
        ? String(
            (fieldFromSource(source, columns.primaryKey as keyof WorkoutSet) as
              | number
              | undefined) ?? '',
          )
        : ''

  const initialSecondary =
    columns.secondaryKey != null && source != null
      ? String(
          (fieldFromSource(source, columns.secondaryKey as keyof WorkoutSet) as
            | number
            | undefined) ?? '',
        )
      : ''

  const initialTertiary =
    columns.tertiaryKey != null && source != null
      ? String(
          (fieldFromSource(source, columns.tertiaryKey as keyof WorkoutSet) as
            | number
            | undefined) ?? '',
        )
      : ''

  const [primary, setPrimary] = useState(initialPrimary)
  const [secondary, setSecondary] = useState(initialSecondary)
  const [tertiary, setTertiary] = useState(initialTertiary)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const firstFocusFiredRef = useRef(false)
  const chipRef = useRef<View>(null)

  // Measure the chip in window coordinates so the popover can anchor itself
  // right over the tapped set instead of sliding up from the screen bottom.
  const handleChipPress = useCallback(() => {
    if (!onOpenSetType) return
    chipRef.current?.measureInWindow((x, y, width, height) => {
      onOpenSetType({ x, y, width, height })
    })
  }, [onOpenSetType])

  const handleFirstFocus = useCallback(() => {
    if (firstFocusFiredRef.current) return
    firstFocusFiredRef.current = true
    onFirstFocus?.()
  }, [onFirstFocus])

  const completedProgress = useSharedValue(completed ? 1 : 0)
  const pulse = useSharedValue(1)
  const prevCompletedRef = useRef(completed)

  useEffect(() => {
    completedProgress.value = withTiming(completed ? 1 : 0, { duration: 240 })
    if (completed && !prevCompletedRef.current) {
      pulse.value = withSequence(
        withTiming(1.025, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 260, mass: 0.4 }),
      )
    }
    prevCompletedRef.current = completed
  }, [completed, completedProgress, pulse])

  // Rows rest neutral; the coloured set-chip carries the type identity. On
  // completion the fill matches the type (amber warm-up, green normal, red
  // failure, blue drop).
  const restColor = palette.bgElevated
  const fillColor = typeColor.fill

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      completedProgress.value,
      [0, 1],
      [restColor, fillColor],
    ),
    transform: [{ scale: pulse.value }],
  }))

  useImperativeHandle(
    ref,
    () => ({
      getDraftPayload: () => {
        const payload: SetPayload = {}
        if (columns.primaryKey === 'notes') {
          if (primary.trim()) payload.notes = primary.trim()
        } else if (primary.trim()) {
          const value = parseNumber(primary)
          if (value != null) {
            ;(payload as Record<string, unknown>)[columns.primaryKey] = value
          }
        }
        if (columns.secondaryKey && secondary.trim()) {
          const value = parseNumber(secondary)
          if (value != null) {
            ;(payload as Record<string, unknown>)[columns.secondaryKey] = value
          }
        }
        if (columns.tertiaryKey && tertiary.trim()) {
          const value = parseNumber(tertiary)
          if (value != null) {
            ;(payload as Record<string, unknown>)[columns.tertiaryKey] = value
          }
        }
        if (exerciseNotes && exerciseNotes.trim() && columns.primaryKey !== 'notes') {
          payload.notes = exerciseNotes.trim()
        }
        payload.setType = setType
        payload.isWarmup = setType === 'warmup'
        return payload
      },
    }),
    [columns, primary, secondary, tertiary, exerciseNotes, setType],
  )

  const handleClear = async () => {
    if (!onClear || isClearing || isSaving) return
    setIsClearing(true)
    try {
      await onClear()
      setPrimary('')
      setSecondary('')
      setTertiary('')
    } finally {
      setIsClearing(false)
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const payload: SetPayload = {}
      if (columns.primaryKey === 'notes') {
        payload.notes = primary.trim() || undefined
      } else if (primary.trim()) {
        const value = parseNumber(primary)
        if (value != null) {
          ;(payload as Record<string, unknown>)[columns.primaryKey] = value
        }
      }
      if (columns.secondaryKey && secondary.trim()) {
        const value = parseNumber(secondary)
        if (value != null) {
          ;(payload as Record<string, unknown>)[columns.secondaryKey] = value
        }
      }
      if (columns.tertiaryKey && tertiary.trim()) {
        const value = parseNumber(tertiary)
        if (value != null) {
          ;(payload as Record<string, unknown>)[columns.tertiaryKey] = value
        }
      }
      if (exerciseNotes && exerciseNotes.trim() && columns.primaryKey !== 'notes') {
        payload.notes = exerciseNotes.trim()
      }
      // Always carry the current role so editing/re-ticking a typed set never
      // silently demotes it back to a normal working set.
      payload.setType = setType
      payload.isWarmup = setType === 'warmup'
      await onSave(payload)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[styles.rowBlock, rowAnimatedStyle]}
    >
      <View style={styles.row}>
        <Pressable
          ref={chipRef}
          onPress={handleChipPress}
          disabled={!onOpenSetType}
          accessibilityRole="button"
          accessibilityLabel={`Set ${setNumber}, type ${setType}. Tap to change set type.`}
          hitSlop={6}
          style={styles.cellSet}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.setChip,
                {
                  borderColor: isNormal ? palette.border : typeColor.tint,
                  backgroundColor: palette.bgElevated,
                },
                pressed ? styles.setChipPressed : null,
              ]}
            >
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[
                  styles.setChipText,
                  { color: isNormal ? palette.textSecondary : typeColor.tint },
                ]}
              >
                {displayLabel}
              </Text>
            </View>
          )}
        </Pressable>
        <Text
          style={[
            styles.cellPrev,
            columns.tertiaryLabel ? styles.cellPrevCompact : null,
            { color: palette.textTertiary },
          ]}
          numberOfLines={1}
        >
          {previousLabel}
        </Text>
        <CellInput
          value={primary}
          onChangeText={setPrimary}
          placeholder={columns.primaryPlaceholder}
          keyboardType={
            columns.primaryKey === 'notes' ? 'default' : 'numeric'
          }
          onActivate={handleFirstFocus}
        />
        {columns.secondaryLabel ? (
          <CellInput
            value={secondary}
            onChangeText={setSecondary}
            placeholder={columns.secondaryPlaceholder}
            keyboardType="numeric"
            onActivate={handleFirstFocus}
          />
        ) : (
          <View style={styles.cellInput} />
        )}
        {columns.tertiaryLabel ? (
          <CellInput
            value={tertiary}
            onChangeText={setTertiary}
            placeholder={columns.tertiaryPlaceholder}
            keyboardType="numeric"
            onActivate={handleFirstFocus}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            completed ? `Untick set ${setNumber}` : `Log set ${setNumber}`
          }
          accessibilityState={{ checked: completed, disabled: isSaving || isClearing }}
          onPress={completed ? handleClear : handleSave}
          disabled={isSaving || isClearing || (completed && !onClear)}
          style={styles.cellCheck}
        >
          {isSaving || isClearing ? (
            <ActivityIndicator
              size="small"
              color={
                completed
                  ? isNormal
                    ? palette.success
                    : typeColor.tint
                  : palette.primary
              }
            />
          ) : (
            <IconSymbol
              name="checkmark"
              size={completed ? 20 : 16}
              color={
                completed
                  ? isNormal
                    ? palette.success
                    : typeColor.tint
                  : palette.textMuted
              }
            />
          )}
        </Pressable>
      </View>
    </Animated.View>
  )
})

type ActionButtonProps = {
  icon:
    | 'arrow.clockwise'
    | 'chevron.up'
    | 'chevron.down'
    | 'trash'
    | 'square.and.pencil'
  label: string
  destructive?: boolean
  danger?: boolean
  disabled?: boolean
  active?: boolean
  onPress: () => void
}

function ActionButton({
  icon,
  label,
  destructive,
  danger,
  disabled,
  active,
  onPress,
}: ActionButtonProps) {
  const { palette } = useTheme()
  const tint = destructive
    ? palette.danger
    : active
      ? palette.primary
      : palette.textPrimary
  const background = destructive
    ? danger
      ? palette.dangerMuted
      : palette.surface
    : active
      ? palette.primaryMuted
      : palette.surface
  const border = destructive
    ? palette.primaryBorder
    : active
      ? palette.primaryBorder
      : palette.border
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.actionBtn,
        { backgroundColor: background, borderColor: border },
        disabled ? styles.actionDisabled : null,
      ]}
    >
      <IconSymbol name={icon} size={14} color={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
      {active ? (
        <View style={[styles.notesDot, { backgroundColor: palette.primary }]} />
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    fontSize: 22,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  chevWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  headCellSet: {
    width: 46,
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },
  headCellPrev: {
    flex: 1.4,
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },
  headCellPrevCompact: {
    flex: 1.0,
  },
  headCellInput: {
    flex: 1,
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },
  headCellCheck: {
    width: 34,
  },
  rowBlock: {
    borderRadius: radius.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  cellSet: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setChip: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setChipPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  setChipText: {
    ...typography.smallStrong,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  cellPrev: {
    flex: 1.4,
    ...typography.small,
    fontSize: 12,
    textAlign: 'center',
  },
  cellPrevCompact: {
    flex: 1.0,
  },
  cellInput: {
    flex: 1,
    justifyContent: 'center',
  },
  cellInputText: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: 'transparent',
    ...typography.bodyStrong,
    fontSize: 14,
  },
  cellCheck: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notesModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  notesModalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notesModalTitle: {
    flex: 1,
    ...typography.bodyStrong,
  },
  notesModalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesModalInput: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    textAlignVertical: 'top',
  },
  notesModalSave: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  notesModalSaveBusy: {
    opacity: 0.7,
  },
  notesModalSaveText: {
    ...typography.bodyStrong,
  },
  swipeWrap: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    marginVertical: 2,
  },
  swipeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  swipeBackdropHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  swipeBackdropLeft: {
    justifyContent: 'flex-start',
  },
  swipeBackdropRight: {
    justifyContent: 'flex-end',
  },
  swipeSpacer: {
    width: SWIPE_SPACER_WIDTH,
  },
  swipeActionLabel: {
    ...typography.smallStrong,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  actionsBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  restStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  restStepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restValue: {
    ...typography.smallStrong,
    fontSize: 12,
    minWidth: 34,
    textAlign: 'center',
  },
})
