import { useAuth } from '@clerk/clerk-expo'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import type * as ExpoNotifications from 'expo-notifications'
import { router } from 'expo-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { api } from '@/convex/_generated/api'

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
const pushAvailable = Platform.OS !== 'web' && !isExpoGo

async function getNotifications(): Promise<typeof ExpoNotifications | null> {
  if (!pushAvailable) return null
  return await import('expo-notifications')
}

type PushData = {
  type?: string
  postId?: string | null
  communityId?: string | null
}

function routeFromPushData(data: PushData): void {
  if (data.postId) {
    // Comment pushes land directly in the conversation.
    if (data.type === 'comment') {
      router.push({
        pathname: '/post/[id]/comments',
        params: { id: data.postId },
      })
    } else {
      router.push({ pathname: '/post/[id]', params: { id: data.postId } })
    }
  } else if (data.communityId) {
    router.push({
      pathname: '/community/[id]',
      params: { id: data.communityId },
    })
  } else {
    router.push('/social/notifications')
  }
}

/**
 * Headless: provisions the social profile for pre-social accounts (once),
 * registers the Expo push token, and routes notification taps.
 */
export function SocialBootstrap() {
  const { isSignedIn } = useAuth()
  const myProfile = useQuery(api.profiles.getMyProfile, isSignedIn ? {} : 'skip')
  const hasOnboarded = useQuery(
    api.onboarding.hasCompletedOnboarding,
    isSignedIn ? {} : 'skip'
  )
  const ensureProfile = useMutation(api.profiles.ensureProfile)
  const reactivateAccount = useMutation(api.account.reactivateAccount)
  const registerPushToken = useMutation(api.notifications.registerPushToken)
  const ensuredRef = useRef(false)
  const reactivatedRef = useRef(false)
  const pushRegisteredRef = useRef(false)

  // Existing users get a handle generated silently, exactly once.
  useEffect(() => {
    if (ensuredRef.current) return
    if (!isSignedIn || myProfile !== null || hasOnboarded !== true) return
    ensuredRef.current = true
    ensureProfile({}).catch(() => {
      ensuredRef.current = false
    })
  }, [isSignedIn, myProfile, hasOnboarded, ensureProfile])

  // Signing back in reactivates a deactivated account.
  useEffect(() => {
    if (reactivatedRef.current) return
    if (!isSignedIn || !myProfile?.deactivated) return
    reactivatedRef.current = true
    reactivateAccount({}).catch(() => {
      reactivatedRef.current = false
    })
  }, [isSignedIn, myProfile, reactivateAccount])

  // Push token registration + tap routing.
  useEffect(() => {
    if (!isSignedIn || !myProfile || pushRegisteredRef.current) return
    pushRegisteredRef.current = true

    let tapSubscription: { remove: () => void } | null = null
    let cancelled = false

    const setup = async () => {
      const Notifications = await getNotifications()
      if (!Notifications || cancelled) return

      try {
        const permission = await Notifications.requestPermissionsAsync()
        if (!permission.granted) return

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('social', {
            name: 'Social',
            importance: Notifications.AndroidImportance.DEFAULT,
          }).catch(() => {})
        }

        const projectId =
          Constants.easConfig?.projectId ??
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } })
            ?.eas?.projectId
        if (!projectId) return

        const token = await Notifications.getExpoPushTokenAsync({ projectId })
        if (cancelled) return
        await registerPushToken({
          token: token.data,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        })

        tapSubscription = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const data = response.notification.request.content.data as PushData
            if (data && (data.postId || data.communityId || data.type)) {
              routeFromPushData(data)
            }
          }
        )
      } catch (error) {
        console.warn('Push registration failed', error)
      }
    }

    void setup()
    return () => {
      cancelled = true
      tapSubscription?.remove()
    }
  }, [isSignedIn, myProfile, registerPushToken])

  return null
}
