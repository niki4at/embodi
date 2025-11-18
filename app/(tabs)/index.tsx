import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
  useMutation,
} from 'convex/react'
import { api } from '@/convex/_generated/api'

import LoginScreen from '@/components/login-screen'
import LoadingScreen from '@/components/loading-screen'
import OnboardingScreen, { OnboardingData } from '@/components/onboarding/onboarding-screen'
import HomeContent from '@/components/home/home-content'

export default function HomeScreen() {
  const hasCompletedOnboarding = useQuery(api.onboarding.hasCompletedOnboarding)
  const saveOnboarding = useMutation(api.onboarding.saveOnboarding)

  const handleOnboardingComplete = async (data: OnboardingData) => {
    try {
      await saveOnboarding(data)
    } catch (error) {
      console.error('Error saving onboarding data:', error)
    }
  }

  return (
    <>
      <Authenticated>
        {hasCompletedOnboarding === undefined ? (
          <LoadingScreen />
        ) : !hasCompletedOnboarding ? (
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        ) : (
          <HomeContent />
        )}
      </Authenticated>

      <Unauthenticated>
        <LoginScreen />
      </Unauthenticated>

      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
    </>
  )
}

