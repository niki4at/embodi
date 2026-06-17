import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { CATEGORY_META } from '@/constants/challenge-meta'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export default function ChallengeDetailScreen() {
  const { palette, resolved, shadows } = useTheme()
  const params = useLocalSearchParams<{ id: string }>()
  const challengeId = params.id as Id<'challenges'>

  const detail = useQuery(api.challenges.getChallengeDetail, { challengeId })
  const logProgress = useMutation(api.challenges.logProgress)
  const archiveChallenge = useMutation(api.challenges.archiveChallenge)
  const deleteChallenge = useMutation(api.challenges.deleteChallenge)

  const [logVisible, setLogVisible] = useState(false)
  const [logValue, setLogValue] = useState('')
  const [logNote, setLogNote] = useState('')
  const [isLogging, setIsLogging] = useState(false)

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (router.canGoBack()) router.back()
    else router.replace('/challenges' as Href)
  }, [])

  const handleLog = useCallback(async () => {
    const value = parseFloat(logValue)
    if (!Number.isFinite(value) || isLogging) return
    setIsLogging(true)
    try {
      await logProgress({
        challengeId,
        value,
        note: logNote.trim() || undefined,
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setLogValue('')
      setLogNote('')
      setLogVisible(false)
    } catch (error) {
      console.error('Failed to log progress', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsLogging(false)
    }
  }, [logValue, logNote, isLogging, logProgress, challengeId])

  const handleArchive = useCallback(() => {
    Alert.alert(
      'Archive challenge',
      'It will be hidden from your list but kept in your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            await archiveChallenge({ challengeId })
            router.back()
          },
        },
      ],
    )
  }, [archiveChallenge, challengeId])

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete challenge',
      'This permanently removes the challenge and its progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteChallenge({ challengeId })
            router.back()
          },
        },
      ],
    )
  }, [deleteChallenge, challengeId])

  if (detail === undefined) {
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.centered, { backgroundColor: palette.bg }]}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }

  if (detail === null) {
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.textSecondary }]}>
          Challenge not found.
        </Text>
        <Pressable onPress={handleBack} style={styles.errorBack}>
          <Text style={[styles.errorBackText, { color: palette.primary }]}>
            Go back
          </Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const { challenge, entries, latestValue, completedSessions, percent } = detail
  const meta = CATEGORY_META[challenge.category]
  const accent = palette[meta.accent]
  const manualEntries = entries.filter((e) => e.source === 'manual')
  const isGenerating = challenge.status === 'generating'
  const isFailed = challenge.status === 'failed'
  const isCompleted = challenge.status === 'completed'
  const m = challenge.metric

  const targetLabel =
    m.targetValue != null
      ? `${m.direction === 'decrease' ? 'Down to' : m.direction === 'increase' ? 'Up to' : 'Hold at'} ${m.targetValue} ${m.unit}`
      : `${m.direction} ${m.unit}`

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconSymbol
            name="arrow.left"
            size={18}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
        <Pressable
          onPress={handleArchive}
          hitSlop={12}
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Archive challenge"
        >
          <IconSymbol
            name="trash"
            size={18}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(motion.duration.base)}>
          <View style={styles.titleRow}>
            <View style={[styles.titleIcon, { backgroundColor: accent + '22' }]}>
              <IconSymbol
                name={isCompleted ? 'trophy.fill' : meta.icon}
                size={26}
                color={isCompleted ? palette.success : accent}
              />
            </View>
            <View style={styles.titleText}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                {challenge.title}
              </Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                {meta.label} · {targetLabel}
              </Text>
            </View>
          </View>
        </Animated.View>

        {!isGenerating && !isFailed ? (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base).delay(40)}
            style={[
              styles.progressCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View style={styles.progressHeader}>
              <Text style={[styles.progressPct, { color: palette.textPrimary }]}>
                {percent}%
              </Text>
              <Text
                style={[styles.progressCaption, { color: palette.textSecondary }]}
              >
                {isCompleted ? 'Goal reached' : 'toward your goal'}
              </Text>
            </View>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: palette.surfaceHigh },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: isCompleted ? palette.success : accent,
                  },
                ]}
              />
            </View>
            <View style={styles.statsRow}>
              <Stat
                label="Latest"
                value={
                  latestValue != null ? `${latestValue} ${m.unit}` : '—'
                }
              />
              <Stat label="Sessions" value={`${completedSessions}`} />
              <Stat
                label="Logs"
                value={`${manualEntries.length}`}
              />
            </View>
          </Animated.View>
        ) : null}

        {isGenerating ? (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base).delay(40)}
            style={[
              styles.banner,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.bannerText, { color: palette.textSecondary }]}>
              Your coach is building a multi-week program. This usually takes a
              few seconds.
            </Text>
          </Animated.View>
        ) : null}

        {isFailed ? (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base).delay(40)}
            style={[
              styles.banner,
              {
                backgroundColor: palette.warningMuted,
                borderColor: palette.warning,
              },
            ]}
          >
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={18}
              color={palette.warning}
            />
            <Text style={[styles.bannerText, { color: palette.textPrimary }]}>
              We couldn&apos;t build the program{challenge.error ? `: ${challenge.error}` : ''}. Try
              deleting and creating it again.
            </Text>
          </Animated.View>
        ) : null}

        {challenge.description ? (
          <Text style={[styles.description, { color: palette.textSecondary }]}>
            {challenge.description}
          </Text>
        ) : null}

        {challenge.program ? (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base).delay(80)}
            style={styles.section}
          >
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
              PROGRAM
            </Text>
            <View
              style={[
                styles.overviewCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text
                style={[styles.overviewText, { color: palette.textPrimary }]}
              >
                {challenge.program.overview}
              </Text>
              <View style={styles.overviewMeta}>
                <IconSymbol
                  name="calendar"
                  size={14}
                  color={palette.textTertiary}
                />
                <Text
                  style={[
                    styles.overviewMetaText,
                    { color: palette.textSecondary },
                  ]}
                >
                  {challenge.program.weeks.length} weeks ·{' '}
                  {challenge.program.weeklySessions} sessions/week
                </Text>
              </View>
            </View>

            {challenge.program.weeks.map((week) => (
              <View
                key={week.weekNumber}
                style={[
                  styles.weekCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.weekBadge,
                    { backgroundColor: accent + '22' },
                  ]}
                >
                  <Text style={[styles.weekBadgeText, { color: accent }]}>
                    W{week.weekNumber}
                  </Text>
                </View>
                <View style={styles.weekBody}>
                  <Text
                    style={[styles.weekFocus, { color: palette.textPrimary }]}
                  >
                    {week.focus}
                  </Text>
                  <Text
                    style={[styles.weekSummary, { color: palette.textSecondary }]}
                  >
                    {week.summary}
                  </Text>
                  <Text style={[styles.weekTarget, { color: accent }]}>
                    {week.target}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {manualEntries.length > 0 ? (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base).delay(120)}
            style={styles.section}
          >
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
              PROGRESS
            </Text>
            <ProgressChart
              values={manualEntries.map((e) => e.value)}
              accent={accent}
            />
            {manualEntries
              .slice()
              .reverse()
              .map((entry) => (
                <View
                  key={entry._id}
                  style={[
                    styles.logRow,
                    { borderBottomColor: palette.divider },
                  ]}
                >
                  <Text
                    style={[styles.logValue, { color: palette.textPrimary }]}
                  >
                    {entry.value} {entry.unit}
                  </Text>
                  <Text
                    style={[styles.logNote, { color: palette.textSecondary }]}
                    numberOfLines={1}
                  >
                    {entry.note || new Date(entry.recordedAt).toDateString()}
                  </Text>
                </View>
              ))}
          </Animated.View>
        ) : null}

        <TouchableOpacity onPress={handleDelete} style={styles.deleteLink}>
          <Text style={[styles.deleteLinkText, { color: palette.danger }]}>
            Delete challenge
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {!isGenerating && !isFailed ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.bgElevated,
              borderTopColor: palette.divider,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              setLogVisible(true)
            }}
            style={({ pressed }) => [
              styles.logCta,
              { backgroundColor: palette.primary, opacity: pressed ? 0.92 : 1 },
              resolved === 'dark' ? shadows.primaryDark : shadows.primary,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Log progress"
          >
            <IconSymbol name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.logCtaText}>Log progress</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={logVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setLogVisible(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: palette.bgElevated },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
              Log progress
            </Text>
            <Text style={[styles.modalHint, { color: palette.textSecondary }]}>
              Where are you now, in {m.unit}?
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderStrong,
                  color: palette.textPrimary,
                },
              ]}
              value={logValue}
              onChangeText={setLogValue}
              placeholder={`e.g. 12 ${m.unit}`}
              placeholderTextColor={palette.textTertiary}
              keyboardType="numeric"
              autoFocus
            />
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderStrong,
                  color: palette.textPrimary,
                },
              ]}
              value={logNote}
              onChangeText={setLogNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={palette.textTertiary}
            />
            <Pressable
              onPress={handleLog}
              disabled={isLogging || !logValue.trim()}
              style={({ pressed }) => [
                styles.modalCta,
                {
                  backgroundColor: logValue.trim()
                    ? palette.primary
                    : palette.surfaceHigh,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              {isLogging ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.modalCtaText,
                    {
                      color: logValue.trim() ? '#FFFFFF' : palette.textTertiary,
                    },
                  ]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme()
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: palette.textPrimary }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: palette.textTertiary }]}>
        {label}
      </Text>
    </View>
  )
}

