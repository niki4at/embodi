import { useMutation } from 'convex/react'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { updateTrainingPreferences } from './api'
import { SectionShell } from './section-shell'
import type {
  SocialLocationSharing,
  TrainingPreferences,
} from './types'

interface SuggestionsSectionProps {
  preferences: TrainingPreferences | null
}

export function SuggestionsSection({
  preferences,
}: SuggestionsSectionProps) {
  const { palette } = useTheme()
  const updatePreferences = useMutation(updateTrainingPreferences)
  const [savingField, setSavingField] = useState<
    'location' | 'sharing' | 'reset' | null
  >(null)

  const locationEnabled = preferences?.locationEnabled ?? false
  const sharing = preferences?.socialLocationSharing ?? 'private'

  const updateLocation = async (next: boolean) => {
    setSavingField('location')
    try {
      await updatePreferences({ locationEnabled: next })
    } catch (error) {
      console.error('Location preference update failed', error)
      Alert.alert('Could not save preference', 'Try again in a moment.')
    } finally {
      setSavingField(null)
    }
  }

  const updateSharing = async (next: boolean) => {
    const socialLocationSharing: SocialLocationSharing = next
      ? 'generic'
      : 'private'
    setSavingField('sharing')
    try {
      await updatePreferences({ socialLocationSharing })
    } catch (error) {
      console.error('Sharing preference update failed', error)
      Alert.alert('Could not save preference', 'Try again in a moment.')
    } finally {
      setSavingField(null)
    }
  }

  const confirmReset = () => {
    Alert.alert(
      'Reset learned patterns?',
      'Embodi will forget recent Home and Gym corrections. Your equipment, places, and weekly rhythm stay saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSavingField('reset')
            void updatePreferences({ resetLearnedPatterns: true })
              .catch((error) => {
                console.error('Training pattern reset failed', error)
                Alert.alert('Could not reset patterns', 'Try again in a moment.')
              })
              .finally(() => setSavingField(null))
          },
        },
      ],
    )
  }

  return (
    <SectionShell
      icon="sparkles"
      title="Suggestions & privacy"
      description="Control which signals Embodi can use and what appears when you share."
    >
      <PreferenceRow
        icon="target"
        title="Location suggestions"
        description="Check saved places in the foreground. No background tracking."
        value={locationEnabled}
        loading={savingField === 'location'}
        onValueChange={(next) => void updateLocation(next)}
      />
      <PreferenceRow
        icon="globe"
        title="Share generic place"
        description="Allow Home, Gym, or Outdoors on shared workouts. Place names and coordinates stay private."
        value={sharing === 'generic'}
        loading={savingField === 'sharing'}
        onValueChange={(next) => void updateSharing(next)}
      />
      <Pressable
        onPress={confirmReset}
        disabled={savingField !== null}
        accessibilityRole="button"
        accessibilityLabel="Reset learned training patterns"
        accessibilityState={{ busy: savingField === 'reset' }}
        style={({ pressed }) => [
          styles.resetRow,
          {
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.border,
            opacity: savingField !== null ? 0.55 : pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: palette.warningMuted }]}>
          <IconSymbol name="arrow.clockwise" size={19} color={palette.warning} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
            Reset learned patterns
          </Text>
          <Text style={[styles.rowDescription, { color: palette.textSecondary }]}>
            Clear recent corrections without deleting your setup.
          </Text>
        </View>
        {savingField === 'reset' ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <IconSymbol name="chevron.right" size={18} color={palette.textTertiary} />
        )}
      </Pressable>

      <View style={[styles.privacyCard, { backgroundColor: palette.primaryMuted }]}>
        <IconSymbol name="lock.fill" size={17} color={palette.primary} />
        <Text style={[styles.privacyText, { color: palette.textSecondary }]}>
          Equipment photos remain private. Training history stores generic context,
          never an exact location trail.
        </Text>
      </View>
    </SectionShell>
  )

  function PreferenceRow({
    icon,
    title,
    description,
    value,
    loading,
    onValueChange,
  }: {
    icon: React.ComponentProps<typeof IconSymbol>['name']
    title: string
    description: string
    value: boolean
    loading: boolean
    onValueChange: (next: boolean) => void
  }) {
    return (
      <View
        style={[
          styles.preferenceRow,
          { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: palette.primaryMuted }]}>
          <IconSymbol name={icon} size={19} color={palette.primary} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>{title}</Text>
          <Text style={[styles.rowDescription, { color: palette.textSecondary }]}>
            {description}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <Switch
            value={value}
            onValueChange={onValueChange}
            accessibilityLabel={title}
            trackColor={{ false: palette.surfaceHigh, true: palette.primary }}
            thumbColor={palette.white}
          />
        )}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  preferenceRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  resetRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyStrong },
  rowDescription: { ...typography.small, marginTop: spacing.xs },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  privacyText: { ...typography.small, flex: 1 },
})
