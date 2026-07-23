import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import {
  EQUIPMENT_INTENT_LABELS,
  TRAINING_ENVIRONMENT_LABELS,
  type TrainingContextSelection,
} from '@/components/training-context'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import type { CyclePhase } from '@/convex/cycle'

import { FlareUpModeCard } from './flare-up-mode-card'

const CYCLE_PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  unknown: 'Tracking',
}

export interface TodayContextProps {
  checkin: {
    energyLevel: number
    painLevel: number
    timeAvailable: string
  } | null
  context: TrainingContextSelection
  cycle: {
    enabled: boolean
    hasData: boolean
    phase: CyclePhase
    dayOfCycle: number | null
  } | null
  onUpdateCheckin: () => void
  onEditContext: () => void
  onOpenCycle: () => void
}

/**
 * "Today's context" strip: everything that shapes today's session (check-in,
 * training place and equipment, cycle phase, flare-up mode) in one compact
 * block under the start experience.
 */
export function TodayContext({
  checkin,
  context,
  cycle,
  onUpdateCheckin,
  onEditContext,
  onOpenCycle,
}: TodayContextProps) {
  const { palette } = useTheme()

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: palette.textTertiary }]}>
        TODAY&apos;S CONTEXT
      </Text>

      {checkin ? (
        <ContextRow
          icon="checkmark"
          iconColor={palette.success}
          text={`Check-in · Energy ${checkin.energyLevel}/10 · Pain ${checkin.painLevel}/10 · ${checkin.timeAvailable}m`}
          actionLabel="Update"
          onPress={() => {
            Haptics.selectionAsync()
            onUpdateCheckin()
          }}
        />
      ) : null}

      <ContextRow
        icon="sparkles"
        iconColor={palette.primary}
        text={`${TRAINING_ENVIRONMENT_LABELS[context.trainingEnvironment]} · ${EQUIPMENT_INTENT_LABELS[context.equipmentIntent]}`}
        actionLabel="Change"
        onPress={() => {
          Haptics.selectionAsync()
          onEditContext()
        }}
      />

      {cycle?.enabled ? (
        <ContextRow
          icon="drop.fill"
          iconColor={palette.primary}
          text={
            cycle.hasData
              ? `Cycle · ${CYCLE_PHASE_LABEL[cycle.phase]}${cycle.dayOfCycle && cycle.phase !== 'unknown' ? ` · day ${cycle.dayOfCycle}` : ''}`
              : 'Cycle · Log your first period to start'
          }
          actionLabel={cycle.hasData ? 'Open' : 'Log'}
          onPress={() => {
            Haptics.selectionAsync()
            onOpenCycle()
          }}
        />
      ) : null}

      <FlareUpModeCard />
    </View>
  )
}

interface ContextRowProps {
  icon: React.ComponentProps<typeof IconSymbol>['name']
  iconColor: string
  text: string
  actionLabel: string
  onPress: () => void
}

function ContextRow({
  icon,
  iconColor,
  text,
  actionLabel,
  onPress,
}: ContextRowProps) {
  const { palette } = useTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${text}. ${actionLabel}.`}
      style={[
        styles.row,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <IconSymbol name={icon} size={14} color={iconColor} />
      <Text
        style={[styles.rowText, { color: palette.textSecondary }]}
        numberOfLines={1}
      >
        {text}
      </Text>
      <Text style={[styles.rowAction, { color: palette.primary }]}>
        {actionLabel}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowText: {
    ...typography.small,
    flex: 1,
  },
  rowAction: {
    ...typography.smallStrong,
  },
})
