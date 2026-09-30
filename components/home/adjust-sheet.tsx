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
  timeAvailable: string
}

const TIME_CHOICES: { value: TimeAvailable; hint: string }[] = [
  { value: '20', hint: 'Short' },
  { value: '30', hint: 'Trimmed' },
  { value: '45', hint: 'As planned' },
]

/**
 * "Adjust for today" sheet. A light retune of energy, pain, and time on top
 * of today's check-in; the full check-in stays one tap away. Retuning a
 * not-yet-started session rebuilds it from the updated check-in.
 */
export function AdjustSheet({
  visible,
  onClose,
  checkin,
  planCount,
  sessionStarted,
  onFullAdjustment,
  onEditBodyMap,
  onRetuned,
}: {
  visible: boolean
  onClose: () => void
  checkin: Checkin | null
  planCount: number
  sessionStarted: boolean
  onFullAdjustment: () => void
  onEditBodyMap: () => void
  onRetuned: (sessionId: Id<'workout_sessions'> | null, regenerated: boolean) => void
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

  const painAreas = useMemo(() => checkin?.painAreas ?? [], [checkin])

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
      onRetuned(result.sessionId, result.regenerated)
    } catch (error) {
      console.error('Failed to retune session', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setBusy(false)
    }
  }

  const subtitle = !checkin
    ? 'No check-in yet today. Do the full check-in so the coach can build around you.'
    : sessionStarted
      ? "Your session is already under way, so these changes shape the next one you build today."
      : planCount > 0
        ? `The coach retunes your ${planCount} planned moves. It won't add new ones.`
        : 'The coach rebuilds today around what you change here.'

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Adjust for today"
      subtitle={subtitle}
      footer={
        checkin ? (
          <PillButton
            label={
              busy ? 'Retuning' : sessionStarted ? 'Save for next session' : 'Retune workout'
            }
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
        {painAreas.length === 0 ? (
          <Text style={[styles.painEmpty, { color: palette.textSecondary }]}>
            Nothing logged today
          </Text>
        ) : (
          painAreas.map((area) => (
            <Chip
              key={area}
              label={painAreaLabel(area)}
              onPress={onEditBodyMap}
              leading={
                <View
                  style={[
                    styles.painBadge,
                    { backgroundColor: painDot(checkin?.painLevel ?? 0, palette) },
                  ]}
                >
                  <Text style={styles.painBadgeText}>{checkin?.painLevel ?? 0}</Text>
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
    paddingHorizontal: 4,
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
