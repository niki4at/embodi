import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PillButton } from '@/components/ui/pill-button'
import { Chip, Eyebrow, OptionTile } from '@/components/ui/primitives'
import {
  ENERGY_OPTIONS,
  energyBucketFromLevel,
  painAreaLabel,
  painDot,
  type EnergyBucket,
  type TimeAvailable,
} from '@/constants/checkin-labels'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type Checkin = {
  energyLevel: number
  painLevel: number
  painAreas?: string[]
  painRatings?: { area: string; level: number }[]
  timeAvailable: string
}

const TIME_CHOICES: { value: TimeAvailable; hint: string }[] = [
  { value: '20', hint: 'Short' },
  { value: '30', hint: 'Trimmed' },
  { value: '45', hint: 'As planned' },
]

/**
 * "Adjust for today" sheet. A light retune of energy, pain, and time on top
 * of today's check-in; the full check-in stays one tap away. Retuning edits
 * the planned moves in place (sets, reps, rest, skips); it never adds new
 * ones.
 */
export function AdjustSheet({
  visible,
  onClose,
  checkin,
  planCount,
  onFullAdjustment,
  onEditBodyMap,
  onRetuned,
}: {
  visible: boolean
  onClose: () => void
  checkin: Checkin | null
  planCount: number
  onFullAdjustment: () => void
  onEditBodyMap: () => void
  onRetuned: (result: {
    sessionId: Id<'workout_sessions'> | null
    retuned: boolean
    note: string
  }) => void
}) {
  const { palette } = useTheme()
  const retune = useMutation(api.checkin.retuneTodaysSession)
  const [energy, setEnergy] = useState<EnergyBucket | null>(null)
  const [time, setTime] = useState<TimeAvailable | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!visible) return
    setEnergy(checkin ? energyBucketFromLevel(checkin.energyLevel) : null)
    const current = checkin?.timeAvailable as TimeAvailable | undefined
    setTime(
      current && TIME_CHOICES.some((c) => c.value === current) ? current : null,
    )
  }, [visible, checkin])

  const painSpots = useMemo(() => {
    if (!checkin) return []
    if (checkin.painRatings && checkin.painRatings.length > 0) {
      return checkin.painRatings
    }
    return (checkin.painAreas ?? []).map((area) => ({
      area,
      level: checkin.painLevel,
    }))
  }, [checkin])

  const dirty =
    (energy !== null &&
      checkin !== null &&
      energy !== energyBucketFromLevel(checkin.energyLevel)) ||
    (time !== null && checkin !== null && time !== checkin.timeAvailable)

  const handleRetune = async () => {
    if (busy) return
    setBusy(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const level = ENERGY_OPTIONS.find((o) => o.value === energy)?.level
      const result = await retune({
        energyLevel: level,
        timeAvailable: time ?? undefined,
      })
      onRetuned(result)
    } catch (error) {
      console.error('Failed to retune session', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setBusy(false)
    }
  }

  const subtitle = !checkin
    ? 'No check-in yet today. Do the full check-in so the coach can build around you.'
    : planCount > 0
      ? `The coach retunes your ${planCount} planned moves. It won't add new ones.`
      : 'Saved to today\u2019s check-in and used for the next session you build.'

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Adjust for today"
      subtitle={subtitle}
      footer={
        checkin ? (
          <PillButton
            label={busy ? 'Retuning' : planCount > 0 ? 'Retune workout' : 'Save for today'}
            onPress={handleRetune}
            loading={busy}
            disabled={!dirty}
          />
        ) : (
          <PillButton label="Start check-in" onPress={onFullAdjustment} />
        )
      }
    >
      <Chip
        label="Full adjustment"
        onPress={onFullAdjustment}
        style={styles.fullChip}
        accessibilityLabel="Full adjustment. Opens the complete check-in."
      />

      <Eyebrow style={styles.eyebrow}>Energy</Eyebrow>
      <View style={styles.energyRow}>
        {ENERGY_OPTIONS.map((option) => (
          <OptionTile
            key={option.value}
            title={option.label}
            selected={energy === option.value}
            onPress={() => setEnergy(option.value)}
            centered
            dot={palette[option.dot]}
            style={styles.energyTile}
            accessibilityLabel={`${option.label} energy. ${option.hint}`}
          />
        ))}
      </View>

      <Eyebrow style={styles.eyebrow}>Pain</Eyebrow>
      <View style={styles.painRow}>
        {painSpots.length === 0 ? (
          <Text style={[styles.painEmpty, { color: palette.textSecondary }]}>
            Nothing logged today
          </Text>
        ) : (
          painSpots.map((spot) => (
            <Chip
              key={spot.area}
              label={painAreaLabel(spot.area)}
              onPress={onEditBodyMap}
              accessibilityLabel={`${painAreaLabel(spot.area)}, pain ${spot.level} of 10. Edit on body map.`}
              leading={
                <View
                  style={[styles.painBadge, { backgroundColor: painDot(spot.level, palette) }]}
                >
                  <Text style={styles.painBadgeText}>{spot.level}</Text>
                </View>
              }
              style={[styles.painChip, { backgroundColor: palette.primaryMuted, borderColor: palette.primary }]}
            />
          ))
        )}
        <Chip label="Edit on body map" dashed onPress={onEditBodyMap} />
      </View>

      <Eyebrow style={styles.eyebrow}>Time</Eyebrow>
      <View style={styles.timeRow}>
        {TIME_CHOICES.map((choice) => (
          <OptionTile
            key={choice.value}
            title={`${choice.value} min`}
            subtitle={choice.hint}
            selected={time === choice.value}
            onPress={() => setTime(choice.value)}
            centered
            style={styles.timeTile}
          />
        ))}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  fullChip: {
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  eyebrow: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  energyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  energyTile: {
    flex: 1,
    minHeight: 64,
    paddingHorizontal: 2,
  },
  painRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  painEmpty: {
    ...typography.small,
    marginRight: spacing.sm,
  },
  painChip: {
    paddingLeft: 6,
  },
  painBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painBadgeText: {
    ...typography.smallStrong,
    fontSize: 12,
    color: '#0B0B0D',
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeTile: {
    flex: 1,
    minHeight: 64,
  },
})
