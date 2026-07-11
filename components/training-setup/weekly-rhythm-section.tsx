import { useMutation } from 'convex/react'
import React, { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { updateTrainingPreferences } from './api'
import { SectionShell } from './section-shell'
import {
  WEEKDAYS,
  type DayRhythm,
  type EquipmentIntent,
  type TrainingEnvironment,
} from './types'

interface WeeklyRhythmSectionProps {
  value: DayRhythm[]
}

function defaultRhythm(): DayRhythm[] {
  return WEEKDAYS.map(({ key }) => ({
    day: key,
    defaultEnvironment: 'home',
    defaultEquipmentIntent: 'available',
  }))
}

export function WeeklyRhythmSection({ value }: WeeklyRhythmSectionProps) {
  const { palette } = useTheme()
  const updatePreferences = useMutation(updateTrainingPreferences)
  const [rhythm, setRhythm] = useState<DayRhythm[]>(
    value.length ? value : defaultRhythm(),
  )
  const [expandedDay, setExpandedDay] = useState<DayRhythm['day'] | null>(null)

  useEffect(() => {
    if (value.length) setRhythm(value)
  }, [value])

  const persist = async (next: DayRhythm[]) => {
    const previous = rhythm
    setRhythm(next)
    try {
      await updatePreferences({ weeklyRhythm: next })
    } catch (error) {
      console.error('Weekly rhythm update failed', error)
      setRhythm(previous)
      Alert.alert('Could not save weekly rhythm', 'Try again in a moment.')
    }
  }

  const updateDay = (
    day: DayRhythm['day'],
    field: 'defaultEnvironment' | 'morning' | 'evening',
    environment: TrainingEnvironment | undefined,
  ) => {
    const next = rhythm.map((entry) =>
      entry.day === day ? { ...entry, [field]: environment } : entry,
    )
    void persist(next)
  }
  const updateIntent = (
    day: DayRhythm['day'],
    field:
      | 'defaultEquipmentIntent'
      | 'morningEquipmentIntent'
      | 'eveningEquipmentIntent',
    intent: EquipmentIntent | undefined,
  ) => {
    const next = rhythm.map((entry) =>
      entry.day === day ? { ...entry, [field]: intent } : entry,
    )
    void persist(next)
  }

  return (
    <SectionShell
      icon="calendar"
      title="Weekly rhythm"
      description="Set a default place for each day, then add morning or evening exceptions when useful."
    >
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: palette.textSecondary }]}>
          Defaults
        </Text>
        <Text style={[styles.legendHint, { color: palette.textTertiary }]}>
          Tap a day for time options
        </Text>
      </View>

      {WEEKDAYS.map(({ key, short, label }) => {
        const entry =
          rhythm.find((candidate) => candidate.day === key) ??
          ({
            day: key,
            defaultEnvironment: 'home',
            defaultEquipmentIntent: 'available',
          } satisfies DayRhythm)
        const expanded = expandedDay === key
        return (
          <View
            key={key}
            style={[
              styles.dayCard,
              { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
            ]}
          >
            <View style={styles.dayTop}>
              <Pressable
                onPress={() => setExpandedDay(expanded ? null : key)}
                accessibilityRole="button"
                accessibilityLabel={`${label} time options`}
                accessibilityState={{ expanded }}
                style={styles.dayLabelButton}
              >
                <View
                  style={[styles.dayBadge, { backgroundColor: palette.primaryMuted }]}
                >
                  <Text style={[styles.dayShort, { color: palette.primary }]}>
                    {short}
                  </Text>
                </View>
                <IconSymbol
                  name={expanded ? 'chevron.up' : 'chevron.down'}
                  size={18}
                  color={palette.textTertiary}
                />
              </Pressable>
              <EnvironmentToggle
                value={entry.defaultEnvironment}
                label={`${label} default`}
                onChange={(environment) =>
                  updateDay(key, 'defaultEnvironment', environment)
                }
              />
            </View>
            <View
              style={[
                styles.defaultIntentRow,
                { borderTopColor: palette.border },
              ]}
            >
              <Text
                style={[styles.timeLabel, { color: palette.textSecondary }]}
              >
                Equipment
              </Text>
              <IntentToggle
                value={entry.defaultEquipmentIntent}
                label={`${label} default equipment`}
                onChange={(intent) =>
                  updateIntent(key, 'defaultEquipmentIntent', intent)
                }
              />
            </View>

            {expanded ? (
              <View style={[styles.exceptions, { borderTopColor: palette.border }]}>
                <TimeRow
                  label="Morning"
                  value={entry.morning}
                  intent={entry.morningEquipmentIntent}
                  onChange={(environment) =>
                    updateDay(key, 'morning', environment)
                  }
                  onIntentChange={(intent) =>
                    updateIntent(key, 'morningEquipmentIntent', intent)
                  }
                  onClear={() => updateDay(key, 'morning', undefined)}
                  onIntentClear={() =>
                    updateIntent(key, 'morningEquipmentIntent', undefined)
                  }
                />
                <TimeRow
                  label="Evening"
                  value={entry.evening}
                  intent={entry.eveningEquipmentIntent}
                  onChange={(environment) =>
                    updateDay(key, 'evening', environment)
                  }
                  onIntentChange={(intent) =>
                    updateIntent(key, 'eveningEquipmentIntent', intent)
                  }
                  onClear={() => updateDay(key, 'evening', undefined)}
                  onIntentClear={() =>
                    updateIntent(key, 'eveningEquipmentIntent', undefined)
                  }
                />
              </View>
            ) : null}
          </View>
        )
      })}
    </SectionShell>
  )

  function TimeRow({
    label,
    value: timeValue,
    intent,
    onChange,
    onIntentChange,
    onClear,
    onIntentClear,
  }: {
    label: string
    value?: TrainingEnvironment
    intent?: EquipmentIntent
    onChange: (environment: TrainingEnvironment) => void
    onIntentChange: (intent: EquipmentIntent) => void
    onClear: () => void
    onIntentClear: () => void
  }) {
    return (
      <View style={styles.timeRow}>
        <View style={styles.timeHeading}>
          <Text style={[styles.timeLabel, { color: palette.textSecondary }]}>
            {label}
          </Text>
          {timeValue || intent ? (
            <Pressable
              onPress={() => {
                onClear()
                onIntentClear()
              }}
              accessibilityRole="button"
              accessibilityLabel={`Use day default for ${label.toLowerCase()}`}
            >
              <Text style={[styles.clearText, { color: palette.primary }]}>
                Use default
              </Text>
            </Pressable>
          ) : null}
        </View>
        <EnvironmentToggle
          value={timeValue}
          label={label}
          onChange={onChange}
          optional
        />
        <IntentToggle
          value={intent}
          label={`${label} equipment`}
          onChange={onIntentChange}
          optional
        />
      </View>
    )
  }

  function EnvironmentToggle({
    value: environmentValue,
    label,
    onChange,
    optional = false,
  }: {
    value?: TrainingEnvironment
    label: string
    onChange: (environment: TrainingEnvironment) => void
    optional?: boolean
  }) {
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.segment, { backgroundColor: palette.surface }]}
      >
        {(['home', 'gym'] as const).map((environment) => {
          const selected = environmentValue === environment
          return (
            <Pressable
              key={environment}
              onPress={() => onChange(environment)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label}: ${environment}`}
              style={[
                styles.segmentOption,
                selected && { backgroundColor: palette.primary },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: selected
                      ? palette.white
                      : optional && !environmentValue
                        ? palette.textTertiary
                        : palette.textSecondary,
                  },
                ]}
              >
                {environment === 'home' ? 'Home' : 'Gym'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  function IntentToggle({
    value,
    label,
    onChange,
    optional = false,
  }: {
    value?: EquipmentIntent
    label: string
    onChange: (intent: EquipmentIntent) => void
    optional?: boolean
  }) {
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.intentSegment, { backgroundColor: palette.surface }]}
      >
        {(['available', 'bodyweight', 'treadmill'] as const).map((intent) => {
          const selected = value === intent
          return (
            <Pressable
              key={intent}
              onPress={() => onChange(intent)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[
                styles.segmentOption,
                selected && { backgroundColor: palette.primary },
              ]}
            >
              <Text
                style={[
                  styles.intentText,
                  {
                    color: selected
                      ? palette.white
                      : optional && !value
                        ? palette.textTertiary
                        : palette.textSecondary,
                  },
                ]}
              >
                {intent === 'available'
                  ? 'Gear'
                  : intent === 'bodyweight'
                    ? 'Body'
                    : 'Tread'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendText: { ...typography.smallStrong },
  legendHint: { ...typography.small },
  dayCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  dayTop: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  dayLabelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayBadge: {
    minWidth: 44,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayShort: { ...typography.smallStrong },
  segment: {
    width: 142,
    minHeight: 38,
    borderRadius: radius.sm,
    flexDirection: 'row',
    padding: 3,
  },
  segmentOption: {
    flex: 1,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { ...typography.smallStrong },
  intentSegment: {
    width: 210,
    minHeight: 38,
    borderRadius: radius.sm,
    flexDirection: 'row',
    padding: 3,
  },
  intentText: {
    ...typography.caption,
    fontSize: 10,
  },
  defaultIntentRow: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exceptions: {
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  timeRow: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timeHeading: { flex: 1 },
  timeLabel: { ...typography.smallStrong },
  clearText: { ...typography.small, marginTop: spacing.xs },
})
