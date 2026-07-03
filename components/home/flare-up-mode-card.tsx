import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { motion, radius, spacing, typography } from '@/constants/design'
import { FLARE_REGIONS, labelForRegion } from '@/constants/flare-regions'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

const TRACK_WIDTH = 52
const TRACK_PADDING = 3
const KNOB_SIZE = 24
const KNOB_TRAVEL = TRACK_WIDTH - TRACK_PADDING * 2 - KNOB_SIZE

export function FlareUpModeCard() {
  const { palette, resolved } = useTheme()
  const flare = useQuery(api.flareUp.getFlareUp)
  const setFlareUp = useMutation(api.flareUp.setFlareUp)

  const [active, setActive] = useState(false)
  const [regions, setRegions] = useState<string[]>([])
  const hydrated = useRef(false)

  const progress = useSharedValue(0)

  useEffect(() => {
    if (flare && !hydrated.current) {
      setActive(flare.active)
      setRegions(flare.regions)
      progress.value = flare.active ? 1 : 0
      hydrated.current = true
    }
  }, [flare, progress])

  const offColor = resolved === 'dark' ? '#3A3F4D' : '#D9D6CF'

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [offColor, palette.primary]
    ),
  }))

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * KNOB_TRAVEL }],
  }))

  const persist = useCallback(
    (nextActive: boolean, nextRegions: string[]) => {
      setFlareUp({ active: nextActive, regions: nextRegions }).catch((error) => {
        console.error('Failed to save flare-up state:', error)
      })
    },
    [setFlareUp]
  )

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const next = !active
    setActive(next)
    progress.value = withTiming(next ? 1 : 0, { duration: 220 })
    const nextRegions = next ? regions : []
    if (!next) {
      setRegions([])
    }
    persist(next, nextRegions)
  }, [active, regions, persist, progress])

  const handleToggleRegion = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const next = regions.includes(id)
        ? regions.filter((r) => r !== id)
        : [...regions, id]
      setRegions(next)
      persist(active, next)
    },
    [regions, active, persist]
  )

  if (flare === undefined) {
    return null
  }

  const subtitle =
    active && regions.length > 0
      ? `Easing off ${regions.map(labelForRegion).join(', ').toLowerCase()}`
      : active
        ? "Tap where it's flaring"
        : 'Adapt sessions around a flare-up'

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <View style={styles.toggleRow}>
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              Flare-up mode
            </Text>
            <Text
              style={[styles.subtitle, { color: palette.textTertiary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <Pressable
            onPress={handleToggle}
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: active }}
            accessibilityLabel="Toggle flare-up mode"
          >
            <Animated.View style={[styles.track, trackStyle]}>
              <Animated.View
                style={[
                  styles.knob,
                  { backgroundColor: palette.white },
                  knobStyle,
                ]}
              />
            </Animated.View>
          </Pressable>
        </View>

        {active && (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base)}
            style={[styles.picker, { borderTopColor: palette.border }]}
          >
            <Text style={[styles.pickerTitle, { color: palette.textPrimary }]}>
              Where&apos;s it flaring?
            </Text>
            <View style={styles.chips}>
              {FLARE_REGIONS.map((region) => {
                const selected = regions.includes(region.id)
                return (
                  <TouchableOpacity
                    key={region.id}
                    onPress={() => handleToggleRegion(region.id)}
                    activeOpacity={0.85}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? palette.dangerMuted
                          : palette.surfaceAlt,
                        borderColor: selected ? palette.danger : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        {
                          color: selected
                            ? palette.danger
                            : palette.textSecondary,
                        },
                      ]}
                    >
                      {region.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {regions.length > 0 && (
              <Animated.View
                entering={FadeInDown.duration(motion.duration.base)}
                style={[styles.banner, { backgroundColor: palette.dangerMuted }]}
              >
                <Text style={[styles.bannerText, { color: palette.danger }]}>
                  Got it. We&apos;ll ease off{' '}
                  {regions.map(labelForRegion).join(', ').toLowerCase()} today and
                  steer around related moves.
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.bodyStrong,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  track: {
    width: TRACK_WIDTH,
    height: KNOB_SIZE + TRACK_PADDING * 2,
    borderRadius: radius.pill,
    padding: TRACK_PADDING,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  picker: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  pickerTitle: {
    ...typography.smallStrong,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    ...typography.smallStrong,
  },
  banner: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bannerText: {
    ...typography.small,
    lineHeight: 20,
  },
})
