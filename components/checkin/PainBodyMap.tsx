import * as Haptics from 'expo-haptics'
import React, { useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Ellipse, G, Path } from 'react-native-svg'

import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import {
  BACK_PARTS,
  FRONT_PARTS,
  PART_LABELS,
  type BodyPart,
} from '@/constants/body-shapes'

import { PillButton } from '@/components/ui/pill-button'

export type { BodyPart } from '@/constants/body-shapes'

export type PainRatings = Partial<Record<BodyPart, number>>

interface PainBodyMapProps {
  value: PainRatings
  onChange: (ratings: PainRatings) => void
  showLegend?: boolean
}

function painColor(level: number, palette: ReturnType<typeof useTheme>['palette']) {
  if (level <= 0) return 'transparent'
  if (level <= 3) return palette.painMildSoft
  if (level <= 6) return palette.painModerateSoft
  return palette.painSevereSoft
}

function painSolid(level: number, palette: ReturnType<typeof useTheme>['palette']) {
  if (level <= 3) return palette.painMild
  if (level <= 6) return palette.painModerate
  return palette.painSevere
}

export function PainBodyMap({ value, onChange, showLegend = true }: PainBodyMapProps) {
  const { palette, resolved } = useTheme()
  const [view, setView] = useState<'front' | 'back'>('front')
  const [selectedPart, setSelectedPart] = useState<BodyPart | null>(null)
  const [tempRating, setTempRating] = useState<number>(5)

  const parts = view === 'front' ? FRONT_PARTS : BACK_PARTS

  const baseFill = resolved === 'dark' ? palette.surfaceAlt : '#EEF1F4'
  const stroke = palette.borderStrong

  const handlePartPress = (part: BodyPart) => {
    Haptics.selectionAsync()
    setTempRating(value[part] ?? 5)
    setSelectedPart(part)
  }

  const confirmRating = () => {
    if (selectedPart === null) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onChange({ ...value, [selectedPart]: tempRating })
    setSelectedPart(null)
  }

  const removeRating = () => {
    if (selectedPart === null) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const next = { ...value }
    delete next[selectedPart]
    onChange(next)
    setSelectedPart(null)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toggleRow}>
        <View
          style={[
            styles.toggleTrack,
            { backgroundColor: palette.surfaceAlt },
          ]}
        >
          {(['front', 'back'] as const).map(v => {
            const active = v === view
            return (
              <TouchableOpacity
                key={v}
                style={[
                  styles.toggleBtn,
                  active && {
                    backgroundColor: palette.surface,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync()
                  setView(v)
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    {
                      color: active ? palette.textPrimary : palette.textSecondary,
                    },
                  ]}
                >
                  {v === 'front' ? 'Front' : 'Back'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View
        style={[
          styles.canvas,
          {
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.border,
          },
        ]}
      >
        <Svg viewBox="0 0 200 420" width="100%" height="100%">
          <G>
            {parts.map(part => {
              const level = value[part.id] ?? 0
              const fill = level > 0 ? painColor(level, palette) : baseFill

              if (part.shape === 'ellipse') {
                return (
                  <Ellipse
                    key={`${view}-${part.id}`}
                    cx={part.cx}
                    cy={part.cy}
                    rx={part.rx}
                    ry={part.ry}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                    onPress={() => handlePartPress(part.id)}
                  />
                )
              }

              return (
                <Path
                  key={`${view}-${part.id}`}
                  d={part.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.5}
                  onPress={() => handlePartPress(part.id)}
                />
              )
            })}
          </G>
        </Svg>
      </View>

      {showLegend ? (
        <View
          style={[
            styles.legend,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.legendTitle, { color: palette.textSecondary }]}>
            Pain level
          </Text>
          <View style={styles.legendRow}>
            <LegendItem color={palette.painMild} label="Mild (1-3)" textColor={palette.textSecondary} />
            <LegendItem color={palette.painModerate} label="Moderate (4-6)" textColor={palette.textSecondary} />
            <LegendItem color={palette.painSevere} label="Severe (7-10)" textColor={palette.textSecondary} />
          </View>
        </View>
      ) : null}

      <PainRatingSheet
        visible={selectedPart !== null}
        partLabel={selectedPart ? PART_LABELS[selectedPart] : ''}
        rating={tempRating}
        onChange={setTempRating}
        onConfirm={confirmRating}
        onRemove={removeRating}
        onClose={() => setSelectedPart(null)}
        canRemove={selectedPart ? value[selectedPart] !== undefined : false}
        accentColor={painSolid(tempRating, palette)}
      />
    </View>
  )
}

function LegendItem({
  color,
  label,
  textColor,
}: {
  color: string
  label: string
  textColor: string
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: textColor }]}>{label}</Text>
    </View>
  )
}

interface PainRatingSheetProps {
  visible: boolean
  partLabel: string
  rating: number
  onChange: (n: number) => void
  onConfirm: () => void
  onRemove: () => void
  onClose: () => void
  canRemove: boolean
  accentColor: string
}

function PainRatingSheet({
  visible,
  partLabel,
  rating,
  onChange,
  onConfirm,
  onRemove,
  onClose,
  canRemove,
  accentColor,
}: PainRatingSheetProps) {
  const { palette } = useTheme()

  if (!visible) return null

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <Animated.View
          entering={FadeIn.duration(motion.duration.quick)}
          exiting={FadeOut.duration(motion.duration.quick)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(motion.duration.base)}
          exiting={SlideOutDown.duration(motion.duration.quick)}
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: palette.borderStrong }]}
          />

          <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
            {partLabel}
          </Text>
          <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
            Rate your pain level (0-10)
          </Text>

          <View style={styles.ratingRow}>
            <Text style={[styles.ratingHint, { color: palette.textTertiary }]}>
              No pain
            </Text>
            <Text style={[styles.ratingValue, { color: accentColor }]}>
              {rating}
            </Text>
            <Text style={[styles.ratingHint, { color: palette.textTertiary }]}>
              Worst pain
            </Text>
          </View>

          <PainSlider
            value={rating}
            onChange={onChange}
            accentColor={accentColor}
          />

          <View style={styles.tickRow}>
            {[0, 2, 4, 6, 8, 10].map(n => (
              <Text
                key={n}
                style={[styles.tick, { color: palette.textTertiary }]}
              >
                {n}
              </Text>
            ))}
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionFlex}>
              <PillButton
                label={canRemove ? 'Remove' : 'Cancel'}
                variant="secondary"
                onPress={canRemove ? onRemove : onClose}
              />
            </View>
            <View style={styles.actionFlex}>
              <PillButton label="Confirm" onPress={onConfirm} />
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

