import { Image } from 'expo-image'
import { Platform, StyleSheet, Button } from 'react-native'
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
} from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useSSO, useAuth } from '@clerk/clerk-expo'
import * as Linking from 'expo-linking'

import { HelloWave } from '@/components/hello-wave'
import ParallaxScrollView from '@/components/parallax-scroll-view'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Link } from 'expo-router'

export default function HomeScreen() {
  return (
    <>
      <Authenticated>
        <ParallaxScrollView
          headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
          headerImage={
            <Image
              source={require('@/assets/images/partial-react-logo.png')}
              style={styles.reactLogo}
            />
          }
        >
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">Welcome!</ThemedText>
            <HelloWave />
          </ThemedView>
          <IdentityInfo />
          <ThemedView style={styles.stepContainer}>
            <SignOutButton />
          </ThemedView>
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">Step 1: Try it</ThemedText>
            <ThemedText>
              Edit{' '}
              <ThemedText type="defaultSemiBold">
                app/(tabs)/index.tsx
              </ThemedText>{' '}
              to see changes. Press{' '}
              <ThemedText type="defaultSemiBold">
                {Platform.select({
                  ios: 'cmd + d',
                  android: 'cmd + m',
                  web: 'F12',
                })}
              </ThemedText>{' '}
              to open developer tools.
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.stepContainer}>
            <Link href="/modal">
              <Link.Trigger>
                <ThemedText type="subtitle">Step 2: Explore</ThemedText>
              </Link.Trigger>
              <Link.Preview />
              <Link.Menu>
                <Link.MenuAction
                  title="Action"
                  icon="cube"
                  onPress={() => alert('Action pressed')}
                />
                <Link.MenuAction
                  title="Share"
                  icon="square.and.arrow.up"
                  onPress={() => alert('Share pressed')}
                />
                <Link.Menu title="More" icon="ellipsis">
                  <Link.MenuAction
                    title="Delete"
                    icon="trash"
                    destructive
                    onPress={() => alert('Delete pressed')}
                  />
                </Link.Menu>
              </Link.Menu>
            </Link>

            <ThemedText>
              {`Tap the Explore tab to learn more about what's included in this starter app.`}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
            <ThemedText>
              {`When you're ready, run `}
              <ThemedText type="defaultSemiBold">
                npm run reset-project
              </ThemedText>{' '}
              to get a fresh <ThemedText type="defaultSemiBold">app</ThemedText>{' '}
              directory. This will move the current{' '}
              <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
              <ThemedText type="defaultSemiBold">app-example</ThemedText>.
            </ThemedText>
          </ThemedView>
        </ParallaxScrollView>
      </Authenticated>

      <Unauthenticated>
        <ThemedView style={styles.stepContainer}>
          <ThemedText>Please sign in</ThemedText>
          <SignInButtons />
        </ThemedView>
      </Unauthenticated>

      <AuthLoading>
        <ThemedView style={styles.stepContainer}>
          <ThemedText>Loading…</ThemedText>
        </ThemedView>
      </AuthLoading>
    </>
  )
}

function SignInButtons() {
  const { startSSOFlow } = useSSO()

  const onGooglePress = async () => {
    try {
      const redirectUrl = Linking.createURL('/sso-callback')
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
        authSessionOptions: { showInRecents: true },
      })
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId })
      }
    } catch (err) {
      console.error('OAuth error', err)
    }
  }

  return <Button title="Sign in with Google" onPress={onGooglePress} />
}

function SignOutButton() {
  const { isLoaded, signOut } = useAuth()
  if (!isLoaded) return null
  const onPress = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out error', err)
    }
  }
  return <Button title="Sign out" onPress={onPress} />
}

function IdentityInfo() {
  const identity = useQuery(api.messages.getForCurrentUser)
  return (
    <ThemedView style={styles.stepContainer}>
      <ThemedText>
        Identity: {identity ? JSON.stringify(identity) : '…'}
      </ThemedText>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
})
