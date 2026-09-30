import * as Haptics from 'expo-haptics'
import React from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

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
    <View style={styles.section}>
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
    <View style={styles.section}>
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
                : 'In progress'
          const detail =
            goal.status === 'generating'
              ? 'Coach is building'
              : goal.weekCount > 0
                ? `${meta.label} \u00b7 ${goal.weekCount} weeks \u00b7 ${goal.percent}%`
                : `${meta.label} \u00b7 ${goal.percent}%`
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
      <LinearGradient
        colors={['rgba(75,158,254,0.18)', 'rgba(201,145,241,0.28)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.suggestedGradient}
      >
        <View style={styles.suggestedWave}>
          <View style={[styles.wave, { borderColor: 'rgba(75,158,254,0.55)' }]} />
          <View style={[styles.wave, styles.waveTwo, { borderColor: 'rgba(201,145,241,0.6)' }]} />
        </View>
        <View style={styles.suggestedCopy}>
          <Text style={[styles.suggestedEyebrow, { color: palette.textSecondary }]}>
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
      </LinearGradient>
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
    <View style={styles.section}>
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
    marginTop: spacing.xxxl,
    gap: spacing.md,
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
    paddingVertical: spacing.md,
    minHeight: 68,
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
    paddingVertical: spacing.md,
    minHeight: 84,
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
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  suggestedGradient: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestedWave: {
    width: '48%',
    height: 150,
    overflow: 'hidden',
  },
  wave: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    left: -70,
    top: 30,
  },
  waveTwo: {
    left: -30,
    top: 70,
    width: 260,
    height: 260,
    borderRadius: 130,
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
    paddingTop: 6,
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
