import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TrainingSetupContent } from '@/components/training-setup/training-setup-content'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export default function TrainingSetupScreen() {
  const { palette, resolved } = useTheme()

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/settings')
    }
  }, [])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <IconSymbol
            name="chevron.left"
            size={20}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Training setup
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <TrainingSetupContent />
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  title: { ...typography.h2 },
})
