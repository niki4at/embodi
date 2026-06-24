import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, shadow, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { SetType } from './types'

type SetTypeColors = {
  /** Tint for the glyph + accents. */
  tint: string
  /** Soft background behind the leading glyph. */
  soft: string
  /** Background a completed row fills with for this type. */
  fill: string
}

/** Screen-space rectangle of the tapped set chip, used to anchor the popover. */
export type AnchorRect = {
  x: number
  y: number
  width: number
  height: number
}

type SetTypeOption = {
  type: SetType
  glyph: string
  label: string
  explanation: string
}

const OPTIONS: SetTypeOption[] = [
  {
    type: 'warmup',
    glyph: 'W',
    label: 'Warm up',
    explanation:
      'Lighter primer reps to prep the muscle and joints. Left out of working volume and personal records.',
  },
  {
    type: 'normal',
    glyph: '1',
    label: 'Normal',
    explanation:
      'Your standard working set at the prescribed load. Counts toward volume and progress.',
  },
  {
    type: 'failure',
    glyph: 'F',
    label: 'To failure',
    explanation:
      'Pushed until you can no longer move the weight with good form. Use sparingly to spike intensity.',
  },
  {
    type: 'drop',
    glyph: 'D',
    label: 'Drop set',
    explanation:
      'Hit failure, cut the weight immediately, and keep going with no rest to squeeze out extra reps.',
  },
]

/**
 * Maps each set type to its theme-aware accent colors. Warm-up borrows the
 * amber warning hue, normal stays neutral, failure runs hot red, and drop
 * leans blue so each role is legible at a glance.
 */
export function useSetTypeColors(): Record<SetType, SetTypeColors> {
  const { palette, resolved } = useTheme()
  const dark = resolved === 'dark'
  const failure = dark ? '#F87171' : '#EF4444'
  const drop = dark ? '#60A5FA' : '#3B82F6'
  return {
    warmup: {
      tint: palette.warning,
      soft: palette.warningMuted,
      fill: palette.warningSolid,
    },
    normal: {
      tint: palette.textSecondary,
      soft: palette.surfaceAlt,
      fill: palette.successSolid,
    },
    failure: {
      tint: failure,
      soft: 'rgba(239, 68, 68, 0.14)',
      fill: dark ? '#3A2222' : '#FBE2E2',
    },
    drop: {
      tint: drop,
      soft: 'rgba(59, 130, 246, 0.14)',
      fill: dark ? '#1E2A3C' : '#DCEAFB',
    },
  }
}

const CARD_WIDTH = 244
const SCREEN_MARGIN = 10
const GAP = 8
const CARET = 12
// Rough collapsed height used only to decide whether to flip above the anchor.
const EST_HEIGHT = 300

type SetTypePopoverProps = {
  visible: boolean
  /** Anchor rect of the tapped set chip, in window coordinates. */
  anchor: AnchorRect | null
  /** Currently applied type, highlighted as selected. */
  current: SetType
  /** Whether a "Remove" action should be offered (false for the last row). */
  canRemove: boolean
  onSelect: (type: SetType) => void
  onRemove: () => void
  onClose: () => void
}

