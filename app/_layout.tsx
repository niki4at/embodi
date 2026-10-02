import { ClerkProvider } from '@clerk/clerk-expo'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { Platform, Text, View } from 'react-native'
import Head from 'expo-router/head'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated'

import { AppErrorBoundary } from '@/components/app-error-boundary'
import { ConvexClientProvider } from '@/components/ConvexClientProvider'
import { SocialBootstrap } from '@/components/social/social-bootstrap'
import RestTimerOverlay from '@/components/trainer/rest-timer/RestTimerOverlay'
import RestTimerPill from '@/components/trainer/rest-timer/RestTimerPill'
import { RestTimerProvider } from '@/components/trainer/rest-timer/RestTimerProvider'
import {
  PreferencesProvider,
  usePreferences,
} from '@/constants/preferences-context'
import { ThemeProvider, useTheme } from '@/constants/theme-context'
import { tokenCache } from '@/utils/clerkTokenCache'

// ClerkProvider calls this on every web render. After Google, the opener is
// gone and the stock helper throws while reading parent.location, which
// unmounts the tree. Swallow that and let /sso-callback finish sign-in.
const webBrowser = WebBrowser as {
  maybeCompleteAuthSession?: (...args: unknown[]) => unknown
}
if (typeof webBrowser.maybeCompleteAuthSession === 'function') {
  const completeAuthSession = webBrowser.maybeCompleteAuthSession.bind(WebBrowser)
  webBrowser.maybeCompleteAuthSession = (...args: unknown[]) => {
    try {
      return completeAuthSession(...args)
    } catch {
      return {
        type: 'failed',
        message: 'Auth session could not be completed in this window.',
      }
    }
  }
  webBrowser.maybeCompleteAuthSession()
}
SplashScreen.preventAutoHideAsync().catch(() => {})

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')
}

export const unstable_settings = {
  anchor: '(tabs)',
}

function ThemedNavigation() {
  const { palette, resolved } = useTheme()
  const { reduceMotion } = usePreferences()
  const base = resolved === 'dark' ? DarkTheme : DefaultTheme
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: palette.bg,
      card: palette.bg,
      primary: palette.primary,
      text: palette.textPrimary,
      border: palette.border,
      notification: palette.primary,
    },
  }

  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: palette.bg },
          headerStyle: { backgroundColor: palette.bg },
          headerTintColor: palette.textPrimary,
          headerTitleStyle: { color: palette.textPrimary },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
        <Stack.Screen
          name="profile-questions"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="checkin"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="session/index"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="session/ready"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="session/recap"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="health-context"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="privacy-settings"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="training-setup"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="journey"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="cycle"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="build-workout"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="routines"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="challenge/new"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="challenge/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="exercise/[id]"
          options={{
            // Rendered as a card (not a native modal) so the global rest
            // timer pill stays visible while working out in focus mode.
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="post/[id]/index"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="post/[id]/comments"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="u/[username]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="social/search"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="social/notifications"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="social/share"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="social/edit-profile"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="social/blocked"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="community/new"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="community/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="join/[code]"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <ReducedMotionConfig
        mode={reduceMotion ? ReduceMotion.Always : ReduceMotion.System}
      />
      <SocialBootstrap />
      <RestTimerPill />
      <RestTimerOverlay />
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_400Regular: require('@expo-google-fonts/sora/400Regular/Sora_400Regular.ttf'),
    Sora_500Medium: require('@expo-google-fonts/sora/500Medium/Sora_500Medium.ttf'),
    Sora_600SemiBold: require('@expo-google-fonts/sora/600SemiBold/Sora_600SemiBold.ttf'),
    Sora_700Bold: require('@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf'),
    Sora_800ExtraBold: require('@expo-google-fonts/sora/800ExtraBold/Sora_800ExtraBold.ttf'),
    IntelOneMono_400Regular: require('@expo-google-fonts/intel-one-mono/400Regular/IntelOneMono_400Regular.ttf'),
    IntelOneMono_500Medium: require('@expo-google-fonts/intel-one-mono/500Medium/IntelOneMono_500Medium.ttf'),
    IntelOneMono_700Bold: require('@expo-google-fonts/intel-one-mono/700Bold/IntelOneMono_700Bold.ttf'),
    ArchivoBlack_400Regular: require('@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded])

  const head = (
    <Head>
      <title>Bodfit</title>
      <meta
        name="description"
        content="Bodfit: a coach that builds every session around how you feel today."
      />
    </Head>
  )

  if (!fontsLoaded) {
    return (
      <>
        {head}
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#111111', fontSize: 22, fontWeight: '700' }}>
            Bodfit
          </Text>
        </View>
      </>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {head}
      <AppErrorBoundary>
        <ClerkProvider
          publishableKey={publishableKey}
          tokenCache={tokenCache}
          signInForceRedirectUrl="/"
          signUpForceRedirectUrl="/"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          {Platform.OS === 'web' ? (
            <View nativeID="clerk-captcha" collapsable={false} />
          ) : null}
          <ConvexClientProvider>
            <PreferencesProvider>
              <ThemeProvider>
                <RestTimerProvider>
                  <ThemedNavigation />
                </RestTimerProvider>
              </ThemeProvider>
            </PreferencesProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  )
}
