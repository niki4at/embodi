import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  SettingsDivider,
  SettingsRow,
  SettingsSectionLabel,
  SettingsSwitchRow,
} from '@/components/settings/settings-row'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

type VisibilityKey =
  | 'publicActivity'
  | 'publicHeatmap'
  | 'publicAchievements'
  | 'publicChallenges'
  | 'publicRoutines'

const SECTION_ROWS: {
  key: VisibilityKey
  title: string
  subtitle: string
}[] = [
  {
    key: 'publicActivity',
    title: 'Weekly activity',
    subtitle: 'Workouts this week and streak on your public profile',
  },
  {
    key: 'publicHeatmap',
    title: 'Activity heatmap',
    subtitle: 'Your monthly training calendar',
  },
  {
    key: 'publicAchievements',
    title: 'Achievements',
    subtitle: 'Earned milestones and badges',
  },
  {
    key: 'publicChallenges',
    title: 'Challenge progress',
    subtitle: 'Personal and community challenge status',
  },
  {
    key: 'publicRoutines',
    title: 'Shared routines',
    subtitle: 'Routines you explicitly share to your profile',
  },
]

const AUDIENCES = [
  { value: 'public', label: 'Public' },
  { value: 'backers', label: 'Backers' },
  { value: 'private', label: 'Private' },
] as const

export default function PrivacySettingsScreen() {
  const { palette } = useTheme()
  const settings = useQuery(api.userSettings.get)
  const updateSettings = useMutation(api.userSettings.update)
  const myProfile = useQuery(api.profiles.getMyProfile)
  const trainingPreferences = useQuery(api.trainingPreferences.get)
  const updatePreferences = useMutation(api.trainingPreferences.update)

  const sharingDefault = trainingPreferences?.sharingDefault ?? 'private'

  const toggle = (key: VisibilityKey, value: boolean) => {
    void Haptics.selectionAsync()
    updateSettings({ [key]: value }).catch(() => {})
  }

  const setAudience = (value: 'public' | 'backers' | 'private') => {
    void Haptics.selectionAsync()
    updatePreferences({ sharingDefault: value }).catch(() => {})
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol name="arrow.left" size={22} color={palette.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
          Privacy
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {settings === undefined ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SettingsSectionLabel title="Public profile sections" />
          <Text style={[styles.intro, { color: palette.textSecondary }]}>
            Choose what people who can view your profile see. Health, coaching,
            and cycle data are always private.
          </Text>
          {SECTION_ROWS.map((row, index) => (
            <React.Fragment key={row.key}>
              {index > 0 ? <SettingsDivider /> : null}
              <SettingsSwitchRow
                title={row.title}
                subtitle={row.subtitle}
                value={settings[row.key]}
                onValueChange={(value) => toggle(row.key, value)}
              />
            </React.Fragment>
          ))}

          <View style={{ height: spacing.xxl }} />
          <SettingsSectionLabel title="Posts" />
          <Text style={[styles.intro, { color: palette.textSecondary }]}>
            Default audience when sharing a workout. You can still change it on
            each post.
          </Text>
          <View
            style={[
              styles.audienceRow,
              { backgroundColor: palette.surfaceAlt },
            ]}
          >
            {AUDIENCES.map((audience) => {
              const selected = sharingDefault === audience.value
              return (
                <Pressable
                  key={audience.value}
                  onPress={() => setAudience(audience.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Default audience ${audience.label}`}
                  style={[
                    styles.audienceOption,
                    selected && {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.smallStrong,
                      {
                        color: selected
                          ? palette.textPrimary
                          : palette.textSecondary,
                      },
                    ]}
                  >
                    {audience.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={{ height: spacing.xxl }} />
          <SettingsSectionLabel title="Check it yourself" />
          <SettingsRow
            icon="eye"
            iconTint={palette.primary}
            iconBg={palette.primaryMuted}
            title="View as others"
            subtitle="Preview your public profile exactly as a stranger sees it"
            disabled={!myProfile}
            onPress={() => {
              if (!myProfile) return
              void Haptics.selectionAsync()
              router.push({
                pathname: '/u/[username]',
                params: { username: myProfile.username, preview: '1' },
              })
            }}
          />
          <SettingsDivider />
          <SettingsRow
            icon="lock.fill"
            iconTint={palette.textPrimary}
            iconBg={palette.surfaceAlt}
            title="Private account"
            subtitle="Approve backers before they see your posts (in Edit profile)"
            onPress={() => {
              void Haptics.selectionAsync()
              router.push('/social/edit-profile')
            }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  intro: {
    ...typography.small,
    marginBottom: spacing.lg,
  },
  audienceRow: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
  },
  audienceOption: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
})
