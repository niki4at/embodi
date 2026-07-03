import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFloatingTabBarInset } from '@/components/navigation/floating-tab-bar'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export default function ProfileScreen() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Profile
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Your account and preferences
        </Text>
      </View>

      <SettingsPanel showHistoryRow bottomInset={tabBarInset} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
})
