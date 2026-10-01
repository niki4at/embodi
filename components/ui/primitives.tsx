import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import React from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { gradients, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

/* -------------------------------------------------------------------------- */
/* Eyebrow                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Small tracked mono label that heads each section (TODAY'S CONTEXT, SLEEP).
 * Optional dot picks up a semantic colour (phase, energy, status).
 */
export function Eyebrow({
  children,
  dot,
  color,
  right,
  style,
}: {
  children: string
  dot?: string
  color?: string
  right?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const { palette } = useTheme()
  return (
    <View style={[styles.eyebrowRow, style]}>
      {dot ? <View style={[styles.eyebrowDot, { backgroundColor: dot }]} /> : null}
      <Text
        style={[styles.eyebrow, { color: color ?? palette.textSecondary }]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {right ? <View style={styles.eyebrowRight}>{right}</View> : null}
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Flow header (check-in steps)                                                */
/* -------------------------------------------------------------------------- */

/**
 * "← Back · 2 / 4" header with four segmented progress bars, as used on every
 * adjust-for-today step.
 */
export function FlowHeader({
  backLabel,
  onBack,
  step,
  total,
  right,
}: {
  backLabel: string
  onBack: () => void
  step: number
  total: number
  right?: React.ReactNode
}) {
  const { palette } = useTheme()
  return (
    <View style={styles.flowHeader}>
      <View style={styles.flowHeaderTop}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          style={({ pressed }) => [styles.flowBack, pressed && styles.pressed]}
        >
          <Text style={[styles.flowBackText, { color: palette.textSecondary }]}>
            {'\u2190'} {backLabel}
          </Text>
        </Pressable>
        {right ?? (
          <Text
            style={[styles.flowCount, { color: palette.textSecondary }]}
            accessibilityLabel={`Step ${step} of ${total}`}
          >
            {step} / {total}
          </Text>
        )}
      </View>
      <View style={styles.flowSegments} accessible={false}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.flowSegment,
              {
                backgroundColor:
                  i < step ? palette.primary : palette.surfaceHigh,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Hero orb                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The gradient circle used for Start, "Coach is planning", "Ready", and the
 * finished-session "Done · 38 min" hero.
 */
export function HeroOrb({
  size = 150,
  children,
  style,
  muted = false,
}: {
  size?: number
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  muted?: boolean
}) {
  return (
    <LinearGradient
      colors={muted ? [...gradients.heroSoft] : [...gradients.hero]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  )
}

/* -------------------------------------------------------------------------- */
/* Summary rows                                                                */
/* -------------------------------------------------------------------------- */

export type SummaryRow = {
  label: string
  value: string
  dot: string
}

/**
 * Hairline-separated label/value list (Sleep · 7-8 h) with a coloured dot per
 * row, as on the Ready and Finished screens.
 */
export function SummaryRows({ rows }: { rows: SummaryRow[] }) {
  const { palette } = useTheme()
  return (
    <View
      style={[styles.summary, { borderTopColor: palette.divider }]}
      accessibilityRole="summary"
    >
      {rows.map((row) => (
        <View
          key={row.label}
          style={[styles.summaryRow, { borderBottomColor: palette.divider }]}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}`}
        >
          <View style={[styles.summaryDot, { backgroundColor: row.dot }]} />
          <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>
            {row.label}
          </Text>
          <Text
            style={[styles.summaryValue, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Chips and tiles                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Pill chip. Unselected: hairline outline. Selected: solid ink.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  dashed = false,
  leading,
  style,
  accessibilityLabel,
}: {
  label: string
  selected?: boolean
  onPress?: () => void
  dashed?: boolean
  leading?: React.ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const { palette, resolved } = useTheme()
  const ink = resolved === 'dark' ? palette.white : palette.textPrimary
  const onInk = resolved === 'dark' ? palette.black : palette.white
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        onPress?.()
      }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? ink : 'transparent',
          borderColor: selected ? ink : palette.borderStrong,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      {leading}
      <Text style={[styles.chipText, { color: selected ? onInk : palette.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Rectangular option tile (energy rows, time cards, type tiles). `tone`
 * controls the selected look: `tint` = blue wash with a blue border,
 * `ink` = solid black.
 */
export function OptionTile({
  title,
  subtitle,
  selected = false,
  onPress,
  tone = 'tint',
  dot,
  centered = false,
  trailing,
  style,
  accessibilityLabel,
}: {
  title: string
  subtitle?: string
  selected?: boolean
  onPress?: () => void
  tone?: 'tint' | 'ink'
  dot?: string
  centered?: boolean
  trailing?: React.ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const { palette, resolved } = useTheme()
  const inkFill = resolved === 'dark' ? palette.white : palette.textPrimary
  const onInk = resolved === 'dark' ? palette.black : palette.white
  const isInk = tone === 'ink' && selected

  const bg = selected
    ? isInk
      ? inkFill
      : palette.primaryMuted
    : 'transparent'
  const border = selected
    ? isInk
      ? inkFill
      : palette.primary
    : palette.border
  const titleColor = isInk ? onInk : palette.textPrimary
  const subtitleColor = isInk ? onInk : palette.textSecondary

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress?.()
      }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)
      }
      style={({ pressed }) => [
        styles.tile,
        centered ? styles.tileCentered : styles.tileRow,
        { backgroundColor: bg, borderColor: border },
        pressed && styles.pressed,
        style,
      ]}
    >
      {dot ? (
        <View
          style={[
            styles.tileDot,
            centered && styles.tileDotCentered,
            { backgroundColor: dot },
          ]}
        />
      ) : null}
      <View style={centered ? styles.tileTextCentered : styles.tileText}>
        <Text
          style={[styles.tileTitle, centered && styles.tileTitleCentered, { color: titleColor }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.tileSubtitle,
              { color: subtitleColor, opacity: isInk ? 0.8 : 1 },
              centered && styles.tileTitleCentered,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  )
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                           */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  style,
}: {
  options: { value: T; label: string; leading?: React.ReactNode }[]
  value: T
  onChange: (value: T) => void
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { palette } = useTheme()
  return (
    <View
      style={[styles.segmented, { backgroundColor: palette.surfaceAlt }, style]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onChange(option.value)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={[
              styles.segment,
              compact && styles.segmentCompact,
              active && { backgroundColor: palette.bgElevated },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? palette.textPrimary : palette.textSecondary },
              ]}
            >
              {option.label}
            </Text>
            {option.leading}
          </Pressable>
        )
      })}
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Coach avatar and bubble                                                     */
/* -------------------------------------------------------------------------- */

/** The lavender blob with two eyes and a smile that voices the coach. */
export function CoachAvatar({ size = 36 }: { size?: number }) {
  const { palette } = useTheme()
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Coach"
    >
      <Svg width={size} height={size} viewBox="0 0 36 30">
        <Path
          d="M18 1 C 28 1, 35 7, 35 15 C 35 23, 28 29, 18 29 C 8 29, 1 23, 1 15 C 1 7, 8 1, 18 1 Z"
          fill={palette.accent}
        />
        <Circle cx="13" cy="13" r="2.2" fill={palette.white} />
        <Circle cx="23" cy="13" r="2.2" fill={palette.white} />
        <Path
          d="M13 19.5 Q 18 24 23 19.5"
          stroke={palette.white}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}

/**
 * Soft lavender speech bubble with a small mono eyebrow (COACH SAYS) and the
 * coach avatar tucked at one corner.
 */
export function CoachNote({
  eyebrow = 'Coach says',
  children,
  action,
  avatarPosition = 'left',
  style,
}: {
  eyebrow?: string
  children: React.ReactNode
  action?: React.ReactNode
  avatarPosition?: 'left' | 'right'
  style?: StyleProp<ViewStyle>
}) {
  const { palette } = useTheme()
  const avatar = (
    <View style={styles.coachAvatarWrap}>
      <CoachAvatar size={40} />
    </View>
  )
  return (
    <View
      style={[styles.coachRow, avatarPosition === 'right' && styles.coachRowReverse, style]}
      accessible
      accessibilityLabel={`${eyebrow}. ${typeof children === 'string' ? children : ''}`}
    >
      {avatar}
      <View style={[styles.coachBubble, { backgroundColor: palette.coachMuted }]}>
        <Text style={[styles.eyebrow, { color: palette.coach, marginBottom: 6 }]}>
          {eyebrow}
        </Text>
        {typeof children === 'string' ? (
          <Text style={[styles.coachText, { color: palette.textPrimary }]}>
            {children}
          </Text>
        ) : (
          children
        )}
        {action ? <View style={styles.coachAction}>{action}</View> : null}
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

/** Tiny four-point sparkle used to mark an inferred suggestion. */
export function InferredSparkle({ size = 10, color }: { size?: number; color?: string }) {
  const { palette } = useTheme()
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Path
        d="M5 0 C 5.4 3, 7 4.6, 10 5 C 7 5.4, 5.4 7, 5 10 C 4.6 7, 3 5.4, 0 5 C 3 4.6, 4.6 3, 5 0 Z"
        fill={color ?? palette.accent}
      />
    </Svg>
  )
}

/** Small inline text link ("Edit for today", "See all"). */
export function TextLink({
  label,
  onPress,
  color,
  style,
}: {
  label: string
  onPress: () => void
  color?: string
  style?: StyleProp<TextStyle>
}) {
  const { palette } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={[styles.textLink, { color: color ?? palette.primary }, style]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Arrow list row ("Log my own check in →"). */
export function ArrowRow({
  label,
  onPress,
  dot,
  last = false,
}: {
  label: string
  onPress: () => void
  dot?: string
  last?: boolean
}) {
  const { palette } = useTheme()
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.arrowRow,
        { borderBottomColor: last ? 'transparent' : palette.divider },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.arrowDot, { backgroundColor: dot ?? palette.primary }]} />
      <Text style={[styles.arrowLabel, { color: palette.textPrimary }]}>{label}</Text>
      <Text style={[styles.arrowGlyph, { color: palette.textPrimary }]}>{'\u2192'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eyebrow: {
    ...typography.eyebrow,
    flexShrink: 1,
  },
  eyebrowRight: {
    marginLeft: 'auto',
  },

  flowHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  flowHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  flowBack: {
    paddingVertical: 4,
  },
  flowBackText: {
    ...typography.smallStrong,
  },
  flowCount: {
    ...typography.mono,
  },
  flowSegments: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flowSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  summary: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryLabel: {
    ...typography.small,
    flex: 1,
  },
  summaryValue: {
    ...typography.smallStrong,
    maxWidth: '65%',
    textAlign: 'right',
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.smallStrong,
    fontSize: 14,
  },

  tile: {
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 56,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  tileCentered: {
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  tileDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tileDotCentered: {
    alignSelf: 'center',
    marginBottom: 6,
  },
  tileText: {
    flex: 1,
    gap: 1,
  },
  tileTextCentered: {
    alignSelf: 'stretch',
    gap: 1,
  },
  tileTitleCentered: {
    textAlign: 'center',
  },
  tileTitle: {
    ...typography.bodyStrong,
  },
  tileSubtitle: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
  },

  segmented: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  segmentCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minHeight: 28,
    paddingHorizontal: 12,
  },
  segmentText: {
    ...typography.smallStrong,
    fontSize: 12,
  },

  coachRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  coachRowReverse: {
    flexDirection: 'row-reverse',
  },
  coachAvatarWrap: {
    paddingBottom: 2,
  },
  coachBubble: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  coachText: {
    ...typography.small,
    fontSize: 14,
    lineHeight: 20,
  },
  coachAction: {
    marginTop: spacing.sm,
    alignItems: 'flex-end',
  },

  textLink: {
    ...typography.smallStrong,
  },

  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  arrowLabel: {
    ...typography.bodyStrong,
    flex: 1,
  },
  arrowGlyph: {
    ...typography.bodyStrong,
  },
})
