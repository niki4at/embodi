import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
  computeCycleStatus,
  type CyclePhase,
  type CycleEntry,
  type Flow,
} from '@/convex/cycle'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const PHASE_COPY: Record<
  CyclePhase,
  { label: string; tagline: string; emoji: string }
> = {
  menstrual: {
    label: 'Menstrual',
    tagline: 'Lower-intensity strength, mobility, breathwork.',
    emoji: '🌑',
  },
  follicular: {
    label: 'Follicular',
    tagline: 'Building energy. Good window for harder work.',
    emoji: '🌱',
  },
  ovulatory: {
    label: 'Ovulatory',
    tagline: 'Peak strength window. PR-friendly days.',
    emoji: '⚡',
  },
  luteal: {
    label: 'Luteal',
    tagline: 'Steady early, then ease off in late luteal.',
    emoji: '🌙',
  },
  unknown: {
    label: 'Tracking',
    tagline: 'Log more cycles for a clearer phase read.',
    emoji: '⏳',
  },
}

const FLOW_OPTIONS: { value: Flow; label: string; dots: number }[] = [
  { value: 'light', label: 'Light', dots: 1 },
  { value: 'medium', label: 'Medium', dots: 2 },
  { value: 'heavy', label: 'Heavy', dots: 3 },
]

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Today' },
  { value: 1, label: 'Yesterday' },
  { value: 2, label: '2d ago' },
  { value: 3, label: '3d ago' },
  { value: 4, label: '4d ago' },
  { value: 5, label: '5d ago' },
  { value: 6, label: '6d ago' },
  { value: 7, label: '7d ago' },
]

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function daysAgoMs(daysAgo: number): number {
  return startOfLocalDay(Date.now() - daysAgo * ONE_DAY_MS)
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function periodLengthLabel(start: number, end?: number): string {
  if (!end) return 'Ongoing'
  const days = Math.max(1, Math.round((end - start) / ONE_DAY_MS) + 1)
  return `${days} day${days === 1 ? '' : 's'}`
}

export default function CycleScreen() {
  const { palette, resolved } = useTheme()
  const data = useQuery(api.cycle.getRecentEntries, { limit: 10 })
  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const logPeriodStart = useMutation(api.cycle.logPeriodStart)
  const markPeriodEnded = useMutation(api.cycle.markPeriodEnded)
  const deleteEntry = useMutation(api.cycle.deleteCycleEntry)

  const [pendingAction, setPendingAction] = useState<
    | { kind: 'idle' }
    | { kind: 'logging-start'; daysAgo: number; flow: Flow | null }
    | { kind: 'closing'; daysAgo: number }
  >({ kind: 'idle' })
  const [busy, setBusy] = useState(false)

  const entries: CycleEntry[] = useMemo(() => data?.entries ?? [], [data])
  const status = useMemo(
    () => computeCycleStatus(entries, Date.now()),
    [entries]
  )
  const openEntry = useMemo(
    () => entries.find((e) => e.endDate === undefined) ?? null,
    [entries]
  )

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const startLogging = useCallback(() => {
    Haptics.selectionAsync()
    setPendingAction({ kind: 'logging-start', daysAgo: 0, flow: null })
  }, [])

  const startClosing = useCallback(() => {
    Haptics.selectionAsync()
    setPendingAction({ kind: 'closing', daysAgo: 0 })
  }, [])

  const cancelPending = useCallback(() => {
    setPendingAction({ kind: 'idle' })
  }, [])

  const submitStart = useCallback(async () => {
    if (busy || pendingAction.kind !== 'logging-start') return
    setBusy(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      await logPeriodStart({
        startDate: daysAgoMs(pendingAction.daysAgo),
        flow: pendingAction.flow ?? undefined,
      })
      setPendingAction({ kind: 'idle' })
    } catch (err) {
      console.error('Failed to log period start', err)
      Alert.alert('Could not save', 'Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }, [busy, pendingAction, logPeriodStart])

  const submitEnd = useCallback(async () => {
    if (busy || pendingAction.kind !== 'closing' || !openEntry) return
    setBusy(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      await markPeriodEnded({
        entryId: openEntry._id as Id<'cycle_entries'>,
        endDate: daysAgoMs(pendingAction.daysAgo),
      })
      setPendingAction({ kind: 'idle' })
    } catch (err) {
      console.error('Failed to mark period ended', err)
      const message = err instanceof Error ? err.message : 'Try again in a moment.'
      Alert.alert('Could not save', message)
    } finally {
      setBusy(false)
    }
  }, [busy, pendingAction, openEntry, markPeriodEnded])

  const confirmDeleteEntry = useCallback(
    (entryId: string, startDate: number) => {
      Haptics.selectionAsync()
      Alert.alert(
        'Delete this entry?',
        `Remove the cycle starting ${formatDate(startDate)}. This can't be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteEntry({ entryId: entryId as Id<'cycle_entries'> })
              } catch (err) {
                console.error('Failed to delete cycle entry', err)
                Alert.alert('Could not delete', 'Try again in a moment.')
              }
            },
          },
        ]
      )
    },
    [deleteEntry]
  )

  const isLoading = data === undefined || onboardingData === undefined
  const optedIn = onboardingData?.trackPeriod === true
  const iconTint = resolved === 'dark' ? palette.white : palette.textPrimary

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close cycle screen"
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <IconSymbol
            name={Platform.OS === 'ios' ? 'chevron.down' : 'chevron.left'}
            size={20}
            color={iconTint}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Cycle
        </Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : !optedIn ? (
          <NotOptedInState palette={palette} />
        ) : (
          <>
            <PhaseCard
              palette={palette}
              phase={status.phase}
              dayOfCycle={status.dayOfCycle}
              averageCycleLength={status.averageCycleLength}
              hasAverage={status.hasAverage}
              hasData={status.hasData}
              predictedNextStart={status.predictedNextStart}
            />

            {pendingAction.kind === 'idle' ? (
              <View style={styles.ctaRow}>
                {openEntry ? (
                  <ActionButton
                    palette={palette}
                    icon="checkmark"
                    label="Mark period ended"
                    onPress={startClosing}
                  />
                ) : (
                  <ActionButton
                    palette={palette}
                    icon="drop.fill"
                    label="Period started"
                    onPress={startLogging}
                    primary
                  />
                )}
              </View>
            ) : pendingAction.kind === 'logging-start' ? (
              <LogStartForm
                palette={palette}
                daysAgo={pendingAction.daysAgo}
                flow={pendingAction.flow}
                busy={busy}
                onChangeDaysAgo={(value) =>
                  setPendingAction({ ...pendingAction, daysAgo: value })
                }
                onChangeFlow={(value) =>
                  setPendingAction({ ...pendingAction, flow: value })
                }
                onCancel={cancelPending}
                onSubmit={submitStart}
              />
            ) : (
              <CloseForm
                palette={palette}
                daysAgo={pendingAction.daysAgo}
                openEntryStart={openEntry?.startDate ?? null}
                busy={busy}
                onChangeDaysAgo={(value) =>
                  setPendingAction({ ...pendingAction, daysAgo: value })
                }
                onCancel={cancelPending}
                onSubmit={submitEnd}
              />
            )}

            <Text
              style={[
                styles.sectionLabel,
                { color: palette.textTertiary, marginTop: spacing.xxl },
              ]}
            >
              Recent cycles
            </Text>

            {entries.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: palette.textPrimary },
                  ]}
                >
                  Nothing logged yet
                </Text>
                <Text
                  style={[
                    styles.emptyBody,
                    { color: palette.textSecondary },
                  ]}
                >
                  Tap &quot;Period started&quot; on day one and we&apos;ll start
                  learning your cycle. After 2-3 cycles, your sessions will
                  adapt to phase.
                </Text>
              </View>
            ) : (
              <View style={styles.entriesList}>
                {entries.map((entry) => (
                  <EntryRow
                    key={entry._id}
                    palette={palette}
                    entry={entry}
                    onDelete={() =>
                      confirmDeleteEntry(entry._id, entry.startDate)
                    }
                  />
                ))}
              </View>
            )}

            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <IconSymbol
                name="info.circle"
                size={16}
                color={palette.textSecondary}
              />
              <Text
                style={[styles.infoText, { color: palette.textSecondary }]}
              >
                Phase guidance is general — your check-in still drives intensity.
                Not medical advice.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------- Sub-components ----------

interface PhaseCardProps {
  palette: ReturnType<typeof useTheme>['palette']
  phase: CyclePhase
  dayOfCycle: number | null
  averageCycleLength: number
  hasAverage: boolean
  hasData: boolean
  predictedNextStart: number | null
}

function PhaseCard({
  palette,
  phase,
  dayOfCycle,
  averageCycleLength,
  hasAverage,
  hasData,
  predictedNextStart,
}: PhaseCardProps) {
  const copy = PHASE_COPY[phase]
  const showDay = hasData && dayOfCycle !== null && phase !== 'unknown'
  const daysUntilNext =
    predictedNextStart !== null
      ? Math.max(
          0,
          Math.round((predictedNextStart - Date.now()) / ONE_DAY_MS)
        )
      : null

  return (
    <View
      style={[
        styles.phaseCard,
        {
          backgroundColor: palette.primary,
        },
      ]}
    >
      <Text style={[styles.phaseLabel, { color: 'rgba(255,255,255,0.85)' }]}>
        {showDay ? `DAY ${dayOfCycle} OF ~${averageCycleLength}` : 'CURRENT PHASE'}
      </Text>
      <View style={styles.phaseHeaderRow}>
        <Text style={styles.phaseEmoji}>{copy.emoji}</Text>
        <Text style={[styles.phaseTitle, { color: '#FFFFFF' }]}>
          {copy.label}
        </Text>
      </View>
      <Text
        style={[styles.phaseTagline, { color: 'rgba(255,255,255,0.92)' }]}
      >
        {copy.tagline}
      </Text>

      {hasData && daysUntilNext !== null && phase !== 'unknown' ? (
        <View style={styles.phaseFooter}>
          <Text
            style={[styles.phaseFooterText, { color: 'rgba(255,255,255,0.85)' }]}
          >
            {daysUntilNext === 0
              ? 'Next period expected today'
              : `Next period in ~${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}`}
            {hasAverage ? '' : ' (default 28d)'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

interface ActionButtonProps {
  palette: ReturnType<typeof useTheme>['palette']
  icon: React.ComponentProps<typeof IconSymbol>['name']
  label: string
  onPress: () => void
  primary?: boolean
}

function ActionButton({
  palette,
  icon,
  label,
  onPress,
  primary,
}: ActionButtonProps) {
  const bg = primary ? palette.primary : palette.surface
  const fg = primary ? '#FFFFFF' : palette.textPrimary
  const border = primary ? palette.primary : palette.border

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <IconSymbol name={icon} size={18} color={fg} />
      <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  )
}

interface LogStartFormProps {
  palette: ReturnType<typeof useTheme>['palette']
  daysAgo: number
  flow: Flow | null
  busy: boolean
  onChangeDaysAgo: (value: number) => void
  onChangeFlow: (value: Flow) => void
  onCancel: () => void
  onSubmit: () => void
}

function LogStartForm({
  palette,
  daysAgo,
  flow,
  busy,
  onChangeDaysAgo,
  onChangeFlow,
  onCancel,
  onSubmit,
}: LogStartFormProps) {
  return (
    <View
      style={[
        styles.formCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.formTitle, { color: palette.textPrimary }]}>
        When did it start?
      </Text>
      <View style={styles.chipRow}>
        {DAY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={daysAgo === option.value}
            palette={palette}
            onPress={() => onChangeDaysAgo(option.value)}
          />
        ))}
      </View>

      <Text
        style={[
          styles.formTitle,
          { color: palette.textPrimary, marginTop: spacing.xl },
        ]}
      >
        Flow (optional)
      </Text>
      <View style={styles.chipRow}>
        {FLOW_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={'• '.repeat(option.dots).trim() + ' ' + option.label}
            active={flow === option.value}
            palette={palette}
            onPress={() => onChangeFlow(option.value)}
          />
        ))}
      </View>

      <View style={styles.formActions}>
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.secondaryActionLabel, { color: palette.textPrimary }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onSubmit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Save period start"
          style={({ pressed }) => [
            styles.primaryAction,
            {
              backgroundColor: palette.primary,
              opacity: busy ? 0.7 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryActionLabel, { color: '#FFFFFF' }]}>
              Save
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

interface CloseFormProps {
  palette: ReturnType<typeof useTheme>['palette']
  daysAgo: number
  openEntryStart: number | null
  busy: boolean
  onChangeDaysAgo: (value: number) => void
  onCancel: () => void
  onSubmit: () => void
}

function CloseForm({
  palette,
  daysAgo,
  openEntryStart,
  busy,
  onChangeDaysAgo,
  onCancel,
  onSubmit,
}: CloseFormProps) {
  // Only allow end dates that are on or after the start date.
  const maxDaysAgo = openEntryStart
    ? Math.floor((Date.now() - openEntryStart) / ONE_DAY_MS)
    : 7
  const visibleOptions = DAY_OPTIONS.filter((o) => o.value <= maxDaysAgo)

  return (
    <View
      style={[
        styles.formCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.formTitle, { color: palette.textPrimary }]}>
        When did it end?
      </Text>
      <View style={styles.chipRow}>
        {visibleOptions.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={daysAgo === option.value}
            palette={palette}
            onPress={() => onChangeDaysAgo(option.value)}
          />
        ))}
      </View>

      <View style={styles.formActions}>
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.secondaryActionLabel, { color: palette.textPrimary }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onSubmit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Save period end"
          style={({ pressed }) => [
            styles.primaryAction,
            {
              backgroundColor: palette.primary,
              opacity: busy ? 0.7 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryActionLabel, { color: '#FFFFFF' }]}>
              Save
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

interface ChipProps {
  label: string
  active: boolean
  palette: ReturnType<typeof useTheme>['palette']
  onPress: () => void
}

function Chip({ label, active, palette, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? palette.primary : palette.surfaceAlt,
          borderColor: active ? palette.primary : palette.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? '#FFFFFF' : palette.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

interface EntryRowProps {
  palette: ReturnType<typeof useTheme>['palette']
  entry: CycleEntry
  onDelete: () => void
}

function EntryRow({ palette, entry, onDelete }: EntryRowProps) {
  const length = periodLengthLabel(entry.startDate, entry.endDate)
  return (
    <View
      style={[
        styles.entryRow,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View
        style={[
          styles.entryDot,
          {
            backgroundColor:
              entry.endDate === undefined ? palette.primary : palette.surfaceAlt,
          },
        ]}
      >
        <IconSymbol
          name="drop.fill"
          size={16}
          color={entry.endDate === undefined ? '#FFFFFF' : palette.textSecondary}
        />
      </View>
      <View style={styles.entryText}>
        <Text style={[styles.entryTitle, { color: palette.textPrimary }]}>
          {formatDate(entry.startDate)}
        </Text>
        <Text style={[styles.entryMeta, { color: palette.textSecondary }]}>
          {length}
          {entry.flow ? ` · ${entry.flow}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete entry from ${formatDate(entry.startDate)}`}
        hitSlop={8}
      >
        <IconSymbol name="trash" size={18} color={palette.textTertiary} />
      </TouchableOpacity>
    </View>
  )
}

function NotOptedInState({
  palette,
}: {
  palette: ReturnType<typeof useTheme>['palette']
}) {
  return (
    <View
      style={[
        styles.emptyCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        Cycle tracking is off
      </Text>
      <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
        Turn it on in Settings → Cycle tracking to log cycles and get
        phase-aware sessions. Your data stays on your account and never leaves
        without your consent.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    ...typography.h2,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  loading: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  phaseCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  phaseLabel: {
    ...typography.caption,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  phaseEmoji: {
    fontSize: 28,
  },
  phaseTitle: {
    ...typography.h1,
  },
  phaseTagline: {
    ...typography.body,
  },
  phaseFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  phaseFooterText: {
    ...typography.small,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionLabel: {
    ...typography.button,
  },
  formCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  formTitle: {
    ...typography.bodyStrong,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    ...typography.smallStrong,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  secondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionLabel: {
    ...typography.button,
  },
  primaryAction: {
    flex: 1.4,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionLabel: {
    ...typography.button,
  },
  sectionLabel: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyStrong,
  },
  emptyBody: {
    ...typography.small,
  },
  entriesList: {
    gap: spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  entryDot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: {
    flex: 1,
  },
  entryTitle: {
    ...typography.bodyStrong,
  },
  entryMeta: {
    ...typography.small,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
  },
  infoText: {
    flex: 1,
    ...typography.small,
  },
})