interface PainSliderProps {
  value: number
  onChange: (n: number) => void
  accentColor: string
}

function PainSlider({ value, onChange, accentColor }: PainSliderProps) {
  const { palette } = useTheme()
  const { width } = useWindowDimensions()
  const trackWidth = Math.min(width - 80, 480)
  const thumbSize = 28

  const offset = useSharedValue(((value / 10) * (trackWidth - thumbSize)))

  React.useEffect(() => {
    offset.value = withSpring(
      (value / 10) * (trackWidth - thumbSize),
      motion.spring,
    )
  }, [value, trackWidth, offset])

  const updateValue = (next: number) => {
    if (next !== value) {
      Haptics.selectionAsync()
      onChange(next)
    }
  }

  const pan = Gesture.Pan()
    .onChange(event => {
      const next = Math.min(
        trackWidth - thumbSize,
        Math.max(0, offset.value + event.changeX),
      )
      offset.value = next
      const ratio = next / (trackWidth - thumbSize)
      const rounded = Math.round(ratio * 10)
      runOnJS(updateValue)(rounded)
    })
    .onFinalize(() => {
      const ratio = offset.value / (trackWidth - thumbSize)
      const rounded = Math.round(ratio * 10)
      offset.value = withSpring(
        (rounded / 10) * (trackWidth - thumbSize),
        motion.spring,
      )
    })

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }))
  const fillStyle = useAnimatedStyle(() => ({
    width: offset.value + thumbSize / 2,
  }))

  return (
    <View style={[styles.sliderTrackWrap, { width: trackWidth }]}>
      <View
        style={[
          styles.sliderTrack,
          { backgroundColor: palette.surfaceAlt },
        ]}
      />
      <Animated.View
        style={[
          styles.sliderFill,
          { backgroundColor: accentColor },
          fillStyle,
        ]}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sliderThumb,
            {
              backgroundColor: palette.bgElevated,
              borderColor: accentColor,
            },
            thumbStyle,
          ]}
        />
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  toggleRow: {
    alignItems: 'center',
  },
  toggleTrack: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  toggleLabel: {
    ...typography.smallStrong,
  },
  canvas: {
    aspectRatio: 200 / 420,
    width: '100%',
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    alignSelf: 'center',
    maxHeight: 480,
  },
  legend: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  legendTitle: {
    ...typography.smallStrong,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendLabel: {
    ...typography.small,
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
    borderTopWidth: 1,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  sheetTitle: {
    ...typography.h2,
  },
  sheetSubtitle: {
    ...typography.small,
    marginTop: -spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  ratingHint: {
    ...typography.small,
  },
  ratingValue: {
    ...typography.metric,
    fontSize: 40,
    lineHeight: 44,
  },
  sliderTrackWrap: {
    height: 28,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    height: 6,
    borderRadius: 3,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 12,
    height: 6,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tick: {
    ...typography.caption,
    fontSize: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
})