export default function SetTypePopover({
  visible,
  anchor,
  current,
  canRemove,
  onSelect,
  onRemove,
  onClose,
}: SetTypePopoverProps) {
  const { palette } = useTheme()
  const colors = useSetTypeColors()
  const { width: screenW, height: screenH } = useWindowDimensions()
  const [expanded, setExpanded] = useState<SetType | 'remove' | null>(null)

  useEffect(() => {
    if (!visible) setExpanded(null)
  }, [visible])

  const placement = useMemo(() => {
    if (!anchor) return null
    const anchorCenterX = anchor.x + anchor.width / 2
    let left = anchorCenterX - CARD_WIDTH * 0.18
    left = Math.min(
      Math.max(left, SCREEN_MARGIN),
      screenW - CARD_WIDTH - SCREEN_MARGIN,
    )
    // Drop below the chip; flip above when there isn't room.
    const below = anchor.y + anchor.height + GAP
    const flip = below + EST_HEIGHT > screenH - SCREEN_MARGIN
    const top = flip ? anchor.y - GAP - EST_HEIGHT : below
    const caretLeft = Math.min(
      Math.max(anchorCenterX - left - CARET / 2, 14),
      CARD_WIDTH - 14 - CARET,
    )
    return { left, top: Math.max(top, SCREEN_MARGIN), flip, caretLeft }
  }, [anchor, screenW, screenH])

  const toggleExplanation = useCallback((key: SetType | 'remove') => {
    void Haptics.selectionAsync().catch(() => {})
    setExpanded(prev => (prev === key ? null : key))
  }, [])

  const handleSelect = useCallback(
    (type: SetType) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      onSelect(type)
      onClose()
    },
    [onSelect, onClose],
  )

  const handleRemove = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onRemove()
    onClose()
  }, [onRemove, onClose])

  if (!placement) return null

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close set type picker"
      />
      <Animated.View
        entering={ZoomIn.springify().damping(15).stiffness(220).mass(0.6)}
        exiting={ZoomOut.duration(120)}
        style={[
          styles.card,
          shadow.lg,
          {
            left: placement.left,
            top: placement.top,
            backgroundColor: palette.bgElevated,
            borderColor: palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.caret,
            placement.flip ? styles.caretBottom : styles.caretTop,
            {
              left: placement.caretLeft,
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
            },
          ]}
        />

        <Text style={[styles.heading, { color: palette.textTertiary }]}>
          Set type
        </Text>

        <View style={styles.list}>
          {OPTIONS.map(option => {
            const isSelected = option.type === current
            const isOpen = expanded === option.type
            const c = colors[option.type]
            return (
              <Animated.View
                key={option.type}
                layout={LinearTransition.duration(180)}
              >
                <Pressable
                  onPress={() => handleSelect(option.type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${option.label}${isSelected ? ', selected' : ''}`}
                  style={[
                    styles.row,
                    isSelected
                      ? { backgroundColor: c.soft }
                      : null,
                  ]}
                >
                  <View style={[styles.glyph, { borderColor: c.tint }]}>
                    <Text style={[styles.glyphText, { color: c.tint }]}>
                      {option.glyph}
                    </Text>
                  </View>
                  <Text
                    style={[styles.rowLabel, { color: palette.textPrimary }]}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? (
                    <IconSymbol name="checkmark" size={15} color={c.tint} />
                  ) : null}
                  <Pressable
                    onPress={() => toggleExplanation(option.type)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`What is a ${option.label} set?`}
                    style={styles.infoBtn}
                  >
                    <IconSymbol
                      name="info.circle"
                      size={16}
                      color={isOpen ? c.tint : palette.textTertiary}
                    />
                  </Pressable>
                </Pressable>
                {isOpen ? (
                  <Animated.Text
                    entering={FadeIn.duration(140)}
                    exiting={FadeOut.duration(100)}
                    style={[
                      styles.explanation,
                      { color: palette.textSecondary },
                    ]}
                  >
                    {option.explanation}
                  </Animated.Text>
                ) : null}
              </Animated.View>
            )
          })}

          {canRemove ? (
            <Animated.View layout={LinearTransition.duration(180)}>
              <View
                style={[styles.divider, { backgroundColor: palette.divider }]}
              />
              <Pressable
                onPress={handleRemove}
                accessibilityRole="button"
                accessibilityLabel="Remove set"
                style={styles.row}
              >
                <View
                  style={[styles.glyph, { borderColor: palette.danger }]}
                >
                  <IconSymbol name="xmark" size={13} color={palette.danger} />
                </View>
                <Text style={[styles.rowLabel, { color: palette.danger }]}>
                  Remove set
                </Text>
                <Pressable
                  onPress={() => toggleExplanation('remove')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="What does remove set do?"
                  style={styles.infoBtn}
                >
                  <IconSymbol
                    name="info.circle"
                    size={16}
                    color={
                      expanded === 'remove'
                        ? palette.danger
                        : palette.textTertiary
                    }
                  />
                </Pressable>
              </Pressable>
              {expanded === 'remove' ? (
                <Animated.Text
                  entering={FadeIn.duration(140)}
                  exiting={FadeOut.duration(100)}
                  style={[styles.explanation, { color: palette.textSecondary }]}
                >
                  Deletes this set from the exercise. Any reps or weight logged
                  here are removed.
                </Animated.Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  caret: {
    position: 'absolute',
    width: CARET,
    height: CARET,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  caretTop: {
    top: -CARET / 2,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  caretBottom: {
    bottom: -CARET / 2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  heading: {
    ...typography.caption,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    ...typography.smallStrong,
    fontSize: 13,
  },
  rowLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
    flex: 1,
  },
  infoBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xxs,
    marginHorizontal: spacing.sm,
  },
  explanation: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
})
