import { useUser } from '@clerk/clerk-expo'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

import { Avatar } from '@/components/social/avatar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

import { usePreferences } from '@/constants/preferences-context'

import { AccountSection } from './account-section'
import { ComingSoonCard } from './coming-soon-card'
import { DataSection } from './data-section'
import {
  SettingsDivider,
  SettingsRow,
  SettingsSectionLabel,
  SettingsSwitchRow,
} from './settings-row'
import { ThemeRow } from './theme-row'
import { UnitsRow } from './units-row'

interface SettingsPanelProps {
  /** Extra bottom padding so a floating tab bar never covers the last row. */
  bottomInset?: number
}

/**
 * Canonical Settings index, grouped by intent: coaching context, training,
 * social & privacy, app preferences, and account.
 */
export function SettingsPanel({
  bottomInset = spacing.xxxl,
}: SettingsPanelProps) {
  const { palette } = useTheme()
  const { user } = useUser()
  const { reduceMotion, setReduceMotion } = usePreferences()
  const onboarding = useQuery(api.onboarding.getOnboarding)
  const socialProfile = useQuery(api.profiles.getMyProfile)
  const setTrackPeriod = useMutation(api.onboarding.setTrackPeriod)
  const [isTogglingCycle, setIsTogglingCycle] = useState(false)

  const cycleEligible =
    onboarding?.gender === 'female' || onboarding?.gender === 'prefer-not-to-say'
  const trackPeriodOn = onboarding?.trackPeriod === true

  const handleToggleCycleTracking = useCallback(
    async (next: boolean) => {
      if (isTogglingCycle) return
      setIsTogglingCycle(true)
      try {
        await Haptics.selectionAsync()
        await setTrackPeriod({ trackPeriod: next })
      } catch (err) {
        console.error('Failed to toggle cycle tracking', err)
        Alert.alert('Could not save', 'Try again in a moment.')
      } finally {
        setIsTogglingCycle(false)
      }
    },
    [isTogglingCycle, setTrackPeriod],
  )

  const navigate = useCallback((path: string) => {
    Haptics.selectionAsync()
    router.push(path as never)
  }, [])

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    email ||
    'Account'

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => navigate('/social/edit-profile')}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        style={({ pressed }) => [
          styles.profileCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {socialProfile ? (
          <Avatar
            url={socialProfile.avatarUrl}
            name={socialProfile.displayName}
            size={52}
          />
        ) : (
          <View
            style={[styles.avatar, { backgroundColor: palette.primaryMuted }]}
          >
            <IconSymbol name="person.fill" size={26} color={palette.primary} />
          </View>
        )}
        <View style={styles.profileText}>
          <Text
            style={[styles.profileName, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {socialProfile?.displayName || displayName}
          </Text>
          <Text
            style={[styles.profileEmail, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {socialProfile ? `@${socialProfile.username}` : (email ?? '')}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={palette.textTertiary} />
      </Pressable>

      <SettingsSectionLabel title="You & coaching" />
      <SettingsRow
        icon="heart.text.square"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Health & coaching"
        subtitle="What your coach knows about your body and goals"
        onPress={() => navigate('/health-context')}
      />
      {cycleEligible ? (
        <>
          <SettingsDivider />
          <CycleToggleRow
            value={trackPeriodOn}
            loading={isTogglingCycle}
            onValueChange={handleToggleCycleTracking}
          />
          {trackPeriodOn ? (
            <View style={{ marginTop: spacing.sm }}>
              <SettingsRow
                icon="drop.fill"
                iconTint={palette.primary}
                iconBg={palette.primaryMuted}
                title="Open cycle log"
                subtitle="Log periods and review recent cycles"
                onPress={() => navigate('/cycle')}
              />
            </View>
          ) : null}
        </>
      ) : null}
      <SettingsDivider />

      <SettingsSectionLabel title="Training" />
      <SettingsRow
        icon="dumbbell.fill"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Training setup"
        subtitle="Home equipment, places, weekly rhythm, and privacy"
        onPress={() => navigate('/training-setup')}
      />
      <SettingsDivider />
      <SettingsRow
        icon="clock.arrow.circlepath"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Past workouts"
        subtitle={'Review every session you\u2019ve logged'}
        onPress={() => navigate('/history')}
      />
      <SettingsDivider />

      <SettingsSectionLabel title="Social & privacy" />
      <SettingsRow
        icon="person.crop.circle"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Edit profile"
        subtitle="Photo, handle, bio, and privacy"
        onPress={() => navigate('/social/edit-profile')}
      />
      <SettingsDivider />
      <SettingsRow
        icon="eye"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Privacy"
        subtitle="Public profile sections, post audience, and preview"
        onPress={() => navigate('/privacy-settings')}
      />
      <SettingsDivider />
      <SettingsRow
        icon="bell.fill"
        iconTint={palette.warning}
        iconBg={palette.warningMuted}
        title="Notifications"
        subtitle="Choose which social activity reaches you"
        onPress={() => navigate('/notification-settings')}
      />
      <SettingsDivider />
      <SettingsRow
        icon="person.crop.circle.badge.xmark"
        iconTint={palette.textPrimary}
        iconBg={palette.surfaceAlt}
        title="Blocked people"
        subtitle="Manage who can't see or reach you"
        onPress={() => navigate('/social/blocked')}
      />
      <SettingsDivider />

      <SettingsSectionLabel title="App" />
      <ThemeRow />
      <SettingsDivider />
      <UnitsRow />
      <SettingsDivider />
      <SettingsSwitchRow
        icon="figure.walk"
        iconTint={palette.textPrimary}
        iconBg={palette.surfaceAlt}
        title="Reduce motion"
        subtitle="Minimise animations in this app"
        value={reduceMotion}
        onValueChange={(value) => {
          Haptics.selectionAsync()
          setReduceMotion(value)
        }}
      />
      <SettingsDivider />
      <SettingsRow
        icon="textformat.size"
        iconTint={palette.textPrimary}
        iconBg={palette.surfaceAlt}
        title="Text size"
        subtitle="Embodi follows your device text size. Adjust it in system settings."
        onPress={() => {
          Haptics.selectionAsync()
          Linking.openSettings().catch(() => {})
        }}
      />
      <SettingsDivider />
      <ComingSoonCard />
      <SettingsDivider />

      <DataSection />
      <SettingsDivider />

      <AccountSection />
    </ScrollView>
  )
}

interface CycleToggleRowProps {
  value: boolean
  loading: boolean
  onValueChange: (next: boolean) => void
}

function CycleToggleRow({ value, loading, onValueChange }: CycleToggleRowProps) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: palette.primaryMuted }]}>
        <IconSymbol name="drop.fill" size={18} color={palette.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
          Track menstrual cycle
        </Text>
        <Text
          style={[styles.rowSubtitle, { color: palette.textSecondary }]}
          numberOfLines={2}
        >
          Sessions adapt to your phase. You can turn this off any time.
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={palette.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: palette.surfaceAlt, true: palette.primary }}
          thumbColor={palette.white}
          ios_backgroundColor={palette.surfaceAlt}
          accessibilityLabel="Track menstrual cycle"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    ...typography.bodyStrong,
    marginBottom: 2,
  },
  profileEmail: {
    ...typography.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.bodyStrong,
    marginBottom: 2,
  },
  rowSubtitle: {
    ...typography.small,
  },
})
