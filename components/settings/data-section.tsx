import { useAuth } from '@clerk/clerk-expo'
import { useConvex, useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { Alert, Share } from 'react-native'

import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

import {
  confirmAction,
  runHaptic,
  SettingsDivider,
  SettingsRow,
  SettingsSectionLabel,
} from './settings-row'

type Working = null | 'export' | 'coach' | 'recommendations' | 'deactivate'

/**
 * Data & AI ownership: export everything, clear coach memory, reset AI
 * recommendations, and temporary deactivation (reactivated by signing in).
 */
export function DataSection() {
  const { palette } = useTheme()
  const convex = useConvex()
  const { signOut } = useAuth()
  const clearCoachMemory = useMutation(api.account.clearCoachMemory)
  const resetRecommendations = useMutation(api.account.resetRecommendations)
  const deactivateAccount = useMutation(api.account.deactivateAccount)
  const [working, setWorking] = useState<Working>(null)

  const handleExport = useCallback(async () => {
    if (working) return
    setWorking('export')
    try {
      await runHaptic(() => Haptics.selectionAsync())
      const json = await convex.query(api.account.exportData, {
        now: Date.now(),
      })
      if (!json) {
        Alert.alert('Export failed', 'Sign in and try again.')
        return
      }
      await Share.share({
        message: json,
        title: 'Embodi data export',
      })
    } catch (err) {
      console.error('Export failed', err)
      Alert.alert('Export failed', 'Something went wrong. Try again.')
    } finally {
      setWorking(null)
    }
  }, [convex, working])

  const confirmClearCoach = useCallback(() => {
    if (working) return
    void runHaptic(() => Haptics.selectionAsync())
    confirmAction({
      title: 'Clear coach memory?',
      message:
        'Removes every answer your coach has learned about you and its summary. Your workouts, health basics, and history stay. The coach will start asking questions again.',
      confirmText: 'Clear memory',
      confirmStyle: 'destructive',
      onConfirm: () => {
        setWorking('coach')
        clearCoachMemory({})
          .then(() =>
            runHaptic(() =>
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ),
            ),
          )
          .catch((err) => {
            console.error('Clear coach memory failed', err)
            Alert.alert('Could not clear', 'Try again in a moment.')
          })
          .finally(() => setWorking(null))
      },
    })
  }, [clearCoachMemory, working])

  const confirmResetRecommendations = useCallback(() => {
    if (working) return
    void runHaptic(() => Haptics.selectionAsync())
    confirmAction({
      title: 'Reset recommendations?',
      message:
        'Clears your weekly insights and the feedback that shaped them. Fresh recommendations generate after your next workout.',
      confirmText: 'Reset',
      onConfirm: () => {
        setWorking('recommendations')
        resetRecommendations({})
          .then(() =>
            runHaptic(() =>
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ),
            ),
          )
          .catch((err) => {
            console.error('Reset recommendations failed', err)
            Alert.alert('Could not reset', 'Try again in a moment.')
          })
          .finally(() => setWorking(null))
      },
    })
  }, [resetRecommendations, working])

  const confirmDeactivate = useCallback(() => {
    if (working) return
    void runHaptic(() => Haptics.selectionAsync())
    confirmAction({
      title: 'Deactivate account?',
      message:
        'Hides your profile and posts and pauses social notifications. All your data stays. Signing back in reactivates everything.',
      confirmText: 'Deactivate',
      confirmStyle: 'destructive',
      onConfirm: () => {
        setWorking('deactivate')
        deactivateAccount({})
          .then(async () => {
            await signOut()
            router.replace('/')
          })
          .catch((err) => {
            console.error('Deactivate failed', err)
            setWorking(null)
            Alert.alert('Could not deactivate', 'Try again in a moment.')
          })
      },
    })
  }, [deactivateAccount, signOut, working])

  return (
    <>
      <SettingsSectionLabel title="Your data & AI" />
      <SettingsRow
        icon="square.and.arrow.up"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Export my data"
        subtitle="Profile, workouts, routines, and achievements as JSON"
        onPress={() => void handleExport()}
        disabled={working !== null}
        loading={working === 'export'}
      />
      <SettingsDivider />
      <SettingsRow
        icon="wand.and.stars"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Clear coach memory"
        subtitle="Forget learned answers and the coach summary"
        onPress={confirmClearCoach}
        disabled={working !== null}
        loading={working === 'coach'}
      />
      <SettingsDivider />
      <SettingsRow
        icon="arrow.clockwise"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Reset recommendations"
        subtitle="Start weekly insights from a clean slate"
        onPress={confirmResetRecommendations}
        disabled={working !== null}
        loading={working === 'recommendations'}
      />
      <SettingsDivider />
      <SettingsRow
        icon="pause.fill"
        iconTint={palette.primary}
        iconBg={palette.primaryMuted}
        title="Deactivate account"
        subtitle="Hide your profile temporarily; sign in to come back"
        onPress={confirmDeactivate}
        disabled={working !== null}
        loading={working === 'deactivate'}
      />
    </>
  )
}
