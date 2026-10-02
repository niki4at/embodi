import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'

import {
  ArrowRow,
  CoachNote,
  Eyebrow,
  TextLink,
} from '@/components/ui/primitives'
import { CATEGORY_META } from '@/constants/challenge-meta'
import { gradients, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import type { Id } from '@/convex/_generated/dataModel'
import { currentWeekIndex } from '@/utils/challenge-week'

/* -------------------------------------------------------------------------- */
/* Today's context tiles                                                       */
/* -------------------------------------------------------------------------- */

export type ContextTile = {
  key: string
  label: string
  value: string
  dot: string
  onPress?: () => void
}

/**
 * 2x2 grid of soft tiles (Sleep, Energy, Recovery, This week). Tone, not
 * borders, separates them from the page.
 */
export function ContextTiles({ tiles }: { tiles: ContextTile[] }) {
  const { palette } = useTheme()
  return (
    <View style={[styles.section, styles.contextSection]}>
      <Eyebrow>Today&apos;s context</Eyebrow>
      <View style={styles.tileGrid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={
              tile.onPress
                ? () => {
                    Haptics.selectionAsync().catch(() => {})
                    tile.onPress?.()
                  }
                : undefined
            }
            disabled={!tile.onPress}
            accessibilityRole={tile.onPress ? 'button' : 'text'}
            accessibilityLabel={`${tile.label}: ${tile.value}`}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: palette.surface },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.tileHeader}>
              <View style={[styles.tileDot, { backgroundColor: tile.dot }]} />
              <Text style={[styles.tileLabel, { color: palette.textSecondary }]}>
                {tile.label}
              </Text>
            </View>
            <Text
              style={[styles.tileValue, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {tile.value}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* AI coach                                                                    */
/* -------------------------------------------------------------------------- */

export function CoachSection({
  text,
  actionLabel,
  onAction,
}: {
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  const { palette } = useTheme()
  return (
    <View style={[styles.section, styles.coachSection]}>
      <Eyebrow>AI coach</Eyebrow>
      <CoachNote
        eyebrow="Coach"
        avatarPosition="right"
        action={
          actionLabel && onAction ? (
            <TextLink
              label={`${actionLabel} \u2192`}
              onPress={onAction}
              color={palette.coach}
            />
          ) : undefined
        }
      >
        {text}
      </CoachNote>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Your other goals                                                            */
/* -------------------------------------------------------------------------- */

export type GoalCard = {
  _id: Id<'challenges'>
  title: string
  category: keyof typeof CATEGORY_META
  status: 'generating' | 'active' | 'completed' | 'archived' | 'failed'
  weekCount: number
  weekFocuses?: string[]
  createdAt?: number
  percent: number
}

export function GoalsStrip({
  goals,
  onOpen,
  onSeeAll,
}: {
  goals: GoalCard[]
  onOpen: (id: Id<'challenges'>) => void
  onSeeAll: () => void
}) {
  const { palette } = useTheme()
  if (goals.length === 0) return null
  return (
    <View style={styles.section}>
      <Eyebrow right={<TextLink label="All challenges" onPress={onSeeAll} />}>
        Your other goals
      </Eyebrow>
      <View style={styles.goalRow}>
        {goals.slice(0, 2).map((goal) => {
          const meta = CATEGORY_META[goal.category]
          const accent = palette[meta.accent]
          const status =
            goal.status === 'generating'
              ? 'Planning'
              : goal.status === 'completed'
                ? 'Done'
                : 'Queued'
          const focus =
            goal.weekFocuses && goal.weekFocuses.length > 0
              ? goal.weekFocuses[
                  currentWeekIndex(goal.createdAt ?? 0, goal.weekFocuses.length)
                ]
              : meta.label
          const detail =
            goal.status === 'generating'
              ? 'Coach is building'
              : goal.weekCount > 0
                ? `${focus} \u00b7 ${goal.weekCount} wk`
                : `${focus} \u00b7 ${goal.percent}%`
          return (
            <Pressable
              key={goal._id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                onOpen(goal._id)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${goal.title}. ${status}. ${detail}`}
              style={({ pressed }) => [
                styles.goalCard,
                { borderColor: palette.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.tileHeader}>
                <View style={[styles.tileDot, { backgroundColor: accent }]} />
                <Text style={[styles.tileLabel, { color: palette.textSecondary }]}>
                  {status}
                </Text>
              </View>
              <Text
                style={[styles.goalTitle, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {goal.title}
              </Text>
              <Text
                style={[styles.goalDetail, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {detail}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Suggested tonight                                                           */
/* -------------------------------------------------------------------------- */

const SUGGESTED_PHOTO = require('../../assets/images/suggested-tonight.jpg')

/** Gradient wave traced from the Figma home frame (Vector 7). */
const WAVE_PATH =
  'M1.26248 0.750091C-2.00548 24.4628 10.7367 56.18 28.6324 58.108C46.5281 60.036 47.5808 75.46 59.6867 81.726C71.7926 87.9919 124.953 65.82 139.165 67.266C153.376 68.712 150.744 101.488 159.166 110.164C167.587 118.84 196.536 144.386 207.063 130.89C217.59 117.394 241.802 101.488 260.75 105.826'

export function SuggestedCard({
  eyebrow,
  title,
  meta,
  onPress,
}: {
  eyebrow: string
  title: string
  meta?: string
  onPress: () => void
}) {
  const { palette } = useTheme()
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${title}${meta ? `. ${meta}` : ''}. Starts with a quick check-in.`}
      style={({ pressed }) => [styles.suggested, pressed && styles.pressed]}
    >
      <Image
        source={SUGGESTED_PHOTO}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        accessibilityIgnoresInvertColors
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, opacity: 0.5 }]} />
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 261.5 135.5"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <SvgGradient id="suggested-wave" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.hero[0]} />
            <Stop offset="1" stopColor={gradients.hero[1]} />
          </SvgGradient>
        </Defs>
        <Path d={WAVE_PATH} stroke="url(#suggested-wave)" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      </Svg>
      <View style={styles.suggestedInner}>
        <View style={styles.suggestedSpacer} />
        <View style={styles.suggestedCopy}>
          <Text style={[styles.suggestedEyebrow, { color: palette.textPrimary }]}>
            {eyebrow.toUpperCase()}
          </Text>
          <Text style={[styles.suggestedTitle, { color: palette.textPrimary }]}>
            {title} {'\u2192'}
          </Text>
          {meta ? (
            <Text style={[styles.suggestedMeta, { color: palette.textSecondary }]}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick actions                                                               */
/* -------------------------------------------------------------------------- */

export function QuickActions({
  actions,
}: {
  actions: { label: string; onPress: () => void }[]
}) {
  return (
    <View style={styles.section}>
      <Eyebrow>Quick actions</Eyebrow>
      <View>
        {actions.map((action, index) => (
          <ArrowRow
            key={action.label}
            label={action.label}
            onPress={action.onPress}
            last={index === actions.length - 1}
            compact
          />
        ))}
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* At your desk                                                                */
/* -------------------------------------------------------------------------- */

export type DeskMove = {
  id: string
  title: string
  meta: string
  durationMin: number
}

export function DeskSection({
  enabled,
  onToggle,
  moves,
  onStart,
}: {
  enabled: boolean
  onToggle: (next: boolean) => void
  moves: DeskMove[]
  onStart: (move: DeskMove) => void
}) {
  const { palette } = useTheme()
  return (
    <View style={[styles.section, styles.deskSection]}>
      <Eyebrow
        right={
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: palette.surfaceHigh, true: palette.primary }}
            thumbColor={palette.white}
            style={styles.switch}
            accessibilityLabel="Show desk micro-sessions"
          />
        }
      >
        At your desk
      </Eyebrow>
      {enabled ? (
        <View style={styles.deskRow}>
          <LinearGradient
            colors={['rgba(201,145,241,0.35)', 'rgba(255,139,236,0.25)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.deskBlob}
          >
            <Text style={[styles.deskBlurb, { color: palette.textPrimary }]}>
              Two minutes, no change of clothes. Matched to your neck and hips.
            </Text>
          </LinearGradient>
          <View style={styles.deskCards}>
            {moves.map((move, index) => (
              <Pressable
                key={move.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  onStart(move)
                }}
                accessibilityRole="button"
                accessibilityLabel={`${move.title}. ${move.meta}. Starts with a quick check-in.`}
                style={({ pressed }) => [
                  styles.deskCard,
                  { borderColor: palette.border, backgroundColor: palette.bgElevated },
                  index === 1 && styles.deskCardOffset,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.deskTitle, { color: palette.textPrimary }]}>
                  {move.title}
                </Text>
                <Text style={[styles.deskMeta, { color: palette.textSecondary }]}>
                  {move.meta}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

/* -------------------------------------------------------------------------- */

export function HeroGradientDivider() {
  return (
    <LinearGradient
      colors={[...gradients.hero]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.gradientDivider}
    />
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  contextSection: {
    marginTop: spacing.lg,
  },
  coachSection: {
    gap: spacing.xs,
  },
  deskSection: {
    gap: spacing.xl,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 60,
    justifyContent: 'center',
    gap: 4,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tileLabel: {
    ...typography.small,
    fontSize: 12,
  },
  tileValue: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  goalRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  goalCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 72,
    gap: 4,
  },
  goalTitle: {
    ...typography.bodyStrong,
  },
  goalDetail: {
    ...typography.small,
    fontSize: 12,
  },
  suggested: {
    marginTop: 30,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  suggestedInner: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestedSpacer: {
    width: '50%',
  },
  suggestedCopy: {
    flex: 1,
    paddingRight: spacing.lg,
    gap: 4,
  },
  suggestedEyebrow: {
    ...typography.eyebrow,
    fontSize: 10,
  },
  suggestedTitle: {
    ...typography.bodyStrong,
    fontSize: 17,
    lineHeight: 22,
  },
  suggestedMeta: {
    ...typography.small,
    fontSize: 12,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  deskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  deskBlob: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deskBlurb: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  deskCards: {
    flex: 1,
    gap: spacing.sm,
    paddingTop: 13,
  },
  deskCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
    alignSelf: 'stretch',
  },
  deskCardOffset: {
    marginLeft: '30%',
  },
  deskTitle: {
    ...typography.bodyStrong,
  },
  deskMeta: {
    ...typography.small,
    fontSize: 12,
  },
  gradientDivider: {
    height: 2,
    borderRadius: 1,
  },
})
