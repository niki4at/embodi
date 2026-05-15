import * as Haptics from 'expo-haptics'
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
} from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { SetPayload } from './ExerciseSetRow'
import { ExercisePlan, TrackingMetric, WorkoutSet } from './types'

type ExerciseTableProps = {
  exercise: ExercisePlan
  sets: WorkoutSet[]
  planIndex: number
  planLength: number
  hasLoggedSets: boolean
  showSwipeHint?: boolean
  onSaveSet: (setIndex: number, payload: SetPayload) => Promise<void>
  onRemoveSet?: (setIndex: number) => Promise<void>
  onInsertSetAfter?: (afterSetIndex: number) => Promise<void>
  onDeleteSetAt?: (setIndex: number) => Promise<void>
  onPrefetchComment?: (exerciseId: string) => void
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
}

const COLUMN_CONFIG: Record<TrackingMetric, ColumnConfig> = {
  weight_reps: {
    primaryLabel: 'KG',
    primaryPlaceholder: '—',
    primaryKey: 'weightKg',
    secondaryLabel: 'REPS',
    secondaryPlaceholder: '—',
    secondaryKey: 'reps',
  },
  duration: {
    primaryLabel: 'SEC',
    primaryPlaceholder: '—',
    primaryKey: 'durationSec',
    secondaryLabel: 'RPE',
    secondaryPlaceholder: '—',
    secondaryKey: 'rpe',
  },
  distance: {
    primaryLabel: 'M',
    primaryPlaceholder: '—',
    primaryKey: 'distanceM',
    secondaryLabel: 'RPE',
    secondaryPlaceholder: '—',
    secondaryKey: 'rpe',
  },
  breath: {
    primaryLabel: 'COUNT',
    primaryPlaceholder: '—',
    primaryKey: 'durationSec',
    secondaryLabel: null,
    secondaryPlaceholder: '',
    secondaryKey: null,
  },
  custom: {
    primaryLabel: 'NOTES',
    primaryPlaceholder: 'How it felt',
    primaryKey: 'notes',
    secondaryLabel: null,
    secondaryPlaceholder: '',
    secondaryKey: null,
  },
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
  onSaveSet,
  onRemoveSet,
  onInsertSetAfter,
  onDeleteSetAt,
  onPrefetchComment,
  onReplace,
  onReposition,
  onRemove,
}: ExerciseTableProps) {
  const { palette } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [openSetIndex, setOpenSetIndex] = useState<number | null>(null)

  const columns = COLUMN_CONFIG[exercise.trackingMetric]

  const exerciseSets = useMemo(
    () => sets.filter(s => s.exerciseId === exercise.id),
    [sets, exercise.id],
  )

  const completedCount = exerciseSets.length

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
  const handleToggleExpand = () => {
    setExpanded(prev => !prev)
  }

  const handleToggleRow = useCallback(
    (setNumber: number) => {
      setOpenSetIndex(prev => (prev === setNumber ? null : setNumber))
      onPrefetchComment?.(exercise.id)
    },
    [exercise.id, onPrefetchComment],
  )

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
      const newKey = allocateSlotKey()
      setPrefills(prev =>
        Object.keys(draft).length > 0 ? { ...prev, [newKey]: draft } : prev,
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
    [slots, allocateSlotKey, onInsertSetAfter],
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
      setOpenSetIndex(prev => {
        if (prev == null) return prev
        if (prev === setNumber) return null
        // Anything below the deleted row just shifted up by one.
        return prev > setNumber ? prev - 1 : prev
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
      <Pressable onPress={handleToggleExpand} style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.primary }]}>
            {exercise.name}
          </Text>
          {expanded ? null : (
            <Text
              style={[styles.subtitle, { color: palette.textTertiary }]}
              numberOfLines={1}
            >
              {exercise.bodyPart} · {completedCount}/{exercise.targetSets} sets
            </Text>
          )}
        </View>
        <View
          style={[
            styles.chevWrap,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
            },
          ]}
        >
          <IconSymbol
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={palette.textPrimary}
          />
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={styles.detailBlock}
        >
          {exercise.instructions ? (
            <Text style={[styles.instructions, { color: palette.textSecondary }]}>
              {exercise.instructions}
            </Text>
          ) : null}
          {exercise.cues.length > 0 ? (
            <View style={styles.cueRow}>
              {exercise.cues.map(cue => (
                <View
                  key={cue}
                  style={[
                    styles.cuePill,
                    {
                      backgroundColor: palette.primaryMuted,
                      borderColor: palette.primaryBorder,
                    },
                  ]}
                >
                  <Text style={[styles.cueText, { color: palette.primary }]}>
                    {cue}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <MetaChip
              label={
                exercise.equipment.length
                  ? exercise.equipment.join(' · ')
                  : 'Bodyweight'
              }
            />
            <MetaChip label={`${exercise.tempo} tempo`} />
            <MetaChip label={`${exercise.restSec}s rest`} />
          </View>
        </Animated.View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: palette.divider }]} />

      <View style={styles.headRow}>
        <Text style={[styles.headCellSet, { color: palette.textTertiary }]}>
          SET
        </Text>
        <Text style={[styles.headCellPrev, { color: palette.textTertiary }]}>
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
        <View style={styles.headCellCheck} />
      </View>

      {slots.map((slotKey, idx) => {
        const setNumber = idx + 1
        const existing = exerciseSets.find(s => s.setIndex === setNumber)
        return (
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
              previousLabel={formatPrevious(existing, exercise.trackingMetric)}
              columns={columns}
              existing={existing}
              prefill={prefills[slotKey]}
              isOpen={openSetIndex === setNumber}
              onToggle={() => handleToggleRow(setNumber)}
              onSave={payload => onSaveSet(setNumber, payload)}
              onClear={
                onRemoveSet ? () => onRemoveSet(setNumber) : undefined
              }
            />
          </SwipeableRow>
        )
      })}

      {expanded && (onReplace || onReposition || onRemove) ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.actionsBlock,
            { borderTopColor: palette.divider },
          ]}
        >
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
          <View
            style={[styles.swipeActionIcon, { backgroundColor: palette.success }]}
          >
            <IconSymbol name="plus" size={14} color={palette.white} />
          </View>
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
            <View
              style={[styles.swipeActionIcon, { backgroundColor: palette.danger }]}
            >
              <IconSymbol name="trash" size={14} color={palette.white} />
            </View>
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
  previousLabel: string
  columns: ColumnConfig
  existing: WorkoutSet | undefined
  /**
   * Optional pre-filled draft for placeholder rows created by swipe-to-add.
   * Used only when `existing` is undefined; existing logged data always wins.
   */
  prefill?: SetPayload
  isOpen: boolean
  onToggle: () => void
  onSave: (payload: SetPayload) => Promise<void>
  onClear?: () => Promise<void>
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

const SetRow = forwardRef<SetRowHandle, SetRowProps>(function SetRow(
  {
    setNumber,
    previousLabel,
    columns,
    existing,
    prefill,
    isOpen,
    onToggle,
    onSave,
    onClear,
  },
  ref,
) {
  const { palette } = useTheme()
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

  const [primary, setPrimary] = useState(initialPrimary)
  const [secondary, setSecondary] = useState(initialSecondary)
  const [rpe, setRpe] = useState<number | undefined>(
    fieldFromSource(source, 'rpe') as number | undefined,
  )
  const [notes, setNotes] = useState(
    (fieldFromSource(source, 'notes') as string | undefined) ?? '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

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
        if (rpe != null && columns.secondaryKey !== 'rpe') {
          payload.rpe = rpe
        }
        if (notes.trim() && columns.primaryKey !== 'notes') {
          payload.notes = notes.trim()
        }
        return payload
      },
    }),
    [columns, primary, secondary, rpe, notes],
  )

  const handleClear = async () => {
    if (!onClear || isClearing || isSaving) return
    setIsClearing(true)
    try {
      await onClear()
      setPrimary('')
      setSecondary('')
      setRpe(undefined)
      setNotes('')
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
      if (rpe != null && columns.secondaryKey !== 'rpe') {
        payload.rpe = rpe
      }
      if (notes.trim()) {
        payload.notes = notes.trim()
      }
      await onSave(payload)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[
        styles.rowBlock,
        { backgroundColor: palette.bgElevated },
        completed
          ? { backgroundColor: palette.successMuted }
          : null,
        isOpen
          ? { backgroundColor: palette.surfaceAlt }
          : null,
      ]}
    >
      <Pressable onPress={onToggle} style={styles.row}>
        <Text style={[styles.cellSet, { color: palette.textPrimary }]}>
          {setNumber}
        </Text>
        <Text
          style={[styles.cellPrev, { color: palette.textTertiary }]}
          numberOfLines={1}
        >
          {previousLabel}
        </Text>
        <TextInput
          style={[
            styles.cellInput,
            {
              color: palette.textPrimary,
              backgroundColor: palette.bgElevated,
              borderColor: isOpen ? palette.primary : palette.border,
            },
          ]}
          value={primary}
          onChangeText={setPrimary}
          placeholder={columns.primaryPlaceholder}
          placeholderTextColor={palette.textMuted}
          keyboardType={
            columns.primaryKey === 'notes' ? 'default' : 'numeric'
          }
          onFocus={() => {
            if (!isOpen) onToggle()
          }}
        />
        {columns.secondaryLabel ? (
          <TextInput
            style={[
              styles.cellInput,
              {
                color: palette.textPrimary,
                backgroundColor: palette.bgElevated,
                borderColor: isOpen ? palette.primary : palette.border,
              },
            ]}
            value={secondary}
            onChangeText={setSecondary}
            placeholder={columns.secondaryPlaceholder}
            placeholderTextColor={palette.textMuted}
            keyboardType="numeric"
            onFocus={() => {
              if (!isOpen) onToggle()
            }}
          />
        ) : (
          <View style={styles.cellInput} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            completed ? `Untick set ${setNumber}` : `Log set ${setNumber}`
          }
          accessibilityState={{ checked: completed, disabled: isSaving || isClearing }}
          onPress={completed ? handleClear : handleSave}
          disabled={isSaving || isClearing || (completed && !onClear)}
          style={[
            styles.cellCheck,
            {
              backgroundColor: completed ? palette.success : 'transparent',
              borderColor: completed ? palette.success : palette.border,
            },
          ]}
        >
          {isSaving || isClearing ? (
            <ActivityIndicator
              size="small"
              color={completed ? palette.white : palette.primary}
            />
          ) : (
            <IconSymbol
              name="checkmark"
              size={14}
              color={completed ? palette.white : palette.textTertiary}
            />
          )}
        </Pressable>
      </Pressable>

      {isOpen ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.rowDetail}
        >
          {columns.secondaryKey !== 'rpe' ? (
            <View style={styles.rpeRow}>
              <Text
                style={[styles.rpeLabel, { color: palette.textTertiary }]}
              >
                DISCOMFORT (RPE)
              </Text>
              <View style={styles.rpeScale}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const active = rpe === n
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setRpe(active ? undefined : n)}
                      style={[
                        styles.rpeChip,
                        {
                          backgroundColor: active
                            ? palette.primary
                            : palette.bgElevated,
                          borderColor: active
                            ? palette.primary
                            : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rpeChipText,
                          {
                            color: active
                              ? palette.white
                              : palette.textSecondary,
                          },
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}
          <TextInput
            style={[
              styles.notesInput,
              {
                color: palette.textPrimary,
                backgroundColor: palette.bgElevated,
                borderColor: palette.border,
              },
            ]}
            placeholder="Notes — any pain, form cues, energy?"
            placeholderTextColor={palette.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.saveDetail,
              { backgroundColor: palette.primary },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <Text style={[styles.saveDetailText, { color: palette.white }]}>
                {completed ? 'Update set' : 'Log set'}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  )
})

function MetaChip({ label }: { label: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.metaChip,
        {
          backgroundColor: palette.surfaceAlt,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[styles.metaChipText, { color: palette.textSecondary }]}>
        {label}
      </Text>
    </View>
  )
}

type ActionButtonProps = {
  icon: 'arrow.clockwise' | 'chevron.up' | 'chevron.down' | 'trash'
  label: string
  destructive?: boolean
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}

function ActionButton({
  icon,
  label,
  destructive,
  danger,
  disabled,
  onPress,
}: ActionButtonProps) {
  const { palette } = useTheme()
  const tint = destructive ? palette.danger : palette.textPrimary
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.actionBtn,
        {
          backgroundColor: destructive
            ? danger
              ? palette.dangerMuted
              : palette.surface
            : palette.surface,
          borderColor: destructive
            ? palette.primaryBorder
            : palette.border,
        },
        disabled ? styles.actionDisabled : null,
      ]}
    >
      <IconSymbol name={icon} size={14} color={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
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
  detailBlock: {
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  instructions: {
    ...typography.body,
  },
  cueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  cuePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  cueText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  metaChipText: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.4,
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
    width: 28,
    ...typography.caption,
    fontSize: 10,
  },
  headCellPrev: {
    flex: 1.4,
    ...typography.caption,
    fontSize: 10,
  },
  headCellInput: {
    flex: 1,
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },
  headCellCheck: {
    width: 30,
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
    width: 28,
    ...typography.h3,
    fontSize: 18,
  },
  cellPrev: {
    flex: 1.4,
    ...typography.small,
    fontSize: 12,
  },
  cellInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
    ...typography.bodyStrong,
    fontSize: 14,
  },
  cellCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDetail: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  rpeRow: {
    gap: spacing.xs,
  },
  rpeLabel: {
    ...typography.caption,
  },
  rpeScale: {
    flexDirection: 'row',
    gap: 4,
  },
  rpeChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rpeChipText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    textAlignVertical: 'top',
  },
  saveDetail: {
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveDetailText: {
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
  swipeActionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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
})
