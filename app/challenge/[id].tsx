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
import { CoachAvatar } from '@/components/ui/primitives'
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
  const { palette, resolved } = useTheme()
  const params = useLocalSearchParams<{ id: string }>()
  const challengeId = params.id as Id<'challenges'>

  const detail = useQuery(api.challenges.getChallengeDetail, { challengeId })
  const logProgress = useMutation(api.challenges.logProgress)
  const archiveChallenge = useMutation(api.challenges.archiveChallenge)
  const unarchiveChallenge = useMutation(api.challenges.unarchiveChallenge)
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
  const isArchived = challenge.status === 'archived'
  const m = challenge.metric
  const weeks: Week[] = challenge.program?.weeks ?? []
  const currentWeek = weeks[currentWeekIndex]
  const nextCardBg = resolved === 'dark' ? palette.surface : 'rgba(217, 217, 217, 0.6)'

  const current = latestValue ?? m.startValue ?? (m.targetValue !== undefined ? 0 : null)
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
          <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
            {`${meta.label.toUpperCase()} \u00b7 ${
              isArchived
                ? 'Archived'
                : weeks.length > 0
                  ? `Week ${currentWeekIndex + 1} of ${weeks.length}`
                  : isGenerating
                    ? 'Planning'
                    : 'Active'
            }`}
          </Text>
          <View style={styles.headRow}>
            <Text
              style={[styles.title, { color: palette.textPrimary }]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {challenge.title}
            </Text>
            {!isGenerating ? (
              <Text style={[styles.percent, { color: isCompleted ? palette.success : accent }]}>
                {percent}%
              </Text>
            ) : null}
          </View>
          {!isGenerating ? (
            <View
              style={[styles.track, { backgroundColor: palette.track }]}
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
          <View style={[styles.nextCard, { backgroundColor: nextCardBg }]}>
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
            style={[styles.nextCard, { backgroundColor: nextCardBg }]}
          >
            <Text style={[styles.eyebrow, { color: palette.primary }]}>
              {`NEXT UP \u00b7 WEEK ${currentWeek.weekNumber}`}
            </Text>
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
          <Animated.View entering={FadeInDown.duration(motion.duration.base).delay(80)} style={styles.programSection}>
            <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>PROGRAM</Text>
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
          <Animated.View entering={FadeInDown.duration(motion.duration.base).delay(120)} style={styles.logSection}>
            <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>PROGRESS LOG</Text>
            <View style={[styles.logCard, { borderColor: palette.track }]}>
              <View style={styles.logHead}>
                <View style={styles.logCopy}>
                  <Text style={[styles.logValue, { color: palette.textPrimary }]}>
                    {current !== null ? `${current.toLocaleString()} ${m.unit}` : `${completedSessions} sessions`}
                  </Text>
                  <Text style={[styles.logHint, { color: palette.textSecondary }]}>
                    {m.targetValue !== undefined
                      ? `of ${m.targetValue.toLocaleString()} ${m.unit} target \u00b7 ${manualEntries.length} ${manualEntries.length === 1 ? 'log' : 'logs'}`
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
                <Text style={[styles.logCtaText, { color: palette.primary }]}>Log Progress</Text>
              </Pressable>
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
            onPress={
              isArchived
                ? () => {
                    Haptics.selectionAsync().catch(() => {})
                    void unarchiveChallenge({ challengeId })
                  }
                : handleArchive
            }
            accessibilityRole="button"
            accessibilityLabel={isArchived ? 'Restore goal' : 'Archive goal'}
            style={({ pressed }) => [styles.footerButton, { borderColor: palette.borderStrong }, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.footerButtonText, { color: isArchived ? palette.primary : palette.textSecondary }]}>
              {isArchived ? 'Restore goal' : 'Archive goal'}
            </Text>
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
 * Winding program path from frame 40:362: 27pt week nodes on a 44pt pitch
 * snaking left and right, ticks for finished weeks, a play glyph for the
 * current one, hollow rings ahead, and the goal-day node labelled on its left.
 * The coach cheers from the right.
 */
const NODE = 27
const NODE_PITCH = 44
const NODE_XS = [0.055, 0.375, 0.123, 0.49, 0.806]
const FINAL_X = 0.395
const CHEER_TOP = 22
const CHEER_WIDTH = 77
const CHEER_BOTTOM = CHEER_TOP + 38 - 2 + 36
const CHEER_RESERVE = 3 + 71 + 36 + 4

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
  const half = NODE / 2
  const height = (nodes.length - 1) * NODE_PITCH + NODE + 2
  const points = nodes.map((node, i) => ({
    x: width * (node.kind === 'final' ? FINAL_X : NODE_XS[i % NODE_XS.length]),
    y: half + i * NODE_PITCH,
  }))
  const path = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1]
      const cx = (prev.x + p.x) / 2
      return `C ${cx} ${prev.y + NODE_PITCH * 0.55}, ${cx} ${p.y - NODE_PITCH * 0.55}, ${p.x} ${p.y}`
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
          <Path d={path} stroke={palette.textSecondary} strokeWidth={1} fill="none" />
          {points.map((p, i) => {
            const isFinal = i === nodes.length - 1
            const done = !isFinal && i < currentIndex
            const active = !isFinal && i === currentIndex
            return (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={done || active ? half : half - 0.5}
                fill={done || active ? accent : palette.bg}
                stroke={isFinal ? palette.accent : palette.textSecondary}
                strokeWidth={done || active ? 0 : 1}
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
            const nodeLeft = p.x - half
            const labelLeft = nodeLeft + NODE + 4
            const besideCheer = p.y - half < CHEER_BOTTOM
            const labelRoom = width - labelLeft - (besideCheer ? CHEER_RESERVE : 0)
            const finalOnLeft = isFinal && nodeLeft >= 90
            return (
              <View key={i} style={[styles.node, { left: nodeLeft, top: p.y - half }]} pointerEvents="none">
                <Text style={[active ? styles.nodePlay : styles.nodeTick, { color: palette.white }]}>{glyph}</Text>
                <View
                  style={[
                    styles.nodeLabel,
                    finalOnLeft
                      ? { right: NODE + 6, width: nodeLeft - 6, alignItems: 'flex-end' }
                      : { left: NODE + 4, width: Math.max(60, labelRoom) },
                  ]}
                >
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
          <Text style={[styles.cheerText, { color: palette.accent }]}>keep going you&apos;ve got this!</Text>
        </View>
        <View style={styles.cheerAvatar}>
          <CoachAvatar size={36} />
        </View>
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
          style={[styles.bar, { height: 6 + (v / max) * 15, backgroundColor: accent }]}
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
    height: 17,
    marginTop: 12,
    paddingLeft: 26,
    paddingRight: 44,
  },
  back: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    lineHeight: 15,
  },
  scrollContent: {
    paddingTop: 19,
    paddingLeft: 16,
    paddingRight: 46,
    paddingBottom: spacing.huge,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 2,
  },
  title: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 16,
    lineHeight: 20,
  },
  percent: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 20,
    lineHeight: 25,
    marginRight: 3,
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: 1.5 },
  progressLine: {
    fontFamily: fonts.uiRegular,
    fontSize: 9,
    lineHeight: 11,
    marginTop: 7,
  },
  nextCard: {
    alignSelf: 'center',
    width: 269,
    maxWidth: '100%',
    marginTop: 21,
    borderRadius: 15,
    paddingTop: 11,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  nextTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
  },
  nextSummary: {
    fontFamily: fonts.uiRegular,
    fontSize: 9,
    lineHeight: 11,
    marginTop: 4,
  },
  nextActions: {
    flexDirection: 'row',
    gap: 33,
    marginTop: 14,
    paddingLeft: 3,
  },
  smallCta: {
    width: 99,
    height: 25,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCtaOutline: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  smallCtaText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  programSection: {
    marginTop: 28,
    gap: 20,
  },
  path: {
    position: 'relative',
  },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTick: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    lineHeight: 19,
  },
  nodePlay: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 9,
    lineHeight: 11,
    marginLeft: 2,
  },
  nodeLabel: {
    position: 'absolute',
    top: -2,
  },
  nodeTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 10,
    lineHeight: 13,
  },
  nodeMeta: {
    fontFamily: fonts.mono,
    fontSize: 7,
    lineHeight: 10,
  },
  cheer: {
    position: 'absolute',
    right: -3,
    top: CHEER_TOP,
    alignItems: 'flex-end',
  },
  cheerBubble: {
    width: CHEER_WIDTH,
    height: 38,
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheerText: {
    fontFamily: fonts.uiRegular,
    fontSize: 7.5,
    lineHeight: 9,
    textAlign: 'center',
  },
  cheerAvatar: {
    marginTop: -2,
    marginRight: 71,
  },
  logSection: {
    marginTop: 19,
    gap: 11,
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 15,
    paddingTop: 18,
    paddingLeft: 13,
    paddingRight: 19,
    paddingBottom: 15,
    marginRight: -6,
  },
  logHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  logCopy: { flex: 1, gap: 1 },
  logValue: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    lineHeight: 18,
  },
  logHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 9,
    lineHeight: 11,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 4,
  },
  bar: {
    width: 4,
  },
  logCta: {
    height: 25,
    marginTop: 15,
    marginLeft: 7,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCtaText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 10,
    lineHeight: 13,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 34,
    marginTop: 30,
  },
  footerButton: {
    width: 96,
    height: 25,
    borderWidth: 0.5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 10,
    lineHeight: 13,
  },
  deleteLink: {
    alignSelf: 'center',
    marginTop: 16,
    padding: spacing.sm,
  },
  deleteText: {
    fontFamily: fonts.uiRegular,
    fontSize: 10,
    lineHeight: 13,
  },
  input: {
    ...typography.body,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
})