function ProgressChart({
  values,
  accent,
}: {
  values: number[]
  accent: string
}) {
  const { palette } = useTheme()
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  return (
    <View
      style={[
        styles.chart,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      {values.map((value, index) => {
        const heightPct = 12 + ((value - min) / range) * 76
        return (
          <View key={index} style={styles.chartBarWrap}>
            <View
              style={[
                styles.chartBar,
                { height: `${heightPct}%`, backgroundColor: accent },
              ]}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
  },
  errorBack: {
    padding: spacing.sm,
  },
  errorBackText: {
    ...typography.bodyStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    fontSize: 24,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  progressCard: {
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  progressPct: {
    ...typography.metric,
  },
  progressCaption: {
    ...typography.small,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
  },
  statLabel: {
    ...typography.small,
    marginTop: 2,
  },
  banner: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  bannerText: {
    ...typography.small,
    flex: 1,
  },
  description: {
    ...typography.body,
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
  },
  overviewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  overviewText: {
    ...typography.body,
  },
  overviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  overviewMetaText: {
    ...typography.smallStrong,
  },
  weekCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  weekBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBadgeText: {
    ...typography.smallStrong,
  },
  weekBody: {
    flex: 1,
    gap: 2,
  },
  weekFocus: {
    ...typography.bodyStrong,
  },
  weekSummary: {
    ...typography.small,
  },
  weekTarget: {
    ...typography.smallStrong,
    marginTop: spacing.xs,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  chartBarWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    borderRadius: radius.xs,
    minHeight: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logValue: {
    ...typography.bodyStrong,
  },
  logNote: {
    ...typography.small,
    flex: 1,
    textAlign: 'right',
  },
  deleteLink: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    padding: spacing.md,
  },
  deleteLinkText: {
    ...typography.bodyStrong,
  },
  bottomSpacing: {
    height: spacing.huge,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logCta: {
    height: 54,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logCtaText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalDismiss: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
  },
  modalHint: {
    ...typography.small,
  },
  modalInput: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
  },
  modalCta: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  modalCtaText: {
    ...typography.button,
  },
})
