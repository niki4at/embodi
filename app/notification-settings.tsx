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
  SettingsSwitchRow,
} from '@/components/settings/settings-row'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

export default function NotificationSettingsScreen() {
  const { palette } = useTheme()
  const settings = useQuery(api.userSettings.get)
  const update = useMutation(api.userSettings.update)

  const toggle = (
    key: 'notifyBackers' | 'notifyReactions' | 'notifyCommunities',
    value: boolean,
  ) => {
    void Haptics.selectionAsync()
    update({ [key]: value }).catch(() => {})
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
          Notifications
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {settings === undefined ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.intro, { color: palette.textSecondary }]}>
            Choose which social activity reaches you. These apply to both the
            in-app inbox and push notifications.
          </Text>

          <SettingsSwitchRow
            icon="person.2.fill"
            iconTint={palette.primary}
            iconBg={palette.primaryMuted}
            title="Backers"
            subtitle="New backers, back requests, and accepted requests"
            value={settings.notifyBackers}
            onValueChange={(value) => toggle('notifyBackers', value)}
          />
          <SettingsDivider />
          <SettingsSwitchRow
            icon="heart.fill"
            iconTint={palette.danger}
            iconBg={palette.dangerMuted}
            title="Reactions"
            subtitle="Cheers, comments, reposts, and workout tries"
            value={settings.notifyReactions}
            onValueChange={(value) => toggle('notifyReactions', value)}
          />
          <SettingsDivider />
          <SettingsSwitchRow
            icon="trophy.fill"
            iconTint={palette.warning}
            iconBg={palette.warningMuted}
            title="Communities"
            subtitle="Challenge invites and community milestones"
            value={settings.notifyCommunities}
            onValueChange={(value) => toggle('notifyCommunities', value)}
          />

          <Text style={[styles.footnote, { color: palette.textTertiary }]}>
            Workout reminders and rest-timer sounds are controlled by your
            device notification settings.
          </Text>
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
    marginBottom: spacing.xl,
  },
  footnote: {
    ...typography.small,
    marginTop: spacing.xl,
  },
})
