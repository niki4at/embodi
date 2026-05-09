import { useAuth } from '@clerk/clerk-expo'
import { useMutation, useQuery } from 'convex/react'
import { useNavigation } from 'expo-router'
import React, { useLayoutEffect } from 'react'

import HomeContent from '@/components/home/home-content'
import LoadingScreen from '@/components/loading-screen'
import LoginScreen from '@/components/login-screen'
import OnboardingScreen, {
  OnboardingData,
} from '@/components/onboarding/onboarding-screen'
import { api } from '@/convex/_generated/api'

export default function HomeScreen() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigation = useNavigation()

  const hasCompletedOnboarding = useQuery(
    api.onboarding.hasCompletedOnboarding,
    isSignedIn ? {} : 'skip',
  )
  const saveOnboarding = useMutation(api.onboarding.saveOnboarding)

  const showHome =
    isLoaded && isSignedIn && hasCompletedOnboarding === true

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: showHome ? undefined : { display: 'none' },
    })
  }, [navigation, showHome])

  const handleOnboardingComplete = async (data: OnboardingData) => {
    try {
      await saveOnboarding(data)
    } catch (error) {
      console.error('Error saving onboarding data:', error)
    }
  }

  if (!isLoaded) return <LoadingScreen />
  if (!isSignedIn) return <LoginScreen />
  if (hasCompletedOnboarding === undefined) return <LoadingScreen />
  if (!hasCompletedOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />
  }
  return <HomeContent />
}
