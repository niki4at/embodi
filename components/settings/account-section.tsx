import { useAuth, useUser } from '@clerk/clerk-expo'
import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

import {
  confirmAction,
  runHaptic,
  SettingsDivider,
  SettingsRow,
  SettingsSectionLabel,
} from './settings-row'

/**
 * Account group: sign out (data preserved) and confirmation-gated permanent
 * deletion that wipes only the current user's records.
 */
export function AccountSection() {
  const { palette } = useTheme()
  const { signOut } = useAuth()
  const { user } = useUser()
  const deleteAccount = useMutation(api.account.deleteAccount)
  const [isWorking, setIsWorking] = useState<null | 'logout' | 'delete'>(null)

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

  return (
    <>
      <SettingsSectionLabel title="Account" />
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
      <SettingsDivider />
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
    </>
  )
}

const styles = StyleSheet.create({
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
