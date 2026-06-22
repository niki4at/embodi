import { useAuth, useUser } from '@clerk/clerk-expo'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

interface ConfirmActionOptions {
  title: string
  message: string
  confirmText: string
  confirmStyle?: AlertButton['style']
  onConfirm: () => void
}

function confirmAction({
  title,
  message,
  confirmText,
  confirmStyle,
  onConfirm,
}: ConfirmActionOptions) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm()
    }
    return
  }

  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmText,
        style: confirmStyle,
        onPress: onConfirm,
      },
    ],
    { cancelable: true },
  )
}

async function runHaptic(effect: () => Promise<void>) {
  try {
    await effect()
  } catch {
    // Haptics are optional feedback and should never block account actions.
  }
}

export default function SettingsScreen() {
  const { palette, resolved } = useTheme()
  const { signOut } = useAuth()
  const { user } = useUser()
  const deleteAccount = useMutation(api.account.deleteAccount)
  const onboarding = useQuery(api.onboarding.getOnboarding)
  const setTrackPeriod = useMutation(api.onboarding.setTrackPeriod)
  const [isWorking, setIsWorking] = useState<null | 'logout' | 'delete'>(null)
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

  const handleOpenCycle = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/cycle')
  }, [])

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || email || 'Account'

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const performLogout = useCallback(async () => {
    if (isWorking) return
    setIsWorking('logout')
    try {
      await runHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      )
      await signOut()
      router.replace('/')
    } catch (err) {
      console.error('Sign out failed', err)
      setIsWorking(null)
      Alert.alert('Could not log out', 'Something went wrong. Try again.')
    }
  }, [isWorking, signOut])

  const performDelete = useCallback(async () => {
    if (isWorking) return
    setIsWorking('delete')
    try {
      await runHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
      )
      await deleteAccount()
      try {
        await user?.delete()
      } catch (clerkErr) {
        console.error('Clerk user delete failed', clerkErr)
      }
      try {
        await signOut()
      } catch {
        // user.delete() already invalidates the session; ignore.
      }
      router.replace('/')
    } catch (err) {
      console.error('Delete account failed', err)
      setIsWorking(null)
      Alert.alert(
        'Could not delete account',
        'Your data was not deleted. Check your connection and try again.',
      )
    }
  }, [deleteAccount, isWorking, signOut, user])

  const confirmDelete = useCallback(() => {
    if (isWorking) return
    void runHaptic(() => Haptics.selectionAsync())
    confirmAction({
      title: 'Delete account?',
      message:
        'This permanently erases your profile, check-ins, sessions, and history. Other users keep their data. You can\u2019t undo this.',
      confirmText: 'Delete account',
      confirmStyle: 'destructive',
      onConfirm: () => {
        void performDelete()
      },
    })
  }, [isWorking, performDelete])

  const confirmLogout = useCallback(() => {
    if (isWorking) return
    void runHaptic(() => Haptics.selectionAsync())
    confirmAction({
      title: 'Log out?',
      message: 'You can sign back in any time. Your data stays safe.',
      confirmText: 'Log out',
      onConfirm: () => {
        void performLogout()
      },
    })
  }, [isWorking, performLogout])

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.profileCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: palette.primaryMuted },
            ]}
          >
            <IconSymbol
              name="person.fill"
              size={26}
              color={palette.primary}
            />
          </View>
          <View style={styles.profileText}>
            <Text
              style={[styles.profileName, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {email ? (
              <Text
                style={[styles.profileEmail, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {email}
              </Text>
            ) : null}
          </View>
        </View>

        {cycleEligible && (
          <>
            <Text
              style={[styles.sectionLabel, { color: palette.textTertiary }]}
            >
              Cycle tracking
            </Text>

            <CycleToggleRow
              palette={palette}
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
                  onPress={handleOpenCycle}
                  disabled={isWorking !== null}
                />
              </View>
            ) : null}

            <View style={styles.divider} />
          </>
        )}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
          Account
        </Text>

        <SettingsRow
          icon="rectangle.portrait.and.arrow.right"
          iconTint={palette.textPrimary}
          iconBg={palette.surfaceAlt}
          title="Log out"
          subtitle="Sign out and keep your data"
          onPress={confirmLogout}
          disabled={isWorking !== null}
          loading={isWorking === 'logout'}
        />

        <View style={styles.divider} />

        <Text
          style={[
            styles.sectionLabel,
            { color: palette.textTertiary, marginTop: spacing.xl },
          ]}
        >
          Danger zone
        </Text>

        <SettingsRow
          icon="trash"
          iconTint={palette.danger}
          iconBg={palette.dangerMuted}
          title="Delete account"
          subtitle="Erase your profile, check-ins, and sessions"
          destructive
          onPress={confirmDelete}
          disabled={isWorking !== null}
          loading={isWorking === 'delete'}
        />

        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: palette.dangerMuted,
              borderColor: palette.primaryBorder,
            },
          ]}
        >
          <IconSymbol
            name="exclamationmark.triangle"
            size={16}
            color={palette.danger}
          />
          <Text style={[styles.warningText, { color: palette.textSecondary }]}>
            Deleting your account is permanent. It only affects your data. Other
            users keep everything they&apos;ve created.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

interface CycleToggleRowProps {
  palette: ReturnType<typeof useTheme>['palette']
  value: boolean
  loading: boolean
  onValueChange: (next: boolean) => void
}

function CycleToggleRow({
  palette,
  value,
  loading,
  onValueChange,
}: CycleToggleRowProps) {
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

interface SettingsRowProps {
  icon: React.ComponentProps<typeof IconSymbol>['name']
  iconTint: string
  iconBg: string
  title: string
  subtitle?: string
  destructive?: boolean
  disabled?: boolean
  loading?: boolean
  onPress: () => void
}

function SettingsRow({
  icon,
  iconTint,
  iconBg,
  title,
  subtitle,
  destructive,
  disabled,
  loading,
  onPress,
}: SettingsRowProps) {
  const { palette } = useTheme()
  const titleColor = destructive ? palette.danger : palette.textPrimary

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <IconSymbol name={icon} size={18} color={iconTint} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: palette.textSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={titleColor} />
      ) : (
        <IconSymbol
          name="chevron.right"
          size={18}
          color={palette.textTertiary}
        />
      )}
    </Pressable>
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
    borderRadius: radius.pill,
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
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
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
  sectionLabel: {
    ...typography.caption,
    marginBottom: spacing.md,
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
  divider: {
    height: spacing.md,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  warningText: {
    flex: 1,
    ...typography.small,
  },
})
