import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'

import { BodfitWordmark } from '@/components/ui/bodfit-logo'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PillButton } from '@/components/ui/pill-button'
import { CoachAvatar, Eyebrow } from '@/components/ui/primitives'
import { CATEGORY_META } from '@/constants/challenge-meta'
import { motion, radius, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

type Week = {
  weekNumber: number
  focus: string
  summary: string
  target: string
}

export default function ChallengeDetailScreen() {
  const { palette } = useTheme()
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
    Haptics.selectionAsync().catch(() => {})
    if (router.canGoBack()) router.back()
    else router.replace('/challenges' as Href)
  }, [])

  const handleLog = useCallback(async () => {
    const value = parseFloat(logValue)
    if (!Number.isFinite(value) || isLogging) return
    setIsLogging(true)
    try {
      await logProgress({ challengeId, value, note: logNote.trim() || undefined })
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
    Alert.alert('Archive goal', 'It will be hidden from your list but kept in your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          await archiveChallenge({ challengeId })
          router.back()
        },
      },
    ])
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

  const currentWeekIndex = useMemo(() => {
    const weeks = detail?.challenge.program?.weeks ?? []
    if (weeks.length === 0 || !detail) return 0
    const elapsed = Math.floor((Date.now() - detail.challenge.createdAt) / MS_PER_WEEK)
    return Math.min(weeks.length - 1, Math.max(0, elapsed))
  }, [detail])

  if (detail === undefined) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }
  if (detail === null) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorText, { color: palette.textSecondary }]}>Challenge not found.</Text>
        <PillButton label="Go back" variant="secondary" fullWidth={false} onPress={handleBack} />
      </SafeAreaView>
    )
  }

  const { challenge, entries, latestValue, completedSessions, percent } = detail
  const meta = CATEGORY_META[challenge.category]
  const accent =
    challenge.category === 'endurance' || challenge.category === 'weight_loss'
      ? palette.primary
      : palette.accent
  const manualEntries = entries.filter((e) => e.source === 'manual')
  const isGenerating = challenge.status === 'generating'
  const isFailed = challenge.status === 'failed'
  const isCompleted = challenge.status === 'completed'
  const m = challenge.metric
  const weeks: Week[] = challenge.program?.weeks ?? []
  const currentWeek = weeks[currentWeekIndex]
  const nextWeek = weeks[Math.min(weeks.length - 1, currentWeekIndex + 1)]

  const current = latestValue ?? m.startValue ?? null
  const progressLine = (() => {
    const parts: string[] = []
    if (current !== null && m.targetValue !== undefined) {
      parts.push(`${current.toLocaleString()} ${m.unit} out of ${m.targetValue.toLocaleString()} ${m.unit} done`)
    } else if (completedSessions > 0) {
      parts.push(`${completedSessions} sessions logged`)
    }
    return parts.join(' \u00b7 ')
  })()
  const targetDateLabel = challenge.targetDate
    ? new Date(challenge.targetDate).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
      })
    : null

  const handleStartNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    const seed = {
      title: currentWeek?.target ?? challenge.title,
      modality: meta.label,
      durationMin: 40,
      moveCount: 6,
      description: currentWeek?.summary ?? challenge.description,
      reasoning: `Week ${currentWeek?.weekNumber ?? 1} of your ${challenge.title} program.`,
      tags: [challenge.category],
      source: 'aligned' as const,
    }
    router.push({
      pathname: '/checkin',
      params: { rec: JSON.stringify(seed) },
    } as unknown as Href)
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to challenges">
          <Text style={[styles.back, { color: palette.textSecondary }]}>{'\u2190'} Back to Challenges</Text>
        </Pressable>
        <BodfitWordmark variant="header" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(motion.duration.base)}>
          <View style={styles.headRow}>
            <View style={styles.headCopy}>
              <Eyebrow color={accent}>
                {`${meta.label} \u00b7 ${weeks.length > 0 ? `Week ${currentWeekIndex + 1} of ${weeks.length}` : isGenerating ? 'Planning' : 'Active'}`}
              </Eyebrow>
              <Text style={[styles.title, { color: palette.textPrimary }]} accessibilityRole="header">
                {challenge.title}
              </Text>
            </View>
            {!isGenerating ? (
              <Text style={[styles.percent, { color: isCompleted ? palette.success : accent }]}>
                {percent}%
              </Text>
            ) : null}
          </View>
          {!isGenerating ? (
            <View
              style={[styles.track, { backgroundColor: palette.surfaceHigh }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
            >
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(2, Math.min(100, percent))}%`, backgroundColor: isCompleted ? palette.success : accent },
                ]}
              />
            </View>
          ) : null}
          <Text style={[styles.progressLine, { color: palette.textSecondary }]}>
            {progressLine}
            {targetDateLabel ? (
              <Text style={{ fontFamily: fonts.uiSemiBold }}>
                {progressLine ? ' \u00b7 ' : ''}
                {meta.id === 'endurance' ? 'Race' : 'Target'} on {targetDateLabel}
              </Text>
            ) : null}
          </Text>
        </Animated.View>

        {isGenerating ? (
          <View style={[styles.nextCard, { backgroundColor: palette.surface }]}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.nextSummary, { color: palette.textSecondary }]}>
              Your coach is building a multi-week program. This usually takes a few seconds.
            </Text>
          </View>
        ) : isFailed ? (
          <View style={[styles.nextCard, { backgroundColor: palette.warningMuted }]}>
            <Text style={[styles.nextSummary, { color: palette.textPrimary }]}>
              We couldn&apos;t build the program{challenge.error ? `: ${challenge.error}` : ''}. Delete it and
              create it again.
            </Text>
          </View>
        ) : currentWeek ? (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base).delay(40)}
            style={[styles.nextCard, { backgroundColor: palette.surface }]}
          >
            <Eyebrow color={palette.primary}>{`Next up \u00b7 week ${currentWeek.weekNumber}`}</Eyebrow>
            <Text style={[styles.nextTitle, { color: palette.textPrimary }]}>{currentWeek.target}</Text>
            <Text style={[styles.nextSummary, { color: palette.textSecondary }]} numberOfLines={2}>
              {currentWeek.summary}
            </Text>
            <View style={styles.nextActions}>
              <Pressable
                onPress={handleStartNext}
                accessibilityRole="button"
                accessibilityLabel="Start this week's session"
                style={({ pressed }) => [styles.smallCta, { backgroundColor: palette.primary }, pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.smallCtaText, { color: palette.white }]}>Start</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/checkin' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Adjust with a check-in"
                style={({ pressed }) => [styles.smallCta, styles.smallCtaOutline, { borderColor: palette.primary }, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.smallCtaText, { color: palette.primary }]}>Adjust</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {weeks.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(motion.duration.base).delay(80)} style={styles.section}>
            <Eyebrow>Program</Eyebrow>
            <ProgramPath
              weeks={weeks}
              currentIndex={currentWeekIndex}
              accent={accent}
              finalLabel={
                meta.id === 'endurance' ? `${challenge.title.split(' ')[0]} day!` : 'Goal day!'
              }
              finalDate={targetDateLabel}
            />
          </Animated.View>
        ) : null}

        {!isGenerating && !isFailed ? (
          <Animated.View entering={FadeInDown.duration(motion.duration.base).delay(120)} style={styles.section}>
            <Eyebrow>Progress log</Eyebrow>
            <View style={[styles.logCard, { borderColor: palette.border }]}>
              <View style={styles.logHead}>
                <View style={styles.logCopy}>
                  <Text style={[styles.logValue, { color: palette.textPrimary }]}>
                    {current !== null ? `${current.toLocaleString()} ${m.unit}` : `${completedSessions} sessions`}
                  </Text>
                  <Text style={[styles.logHint, { color: palette.textSecondary }]}>
                    {m.targetValue !== undefined
                      ? `of ${m.targetValue.toLocaleString()} ${m.unit} target \u00b7 ${manualEntries.length} logs`
                      : `${manualEntries.length} logs so far`}
                  </Text>
                </View>
                <MiniBars values={manualEntries.map((e) => e.value)} accent={accent} />
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  setLogVisible(true)
                }}
                accessibilityRole="button"
                accessibilityLabel="Log progress"
                style={({ pressed }) => [styles.logCta, { borderColor: palette.primary }, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.smallCtaText, { color: palette.primary }]}>Log Progress</Text>
              </Pressable>
              {manualEntries
                .slice()
                .reverse()
                .slice(0, 4)
                .map((entry) => (
                  <View key={entry._id} style={[styles.logRow, { borderTopColor: palette.divider }]}>
                    <Text style={[styles.logRowValue, { color: palette.textPrimary }]}>
                      {entry.value} {entry.unit}
                    </Text>
                    <Text style={[styles.logRowNote, { color: palette.textSecondary }]} numberOfLines={1}>
                      {entry.note || new Date(entry.recordedAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.footerActions}>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Edit target',
                'Targets are locked once the coach has built the program. Create a new version with the updated target and archive this one?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'New version',
                    onPress: () =>
                      router.push({
                        pathname: '/challenge/new',
                        params: { category: challenge.category, title: challenge.title },
                      } as unknown as Href),
                  },
                ],
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Edit target"
            style={({ pressed }) => [styles.footerButton, { borderColor: palette.borderStrong }, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.footerButtonText, { color: palette.textPrimary }]}>Edit Target</Text>
          </Pressable>
          <Pressable
            onPress={handleArchive}
            accessibilityRole="button"
            accessibilityLabel="Archive goal"
            style={({ pressed }) => [styles.footerButton, { borderColor: palette.borderStrong }, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.footerButtonText, { color: palette.textSecondary }]}>Archive goal</Text>
          </Pressable>
        </View>
        <Pressable onPress={handleDelete} style={styles.deleteLink} accessibilityRole="button" accessibilityLabel="Delete challenge">
          <Text style={[styles.deleteText, { color: palette.danger }]}>Delete challenge</Text>
        </Pressable>
      </ScrollView>

      <BottomSheet
        visible={logVisible}
        onClose={() => setLogVisible(false)}
        title="Log progress"
        subtitle={`Where are you now, in ${m.unit}?`}
        footer={
          <PillButton
            label="Save"
            onPress={handleLog}
            disabled={isLogging || !logValue.trim()}
            loading={isLogging}
          />
        }
      >
        <TextInput
          style={[styles.input, { backgroundColor: palette.surface, color: palette.textPrimary }]}
          value={logValue}
          onChangeText={setLogValue}
          placeholder={`e.g. 12 ${m.unit}`}
          placeholderTextColor={palette.textTertiary}
          keyboardType="numeric"
          autoFocus
          accessibilityLabel={`Progress in ${m.unit}`}
        />
        <TextInput
          style={[styles.input, { backgroundColor: palette.surface, color: palette.textPrimary }]}
          value={logNote}
          onChangeText={setLogNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={palette.textTertiary}
          accessibilityLabel="Note"
        />
      </BottomSheet>
    </SafeAreaView>
  )
}

/**
 * Winding program path: one node per week snaking left-right down the card,
 * ticks for finished weeks, a play glyph for the current one, hollow rings
 * ahead, and a final "goal day" node. The coach cheers from the side.
 */
function ProgramPath({
  weeks,
  currentIndex,
  accent,
  finalLabel,
  finalDate,
}: {
  weeks: Week[]
  currentIndex: number
  accent: string
  finalLabel: string
  finalDate: string | null
}) {
  const { palette } = useTheme()
  const [width, setWidth] = useState(0)
  const nodes = [...weeks.map((w) => ({ kind: 'week' as const, week: w })), { kind: 'final' as const }]
  const rowHeight = 64
  const height = nodes.length * rowHeight + 24
  const xs = [0.12, 0.42, 0.2, 0.55, 0.85, 0.35]
  const points = nodes.map((_, i) => ({
    x: width * xs[i % xs.length],
    y: 24 + i * rowHeight,
  }))
  const path = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1]
      const cx = (prev.x + p.x) / 2
      return `C ${cx} ${prev.y + rowHeight * 0.55}, ${cx} ${p.y - rowHeight * 0.55}, ${p.x} ${p.y}`
    })
    .join(' ')

  return (
    <View
      style={[styles.path, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Program path: week ${currentIndex + 1} of ${weeks.length} is current.`}
    >
      {width > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Path d={path} stroke={palette.textSecondary} strokeWidth={1.2} fill="none" />
          {points.map((p, i) => {
            const isFinal = i === nodes.length - 1
            const done = !isFinal && i < currentIndex
            const active = !isFinal && i === currentIndex
            return (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={14}
                fill={done || active ? accent : palette.bg}
                stroke={isFinal ? palette.accent : accent}
                strokeWidth={done || active ? 0 : 1.2}
              />
            )
          })}
        </Svg>
      ) : null}
      {width > 0
        ? nodes.map((node, i) => {
            const p = points[i]
            const isFinal = node.kind === 'final'
            const done = !isFinal && i < currentIndex
            const active = !isFinal && i === currentIndex
            const glyph = isFinal ? '' : done ? '\u2713' : active ? '\u25B6' : ''
            const labelLeft = p.x + 22
            return (
              <View key={i} style={[styles.node, { left: p.x - 14, top: p.y - 14 }]} pointerEvents="none">
                <Text style={[styles.nodeGlyph, { color: palette.white }]}>{glyph}</Text>
                <View style={[styles.nodeLabel, { left: 28, width: Math.max(80, width - labelLeft - 8) }]}>
                  <Text
                    style={[
                      styles.nodeTitle,
                      { color: isFinal ? palette.accent : palette.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {isFinal ? finalLabel : node.week.focus}
                  </Text>
                  <Text style={[styles.nodeMeta, { color: palette.textSecondary }]} numberOfLines={1}>
                    {isFinal
                      ? finalDate ?? ''
                      : `${node.week.target}${active ? ' \u00b7 THIS WEEK' : ''}`}
                  </Text>
                </View>
              </View>
            )
          })
        : null}
      <View style={styles.cheer} pointerEvents="none">
        <View style={[styles.cheerBubble, { borderColor: palette.accent }]}>
          <Text style={[styles.cheerText, { color: palette.accent }]}>keep going, you&apos;ve got this!</Text>
        </View>
        <CoachAvatar size={34} />
      </View>
    </View>
  )
}

function MiniBars({ values, accent }: { values: number[]; accent: string }) {
  const { palette } = useTheme()
  const recent = values.slice(-8)
  if (recent.length === 0) {
    return <Text style={[styles.logHint, { color: palette.textTertiary }]}>No logs yet</Text>
  }
  const max = Math.max(...recent, 1)
  return (
    <View style={styles.bars} accessibilityLabel={`${recent.length} recent logs`}>
      {recent.map((v, i) => (
        <View
          key={i}
          style={[styles.bar, { height: 6 + (v / max) * 18, backgroundColor: accent }]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  errorText: { ...typography.body },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  back: { ...typography.smallStrong },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headCopy: { flex: 1, gap: 4 },
  title: { ...typography.h1, fontSize: 22 },
  percent: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 26,
    lineHeight: 32,
  },
  track: {
    height: 3,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: 2 },
  progressLine: {
    ...typography.small,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  nextCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  nextTitle: { ...typography.bodyStrong, fontSize: 17 },
  nextSummary: { ...typography.small },
  nextActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  smallCta: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCtaOutline: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  smallCtaText: { ...typography.smallStrong },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  path: {
    position: 'relative',
  },
  node: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeGlyph: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  nodeLabel: {
    position: 'absolute',
    top: -2,
    gap: 1,
  },
  nodeTitle: { ...typography.smallStrong, fontSize: 12 },
  nodeMeta: { ...typography.mono, fontSize: 9 },
  cheer: {
    position: 'absolute',
    right: 0,
    top: 40,
    alignItems: 'flex-end',
    gap: 4,
  },
  cheerBubble: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
  },
  cheerText: {
    fontFamily: fonts.uiRegular,
    fontSize: 10,
    lineHeight: 13,
  },
  logCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  logHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  logCopy: { flex: 1, gap: 2 },
  logValue: { ...typography.h3, fontSize: 18 },
  logHint: { ...typography.small, fontSize: 12 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 4,
    borderRadius: 1,
  },
  logCta: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logRowValue: { ...typography.smallStrong },
  logRowNote: { ...typography.small, flex: 1, textAlign: 'right' },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.xxxl,
  },
  footerButton: {
    minWidth: 120,
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  footerButtonText: { ...typography.smallStrong, fontSize: 12 },
  deleteLink: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    padding: spacing.sm,
  },
  deleteText: { ...typography.small },
  input: {
    ...typography.body,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
})
