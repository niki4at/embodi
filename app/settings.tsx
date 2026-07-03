import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SettingsPanel } from '@/components/settings/settings-panel'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export default function SettingsScreen() {
  const { palette, resolved } = useTheme()

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const iconTint = resolved === 'dark' ? palette.white : palette.textPrimary

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <IconSymbol
            name={Platform.OS === 'ios' ? 'chevron.down' : 'chevron.left'}
            size={20}
            color={iconTint}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Settings
        </Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <SettingsPanel />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    ...typography.h2,
  },
})
