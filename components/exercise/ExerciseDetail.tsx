import { useQuery } from 'convex/react'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ExerciseCoachChat } from '@/components/coach/ExerciseCoachChat'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { ICON_BY_MODALITY } from '@/constants/exercise-catalog'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { emitSelectionToggle } from '@/utils/exerciseSelectionBus'

export type DetailExercise = {
  catalogId?: string
  name: string
  bodyPart: string
  modality: string
  equipment: string[]
  instructions?: string
  cues?: string[]
  tempo?: string
  restSec?: number
  targetSets?: number
  targetReps?: number[]
  durationMin?: number
  intensityCue?: string
  contraindications?: string[]
  trackingMetric?:
    | 'weight_reps'
    | 'duration'
    | 'distance'
    | 'breath'
    | 'custom'
}

type ExerciseDetailProps = {
  exercise: DetailExercise
  mode: 'library' | 'session'
  initialSelected?: boolean
  /**
   * Focus-mode extras. `headerAccessory` renders under the top bar (session
   * progress dots), `logSlot` renders right below the name/chips (the live
   * set-logging table), and `extraBottomPadding` reserves room for a sticky
   * footer owned by the parent screen.
   */
  headerAccessory?: React.ReactNode
  logSlot?: React.ReactNode
  extraBottomPadding?: number
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  const days = Math.floor(diff / day)
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} wk${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} mo${months === 1 ? '' : 's'} ago`
}

export function ExerciseDetail({
  exercise,
  mode,
  initialSelected = false,
  headerAccessory,
  logSlot,
  extraBottomPadding = 0,
}: ExerciseDetailProps) {
  const { palette, resolved, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  const [statsOpen, setStatsOpen] = useState(mode === 'library')
  const [chatOpen, setChatOpen] = useState(false)
  const [selected, setSelected] = useState(initialSelected)

  const media = useQuery(api.exerciseMedia.getExerciseMedia, {
    catalogId: exercise.catalogId ?? exercise.name,
  })
  const history = useQuery(api.exerciseStats.getExerciseHistory, {
    catalogId: exercise.catalogId,
    name: exercise.name,
  })

  const fallbackIcon = ICON_BY_MODALITY[
    exercise.modality as keyof typeof ICON_BY_MODALITY
  ] ?? 'dumbbell.fill'

  const instructionSteps = useMemo<string[]>(() => {
    if (media?.instructions && media.instructions.length > 0) {
      return media.instructions
    }
    if (exercise.instructions && exercise.instructions.trim().length > 0) {
      // Split a paragraph into sentence-ish steps so it reads like a how-to.
      return exercise.instructions
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return ['Move with control through a full, pain-free range and breathe steadily.']
  }, [media, exercise.instructions])

  const muscleChips = useMemo<string[]>(() => {
    const chips: string[] = []
    if (media?.target) chips.push(media.target)
    else chips.push(exercise.bodyPart)
    for (const m of media?.secondaryMuscles ?? []) {
      if (!chips.includes(m)) chips.push(m)
    }
    return chips.slice(0, 4)
  }, [media, exercise.bodyPart])

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {})
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  const handleAddToWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    emitSelectionToggle({
      id: exercise.catalogId ?? exercise.name,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      modality: exercise.modality,
      equipment: exercise.equipment.join(', '),
    })
    setSelected((prev) => !prev)
  }

  const records = history?.records
  const hasRecords =
    records != null && records.totalSets > 0

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <IconSymbol
            name="chevron.down"
            size={20}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <View style={styles.iconButton} />
      </View>

      {headerAccessory}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.huge + extraBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero: animated demo or icon fallback */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: media?.gifUrl ? '#FFFFFF' : palette.surfaceAlt,
              borderColor: palette.border,
            },
          ]}
        >
          {media?.gifUrl ? (
            <Image
              source={{ uri: media.gifUrl }}
              style={styles.gif}
              contentFit="contain"
              transition={200}
              autoplay
              accessibilityLabel={`${exercise.name} demonstration`}
            />
          ) : (
            <View
              style={[
                styles.gifFallback,
                { backgroundColor: palette.primaryMuted },
              ]}
            >
              <IconSymbol
                name={fallbackIcon}
                size={56}
                color={palette.primary}
              />
              <Text
                style={[styles.gifFallbackText, { color: palette.textTertiary }]}
              >
                {media === undefined ? 'Loading demo…' : 'Demo coming soon'}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: palette.textPrimary }]}>
          {exercise.name}
        </Text>
        <View style={styles.chipRow}>
          {muscleChips.map((chip) => (
            <View
              key={chip}
              style={[
                styles.chip,
                {
                  backgroundColor: palette.primaryMuted,
                  borderColor: palette.primaryBorder,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: palette.primary }]}>
                {chip}
              </Text>
            </View>
          ))}
          {exercise.equipment.length > 0 ? (
            <View
              style={[
                styles.chip,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.chipText, { color: palette.textSecondary }]}>
                {exercise.equipment.join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Live set logging (focus mode only) */}
        {logSlot ? (
          <>
            <SectionLabel text="Log your sets" />
            <View
              style={[
                styles.logCard,
                {
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.border,
                },
              ]}
            >
              {logSlot}
            </View>
          </>
        ) : null}

        {/* How to */}
        <SectionLabel text="How to" />
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          {instructionSteps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View
                style={[styles.stepNum, { backgroundColor: palette.primaryMuted }]}
              >
                <Text style={[styles.stepNumText, { color: palette.primary }]}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={[styles.stepText, { color: palette.textPrimary }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        {exercise.cues && exercise.cues.length > 0 ? (
          <View style={styles.cueWrap}>
            {exercise.cues.map((cue) => (
              <View
                key={cue}
                style={[
                  styles.cuePill,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.cueText, { color: palette.textSecondary }]}>
                  {cue}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Stats expander (collapsed by default in session mode) */}
        {mode === 'session' ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              setStatsOpen((p) => !p)
            }}
            style={[
              styles.expandRow,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <IconSymbol
              name="chart.bar.fill"
              size={18}
              color={palette.primary}
            />
            <Text style={[styles.expandText, { color: palette.textPrimary }]}>
              View my stats
            </Text>
            <IconSymbol
              name={statsOpen ? 'chevron.up' : 'chevron.down'}
              size={18}
              color={palette.textTertiary}
            />
          </Pressable>
        ) : null}

        {statsOpen ? (
          <>
            <SectionLabel text="My records" />
            {hasRecords && records ? (
              <View style={styles.recordGrid}>
                {records.heaviestWeightKg != null ? (
                  <RecordCell
                    label="Heaviest"
                    value={`${records.heaviestWeightKg} kg`}
                  />
                ) : null}
                {records.estimatedOneRepMaxKg != null ? (
                  <RecordCell
                    label="Est. 1RM"
                    value={`${records.estimatedOneRepMaxKg} kg`}
                  />
                ) : null}
                {records.bestSetVolumeKg != null ? (
                  <RecordCell
                    label="Best set"
                    value={`${records.bestSetVolumeKg} kg`}
                  />
                ) : null}
                {records.longestDurationSec != null ? (
                  <RecordCell
                    label="Longest"
                    value={`${records.longestDurationSec}s`}
                  />
                ) : null}
                {records.farthestDistanceM != null ? (
                  <RecordCell
                    label="Farthest"
                    value={`${records.farthestDistanceM} m`}
                  />
                ) : null}
                {records.bestReps != null ? (
                  <RecordCell label="Best reps" value={`${records.bestReps}`} />
                ) : null}
                <RecordCell
                  label="Sessions"
                  value={`${records.totalSessions}`}
                />
              </View>
            ) : (
              <EmptyState
                text={
                  history === undefined
                    ? 'Loading your records…'
                    : 'No records yet. Log a set and your bests show up here.'
                }
              />
            )}

            <SectionLabel text="History" />
            {history && history.entries.length > 0 ? (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                {history.entries.slice(0, 8).map((entry, idx) => (
                  <View
                    key={entry.sessionId}
                    style={[
                      styles.historyRow,
                      idx > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: palette.divider,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.historyDate, { color: palette.textPrimary }]}
                    >
                      {formatRelative(entry.performedAt)}
                    </Text>
                    <Text
                      style={[styles.historySets, { color: palette.textSecondary }]}
                      numberOfLines={2}
                    >
                      {entry.sets
                        .map((s) => {
                          if (s.weightKg != null && s.reps != null)
                            return `${s.weightKg}kg×${s.reps}`
                          if (s.reps != null) return `${s.reps} reps`
                          if (s.durationSec != null) return `${s.durationSec}s`
                          if (s.distanceM != null) return `${s.distanceM}m`
                          return '—'
                        })
                        .join('  ·  ')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                text={
                  history === undefined
                    ? 'Loading history…'
                    : "No data yet. Once you log this exercise, you'll see every session here."
                }
              />
            )}
          </>
        ) : null}

        {/* Chat with coach */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
            setChatOpen(true)
          }}
          style={[
            styles.coachCta,
            {
              backgroundColor: palette.primaryMuted,
              borderColor: palette.primaryBorder,
            },
          ]}
        >
          <View
            style={[styles.coachIcon, { backgroundColor: palette.primary }]}
          >
            <IconSymbol name="sparkles" size={18} color={palette.white} />
          </View>
          <View style={styles.coachTextWrap}>
            <Text style={[styles.coachTitle, { color: palette.textPrimary }]}>
              Chat with coach
            </Text>
            <Text
              style={[styles.coachSub, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              Ask about form, progress, or how to load it today
            </Text>
          </View>
          <IconSymbol
            name="chevron.right"
            size={18}
            color={palette.textTertiary}
          />
        </Pressable>

        {media?.attribution ? (
          <Text style={[styles.attribution, { color: palette.textTertiary }]}>
            {media.attribution}
          </Text>
        ) : null}
      </ScrollView>

      {mode === 'library' ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.bgElevated,
              borderTopColor: palette.divider,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <Pressable
            onPress={handleAddToWorkout}
            style={({ pressed }) => [
              styles.addCta,
              {
                backgroundColor: selected ? palette.surfaceHigh : palette.primary,
                opacity: pressed ? 0.9 : 1,
              },
              !selected &&
                (resolved === 'dark' ? shadows.primaryDark : shadows.primary),
            ]}
            accessibilityRole="button"
          >
            <IconSymbol
              name={selected ? 'checkmark' : 'plus'}
              size={18}
              color={selected ? palette.textPrimary : palette.white}
            />
            <Text
              style={[
                styles.addCtaText,
                { color: selected ? palette.textPrimary : palette.white },
              ]}
            >
              {selected ? 'Added to workout' : 'Add to workout'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ExerciseCoachChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        catalogId={exercise.catalogId ?? exercise.name}
        exerciseName={exercise.name}
      />
    </View>
  )
}

function SectionLabel({ text }: { text: string }) {
  const { palette } = useTheme()
  return (
    <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
      {text}
    </Text>
  )
}

function RecordCell({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.recordCell,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.recordValue, { color: palette.textPrimary }]}>
        {value}
      </Text>
      <Text style={[styles.recordLabel, { color: palette.textTertiary }]}>
        {label}
      </Text>
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
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
  headerTitle: {
    ...typography.bodyStrong,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
  },
  hero: {
    height: 240,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  gifFallback: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  gifFallbackText: {
    ...typography.small,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  sectionLabel: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  logCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  stepText: {
    ...typography.body,
    flex: 1,
  },
  cueWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  cuePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  cueText: {
    ...typography.small,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginTop: spacing.xl,
  },
  expandText: {
    ...typography.bodyStrong,
    flex: 1,
  },
  recordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recordCell: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  recordValue: {
    ...typography.h3,
    fontSize: 18,
  },
  recordLabel: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyDate: {
    ...typography.smallStrong,
    width: 90,
  },
  historySets: {
    ...typography.small,
    flex: 1,
    textAlign: 'right',
  },
  empty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.small,
    textAlign: 'center',
  },
  coachCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  coachIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTextWrap: {
    flex: 1,
  },
  coachTitle: {
    ...typography.bodyStrong,
  },
  coachSub: {
    ...typography.small,
    marginTop: 2,
  },
  attribution: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addCta: {
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addCtaText: {
    ...typography.button,
  },
})
