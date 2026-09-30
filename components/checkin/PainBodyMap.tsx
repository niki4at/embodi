import * as Haptics from 'expo-haptics'
import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg'

import { Chip, Eyebrow, Segmented } from '@/components/ui/primitives'
import {
  BACK_PARTS,
  FRONT_PARTS,
  PART_LABELS,
  type BodyPart,
  type BodyPartShape,
} from '@/constants/body-shapes'
import { painDot } from '@/constants/checkin-labels'
import { motion, radius, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'

export type { BodyPart } from '@/constants/body-shapes'

export type PainRatings = Partial<Record<BodyPart, number>>

interface PainBodyMapProps {
  value: PainRatings
  onChange: (ratings: PainRatings) => void
  /** Renders the "No pain today" chip under the figure. */
  showClear?: boolean
}

/** Approximate visual centre of a part so we can place its tap dot. */
function partCenter(part: BodyPartShape): { x: number; y: number } {
  if (part.shape === 'ellipse') {
    return { x: part.cx ?? 0, y: part.cy ?? 0 }
  }
  const numbers = (part.d ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = numbers[i]
    const y = numbers[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/**
 * Tap-the-spot body map. Every region carries a small hollow dot; tapping one
 * opens an inline "How bad" rating card under the figure and fills the dot
 * with a numbered badge (yellow, orange, red as pain climbs). Tapping the
 * dot again closes the card. Rated spots also appear as chips below.
 */
export function PainBodyMap({ value, onChange, showClear = true }: PainBodyMapProps) {
  const { palette, resolved } = useTheme()
  const [view, setView] = useState<'front' | 'back'>('front')
  const [selectedPart, setSelectedPart] = useState<BodyPart | null>(null)

  const parts = view === 'front' ? FRONT_PARTS : BACK_PARTS
  const centers = useMemo(
    () => new Map(parts.map((p) => [p.id, partCenter(p)] as const)),
    [parts],
  )

  const figureFill = resolved === 'dark' ? palette.surfaceAlt : '#EFEFF1'
  const figureStroke = resolved === 'dark' ? palette.border : '#E2E2E6'
  const dotStroke = resolved === 'dark' ? palette.textTertiary : '#A6A6AB'
  const dotFill = palette.bgElevated

  const rated = (Object.entries(value) as [BodyPart, number][]).filter(
    ([, level]) => level > 0,
  )

  const handleTap = (part: BodyPart) => {
    Haptics.selectionAsync().catch(() => {})
    if (selectedPart === part) {
      setSelectedPart(null)
      return
    }
    setSelectedPart(part)
    if (value[part] === undefined) {
      onChange({ ...value, [part]: 3 })
    }
  }

  const handleRate = (level: number) => {
    if (!selectedPart) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (level === 0) {
      const next = { ...value }
      delete next[selectedPart]
      onChange(next)
      return
    }
    onChange({ ...value, [selectedPart]: level })
  }

  const handleRemove = () => {
    if (!selectedPart) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    const next = { ...value }
    delete next[selectedPart]
    onChange(next)
    setSelectedPart(null)
  }

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onChange({})
    setSelectedPart(null)
  }

  const selectedLevel = selectedPart ? value[selectedPart] ?? 0 : 0

  return (
    <View style={styles.wrap}>
      <Segmented
        compact
        style={styles.toggle}
        value={view}
        onChange={(next) => {
          setView(next)
          setSelectedPart(null)
        }}
        options={[
          { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' },
        ]}
      />

      <View style={styles.canvas}>
        <View style={styles.sideLabels} pointerEvents="none">
          <Text style={[styles.sideLabel, { color: palette.textSecondary }]}>
            {view === 'front' ? 'R' : 'L'}
          </Text>
          <Text style={[styles.sideLabel, { color: palette.textSecondary }]}>
            {view === 'front' ? 'L' : 'R'}
          </Text>
        </View>
        <Svg
          viewBox="0 0 200 400"
          width="100%"
          height="100%"
          accessibilityLabel={`${view} of the body. Tap a spot to rate it.`}
        >
          <G>
            {parts.map((part) =>
              part.shape === 'ellipse' ? (
                <Ellipse
                  key={`${view}-${part.id}`}
                  cx={part.cx}
                  cy={part.cy}
                  rx={part.rx}
                  ry={part.ry}
                  fill={figureFill}
                  stroke={figureStroke}
                  strokeWidth={1}
                  onPress={() => handleTap(part.id)}
                />
              ) : (
                <Path
                  key={`${view}-${part.id}`}
                  d={part.d}
                  fill={figureFill}
                  stroke={figureStroke}
                  strokeWidth={1}
                  onPress={() => handleTap(part.id)}
                />
              ),
            )}
          </G>
          <G>
            {parts.map((part) => {
              const center = centers.get(part.id)
              if (!center) return null
              const level = value[part.id] ?? 0
              const isSelected = selectedPart === part.id
              if (level > 0) {
                const color = painDot(level, palette)
                return (
                  <G key={`dot-${view}-${part.id}`} onPress={() => handleTap(part.id)}>
                    <Circle
                      cx={center.x}
                      cy={center.y}
                      r={isSelected ? 13 : 12}
                      fill={color}
                      stroke={isSelected ? palette.textPrimary : color}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                    <SvgText
                      x={center.x}
                      y={center.y + 4.2}
                      fontSize={11}
                      fontFamily={fonts.uiBold}
                      fontWeight="700"
                      fill={palette.black}
                      textAnchor="middle"
                    >
                      {String(level)}
                    </SvgText>
                  </G>
                )
              }
              return (
                <Circle
                  key={`dot-${view}-${part.id}`}
                  cx={center.x}
                  cy={center.y}
                  r={isSelected ? 7 : 5}
                  fill={dotFill}
                  stroke={isSelected ? palette.textPrimary : dotStroke}
                  strokeWidth={isSelected ? 2 : 1.2}
                  onPress={() => handleTap(part.id)}
                />
              )
            })}
          </G>
        </Svg>
      </View>

      {selectedPart ? (
        <Animated.View
          key={selectedPart}
          entering={FadeInDown.duration(motion.duration.base)}
          exiting={FadeOut.duration(motion.duration.quick)}
          style={[styles.ratingCard, { borderColor: palette.border }]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.ratingHeader}>
            <Text style={[styles.ratingTitle, { color: palette.textPrimary }]}>
              {PART_LABELS[selectedPart]}
            </Text>
            <Pressable
              onPress={handleRemove}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${PART_LABELS[selectedPart]}`}
            >
              <Text style={[styles.remove, { color: palette.textSecondary }]}>Remove</Text>
            </Pressable>
          </View>
          <Eyebrow
            right={
              <Text style={[styles.ratingCount, { color: palette.textSecondary }]}>
                {selectedLevel}/10
              </Text>
            }
          >
            How bad
          </Eyebrow>
          <View style={styles.levels} accessibilityRole="radiogroup">
            {LEVELS.map((level) => {
              const active = level === selectedLevel
              const color = painDot(level, palette)
              return (
                <Pressable
                  key={level}
                  onPress={() => handleRate(level)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Pain ${level} of 10`}
                  style={[
                    styles.level,
                    {
                      backgroundColor: active ? color : 'transparent',
                      borderColor: active ? color : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.levelText,
                      { color: active ? palette.black : palette.textPrimary },
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.chips}>
        {rated.map(([part, level]) => {
          const color = painDot(level, palette)
          const active = selectedPart === part
          return (
            <Chip
              key={part}
              label={PART_LABELS[part]}
              onPress={() => {
                const shape = [...FRONT_PARTS, ...BACK_PARTS].find((p) => p.id === part)
                const inFront = FRONT_PARTS.some((p) => p.id === part)
                if (shape) setView(inFront ? 'front' : 'back')
                setSelectedPart(part)
              }}
              accessibilityLabel={`${PART_LABELS[part]}, pain ${level} of 10. Edit.`}
              leading={
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>{level}</Text>
                </View>
              }
              style={[
                styles.ratedChip,
                active && { borderColor: palette.textPrimary },
              ]}
            />
          )
        })}
        {showClear ? (
          <Chip
            label={rated.length > 0 ? 'Clear all' : 'No pain today'}
            onPress={handleClear}
            selected={false}
          />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  toggle: {
    alignSelf: 'flex-start',
  },
  canvas: {
    width: '100%',
    aspectRatio: 200 / 400,
    maxHeight: 440,
    alignSelf: 'center',
  },
  sideLabels: {
    position: 'absolute',
    top: 8,
    left: '12%',
    right: '12%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  sideLabel: {
    ...typography.mono,
  },
  ratingCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingTitle: {
    ...typography.h3,
  },
  remove: {
    ...typography.smallStrong,
  },
  ratingCount: {
    ...typography.mono,
    fontSize: 11,
  },
  levels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  level: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 30,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ratedChip: {
    paddingLeft: 6,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.smallStrong,
    fontSize: 12,
    color: '#0B0B0D',
  },
})
