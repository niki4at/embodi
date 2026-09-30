import * as Haptics from 'expo-haptics'
import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PillButton } from '@/components/ui/pill-button'
import { Chip, CoachNote, Eyebrow, OptionTile } from '@/components/ui/primitives'
import { QUICK_PAIN_AREAS } from '@/constants/checkin-labels'
import { motion, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export type HurtSeverity = 'twinge' | 'sore' | 'stop'

export type HurtReport = {
  area: string
  areaLabel: string
  severity: HurtSeverity
}

const SEVERITIES: {
  value: HurtSeverity
  label: string
  hint: string
  dot: 'energyDrained' | 'energyLow' | 'danger'
}[] = [
  { value: 'twinge', label: 'Twinge', hint: 'Notice it', dot: 'energyDrained' },
  { value: 'sore', label: 'Sore', hint: 'Working around it', dot: 'energyLow' },
  { value: 'stop', label: 'Stop now', hint: 'Done for today', dot: 'danger' },
]

/**
 * Mid-session "Where does it hurt?" sheet. Pick an area and how bad it is;
 * the coach explains what it will change, then the user accepts (log and
 * adapt) or just notes it and keeps going.
 */
export function HurtSheet({
  visible,
  onClose,
  contextLine,
  exerciseName,
  onAccept,
  onNoteOnly,
}: {
  visible: boolean
  onClose: () => void
  /** "Chest-supported row, set 3. Picked up from this move." */
  contextLine: string
  exerciseName: string | null
  onAccept: (report: HurtReport) => void
  onNoteOnly: (report: HurtReport) => void
}) {
  const { palette } = useTheme()
  const [area, setArea] = useState<string | null>(null)
  const [severity, setSeverity] = useState<HurtSeverity | null>(null)

  useEffect(() => {
    if (!visible) {
      setArea(null)
      setSeverity(null)
    }
  }, [visible])

  const areaLabel = useMemo(
    () => QUICK_PAIN_AREAS.find((a) => a.id === area)?.label ?? '',
    [area],
  )

  const coachPlan = useMemo(() => {
    if (!severity || !area) return null
    const move = exerciseName ? exerciseName.toLowerCase() : 'this move'
    const spot = areaLabel.toLowerCase()
    switch (severity) {
      case 'twinge':
        return `Note the ${spot} twinge, keep ${move} as planned, and check in again after the next set.`
      case 'sore':
        return `Cut the last set of ${move}, swap it for a ${spot}-friendly variation, and add a short ${spot} mobility finisher.`
      case 'stop':
        return `Skip the rest of ${move}, ease off everything that loads the ${spot}, and finish with recovery work only.`
      default: {
        const _exhaustive: never = severity
        return _exhaustive
      }
    }
  }, [severity, area, areaLabel, exerciseName])

  const report: HurtReport | null =
    area && severity ? { area, areaLabel, severity } : null

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Where does it hurt?"
      subtitle={contextLine}
      dismissLabel="cancel"
      footer={
        <>
          <PillButton
            label={
              !severity || severity === 'twinge' ? 'Log it' : 'Accept and continue'
            }
            disabled={!report}
            onPress={() => {
              if (!report) return
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
              onAccept(report)
            }}
          />
          <PillButton
            label="Just note it, keep going"
            variant="secondary"
            disabled={!report}
            onPress={() => {
              if (!report) return
              onNoteOnly(report)
            }}
          />
        </>
      }
    >
      <View style={styles.chips}>
        {QUICK_PAIN_AREAS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={area === option.id}
            onPress={() => setArea(option.id)}
          />
        ))}
      </View>

      <Eyebrow style={styles.eyebrow}>How bad is it</Eyebrow>
      <View style={styles.severityRow}>
        {SEVERITIES.map((option) => (
          <OptionTile
            key={option.value}
            title={option.label}
            subtitle={option.hint}
            centered
            selected={severity === option.value}
            onPress={() => setSeverity(option.value)}
            style={[
              styles.severityTile,
              severity === option.value && {
                backgroundColor: palette.coachMuted,
                borderColor: palette.accent,
              },
            ]}
            trailing={
              <View style={[styles.severityDot, { backgroundColor: palette[option.dot] }]} />
            }
            accessibilityLabel={`${option.label}. ${option.hint}`}
          />
        ))}
      </View>

      {coachPlan ? (
        <Animated.View
          entering={FadeInDown.duration(motion.duration.base)}
          style={styles.coach}
          accessibilityLiveRegion="polite"
        >
          <CoachNote eyebrow="Coach will">{coachPlan}</CoachNote>
        </Animated.View>
      ) : (
        <Text style={[styles.hint, { color: palette.textTertiary }]}>
          Pick a spot and how it feels; the coach tells you what changes.
        </Text>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eyebrow: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  severityTile: {
    flex: 1,
    minHeight: 72,
    paddingTop: 18,
  },
  severityDot: {
    position: 'absolute',
    top: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: 'center',
  },
  coach: {
    marginTop: spacing.xl,
  },
  hint: {
    ...typography.small,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
})
