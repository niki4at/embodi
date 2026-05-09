import { Link } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export default function ModalScreen() {
  const { palette } = useTheme()

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>Modal</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          A floating sheet for quick actions and confirmations.
        </Text>
        <Link
          href="/"
          dismissTo
          style={[styles.link, { backgroundColor: palette.primary }]}
        >
          <Text style={[styles.linkText, { color: palette.white }]}>
            Go back home
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  link: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  linkText: {
    ...typography.bodyStrong,
  },
})
