import { getClerkInstance, useClerk, useSignIn, useSignUp } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { safeAppUrl } from '@/utils/safeAppUrl'

// Survives React strict-mode remounts. A second run calls handleRedirectCallback
// again after the session is already active and sends the browser away.
let webCallbackStarted = false

function SigningIn() {
  return (
    <View style={styles.fill}>
      <Text style={styles.title}>Signing you in</Text>
    </View>
  )
}

export default function SSOCallback() {
  const router = useRouter()
  const clerk = useClerk()
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn()
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!signInLoaded || !signUpLoaded || !clerk.loaded) return
    if (Platform.OS === 'web') {
      if (webCallbackStarted) return
      webCallbackStarted = true
    } else if (startedRef.current) {
      return
    } else {
      startedRef.current = true
    }

    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      router.replace('/')
      return
    }

    let redirected = false
    const hardRedirect = (to?: string | null) => {
      if (redirected) return
      redirected = true
      window.location.replace(safeAppUrl(to, window.location.origin))
    }

    const timeout = window.setTimeout(() => hardRedirect('/'), 12000)

    const finish = async () => {
      const params = new URL(window.location.href).searchParams
      const nonce = params.get('rotating_token_nonce')?.split('#')[0]?.trim()
      const clerkStatus = params.get('__clerk_status')
      const createdFromUrl = params.get('__clerk_created_session')

      const browserClerk = getClerkInstance()
      if (!browserClerk) {
        hardRedirect('/')
        return
      }

      // Success calls this.navigate(), not the custom callback. Point that at
      // a same-origin full page load so Expo Router is not left on an empty stack.
      browserClerk.navigate = async (to: string) => {
        hardRedirect(to)
      }

      // Handshake already activated the session. A client-side replace here
      // would drop it; a full load of Home keeps the dev-browser cookie.
      if (browserClerk.session) {
        hardRedirect('/')
        return
      }

      if (nonce && signIn) {
        try {
          await signIn.reload({ rotatingTokenNonce: nonce })
          if (signIn.firstFactorVerification.status === 'transferable') {
            await signUp?.create({ transfer: true })
          }
        } catch (error) {
          console.error('Could not reload the Google sign-in', error)
        }
      }

      const sessionId =
        signUp?.createdSessionId ?? signIn?.createdSessionId ?? createdFromUrl
      const sessionReady =
        signIn?.status === 'complete' ||
        signUp?.status === 'complete' ||
        clerkStatus === 'verified'

      if (sessionId && sessionReady) {
        try {
          const setActive = signUp?.createdSessionId ? setSignUpActive : setSignInActive
          await setActive?.({ session: sessionId })
        } catch (error) {
          console.error('Could not activate the Google session', error)
        }
        hardRedirect('/')
        return
      }

      const hasAttempt =
        Boolean(nonce) ||
        Boolean(clerkStatus) ||
        Boolean(createdFromUrl) ||
        Boolean(signIn?.status) ||
        Boolean(signUp?.status) ||
        params.has('__clerk_handshake')

      if (!hasAttempt) {
        hardRedirect('/')
        return
      }

      try {
        await browserClerk.handleRedirectCallback(
          {
            signInForceRedirectUrl: '/',
            signUpForceRedirectUrl: '/',
            signInFallbackRedirectUrl: '/',
            signUpFallbackRedirectUrl: '/',
          },
          async (to) => {
            hardRedirect(to)
          },
        )
      } catch (error) {
        console.error('Could not finish the sign-in redirect', error)
      }

      hardRedirect('/')
    }

    void finish().finally(() => {
      window.clearTimeout(timeout)
    })
  }, [
    clerk.loaded,
    router,
    setSignInActive,
    setSignUpActive,
    signIn,
    signInLoaded,
    signUp,
    signUpLoaded,
  ])

  return <SigningIn />
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
  },
})
