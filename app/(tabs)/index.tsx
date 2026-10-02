import { useAuth } from '@clerk/clerk-expo'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useNavigation } from 'expo-router'
import React, { useLayoutEffect } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import HomeContent from '@/components/home/home-content'
import LoadingScreen from '@/components/loading-screen'
import LoginScreen from '@/components/login-screen'
import OnboardingScreen, {
  OnboardingData,
} from '@/components/onboarding/onboarding-screen'
import { api } from '@/convex/_generated/api'

export default function HomeScreen() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLoading: convexLoading, isAuthenticated } = useConvexAuth()
  const navigation = useNavigation()
  const convexReady = Boolean(isSignedIn) && !convexLoading && isAuthenticated

  const hasCompletedOnboarding = useQuery(
    api.onboarding.hasCompletedOnboarding,
    convexReady ? {} : 'skip',
  )
  const saveOnboarding = useMutation(api.onboarding.saveOnboarding)
  const claimUsername = useMutation(api.profiles.claimUsername)

  const showHome = convexReady && hasCompletedOnboarding === true

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: showHome ? undefined : { display: 'none' },
    })
  }, [navigation, showHome])

  const handleOnboardingComplete = async (data: OnboardingData) => {
    const { username, ...onboardingFields } = data
    try {
      await saveOnboarding(onboardingFields)
    } catch (error) {
      console.error('Error saving onboarding data:', error)
    }
    if (username.trim()) {
      try {
        await claimUsername({
          username: username.trim(),
          displayName: data.name.trim() || username.trim(),
        })
      } catch (error) {
        // A race on the handle is recoverable: SocialBootstrap generates one.
        console.warn('Could not claim username:', error)
      }
    }
  }

  if (!isLoaded) return <LoadingScreen />
  if (!isSignedIn) return <LoginScreen />
  // Clerk can flip signed-in before the Convex JWT exists. Home queries throw
  // "Not authenticated" in that gap, and useQuery then blanks the page.
  if (convexLoading) return <LoadingScreen message="Signing you in" />
  if (!isAuthenticated) return <SessionSyncScreen />
  if (hasCompletedOnboarding === undefined) {
    return <LoadingScreen message="Signing you in" />
  }
  if (!hasCompletedOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />
  }
  return <HomeContent />
}

function SessionSyncScreen() {
  return (
    <View style={styles.fill}>
      <Text style={styles.title}>Almost in</Text>
      <Text style={styles.message}>
        Google signed you in, but the session didn&apos;t reach the coach.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.assign(window.location.origin + '/')
          }
        }}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>Try again</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#444444',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#111111',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
