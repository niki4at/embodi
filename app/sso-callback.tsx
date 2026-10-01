import { getClerkInstance, useClerk, useSignIn, useSignUp } from '@clerk/clerk-expo'
import { useRouter, type Href } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import LoadingScreen from '@/components/loading-screen'

function completePopupAuthSession() {
  try {
    WebBrowser.maybeCompleteAuthSession()
  } catch {
    // Cross-origin opener after the Google redirect. The page below finishes sign-in.
  }
}

export default function SSOCallback() {
  const router = useRouter()
  const clerk = useClerk()
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn()
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current || !signInLoaded || !signUpLoaded || !clerk.loaded) return
    startedRef.current = true

    const goHome = () => {
      router.replace('/')
    }

    const finish = async () => {
      completePopupAuthSession()

      // Native deep links are completed by the screen that opened the browser.
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        goHome()
        return
      }

      const params = new URL(window.location.href).searchParams
      const nonce = params.get('rotating_token_nonce')?.split('#')[0]?.trim()

      if (!nonce && !signIn?.status && !signUp?.status) {
        goHome()
        return
      }

      if (nonce && signIn) {
        try {
          await signIn.reload({ rotatingTokenNonce: nonce })
          if (signIn.firstFactorVerification.status === 'transferable') {
            await signUp?.create({ transfer: true })
          }
          const sessionId = signUp?.createdSessionId ?? signIn.createdSessionId
          if (sessionId) {
            const setActive = signUp?.createdSessionId ? setSignUpActive : setSignInActive
            await setActive?.({ session: sessionId })
            goHome()
            return
          }
        } catch (error) {
          console.error('Could not finish the Google sign-in', error)
        }
      }

      const stayInApp = (to: string) => {
        if (!to || to.includes('accounts.dev') || to.includes('accounts.google.com')) {
          goHome()
          return
        }
        try {
          const url = new URL(to, window.location.origin)
          if (url.origin === window.location.origin) {
            const path = `${url.pathname}${url.search}` || '/'
            router.replace(path as Href)
            return
          }
        } catch {
          goHome()
          return
        }
        goHome()
      }

      try {
        // useClerk()'s wrapper drops the custom navigate argument. The browser
        // instance accepts it, which is what keeps a failed attempt off the
        // hosted account portal.
        const browserClerk = getClerkInstance()
        await browserClerk.handleRedirectCallback(
          {
            signInForceRedirectUrl: '/',
            signUpForceRedirectUrl: '/',
            signInFallbackRedirectUrl: '/',
            signUpFallbackRedirectUrl: '/',
          },
          async (to) => {
            stayInApp(to)
          },
        )
      } catch (error) {
        console.error('Could not finish the sign-in redirect', error)
      }

      if (window.location.pathname.includes('sso-callback')) {
        goHome()
      }
    }

    void finish()
  }, [
    clerk,
    router,
    setSignInActive,
    setSignUpActive,
    signIn,
    signInLoaded,
    signUp,
    signUpLoaded,
  ])

  return <LoadingScreen message="Completing sign in..." />
}
