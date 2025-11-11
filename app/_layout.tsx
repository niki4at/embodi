import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import * as WebBrowser from 'expo-web-browser'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@/utils/clerkTokenCache'
import { ConvexClientProvider } from '@/components/ConvexClientProvider'

WebBrowser.maybeCompleteAuthSession()

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')
}

export const unstable_settings = {
  anchor: '(tabs)',
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexClientProvider>
        <ThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: 'modal', title: 'Modal' }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  )
}
