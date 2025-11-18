import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSSO, useSignIn } from '@clerk/clerk-expo'
import * as Linking from 'expo-linking'
import LoadingScreen from './loading-screen'

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity)

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const { startSSOFlow } = useSSO()
  const { signIn, setActive } = useSignIn()

  const emailScale = useSharedValue(1)
  const passwordScale = useSharedValue(1)
  const signInScale = useSharedValue(1)

  // Shadow opacity values - start at 0, fade in after position animations complete
  const inputsShadowOpacity = useSharedValue(0)
  const signInShadowOpacity = useSharedValue(0)
  const socialShadowOpacity = useSharedValue(0)

  useEffect(() => {
    // Email: delay 200ms + 800ms duration = 1000ms
    // Password: delay 300ms + 800ms duration = 1100ms
    inputsShadowOpacity.value = withDelay(1100, withTiming(1, { duration: 300 }))
    
    // Sign In button: delay 500ms + 800ms duration = 1300ms
    signInShadowOpacity.value = withDelay(1300, withTiming(1, { duration: 300 }))
    
    // Social buttons: delay 700ms + 800ms duration = 1500ms
    socialShadowOpacity.value = withDelay(1500, withTiming(1, { duration: 300 }))
  }, [inputsShadowOpacity, signInShadowOpacity, socialShadowOpacity])

  const onEmailFocus = () => {
    setEmailFocused(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const onPasswordFocus = () => {
    setPasswordFocused(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsLoading(true)
      setIsAuthenticating(true)
      setAuthMessage('Signing you in...')

      const signInAttempt = await signIn?.create({
        identifier: email,
        password,
      })

      if (signInAttempt?.status === 'complete') {
        await setActive?.({ session: signInAttempt.createdSessionId })
      } else {
        console.error('Sign in failed:', signInAttempt)
        Alert.alert('Error', 'Sign in failed. Please try again.')
        setIsAuthenticating(false)
      }
    } catch (err: any) {
      console.error('Sign in error:', err)
      Alert.alert('Error', err?.errors?.[0]?.message || 'Sign in failed. Please check your credentials.')
      setIsAuthenticating(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAppleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsAuthenticating(true)
      setAuthMessage('Signing in with Apple...')
      
      const redirectUrl = Linking.createURL('/sso-callback')
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_apple',
        redirectUrl,
        authSessionOptions: { showInRecents: true },
      })
      
      if (createdSessionId) {
        setAuthMessage('Completing sign in...')
        await setActive?.({ session: createdSessionId })
      } else {
        setIsAuthenticating(false)
      }
    } catch (err) {
      console.error('OAuth error', err)
      setIsAuthenticating(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsAuthenticating(true)
      setAuthMessage('Signing in with Google...')
      
      const redirectUrl = Linking.createURL('/sso-callback')
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
        authSessionOptions: { showInRecents: true },
      })
      
      if (createdSessionId) {
        setAuthMessage('Completing sign in...')
        await setActive?.({ session: createdSessionId })
      } else {
        setIsAuthenticating(false)
      }
    } catch (err) {
      console.error('OAuth error', err)
      setIsAuthenticating(false)
    }
  }

  const handleFacebookSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsAuthenticating(true)
      setAuthMessage('Signing in with Facebook...')
      
      const redirectUrl = Linking.createURL('/sso-callback')
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_facebook',
        redirectUrl,
        authSessionOptions: { showInRecents: true },
      })
      
      if (createdSessionId) {
        setAuthMessage('Completing sign in...')
        await setActive?.({ session: createdSessionId })
      } else {
        setIsAuthenticating(false)
      }
    } catch (err) {
      console.error('OAuth error', err)
      setIsAuthenticating(false)
    }
  }

  const handleRegister = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // TODO: Navigate to register screen
    console.log('Navigate to register')
  }

  const handleForgotPassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // TODO: Navigate to forgot password screen
    console.log('Navigate to forgot password')
  }

  const emailAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emailScale.value }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: inputsShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: inputsShadowOpacity.value * 2,
  }))

  const passwordAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passwordScale.value }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: inputsShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: inputsShadowOpacity.value * 2,
  }))

  const signInAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: signInScale.value }],
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: signInShadowOpacity.value * 0.3,
    shadowRadius: 12,
    elevation: signInShadowOpacity.value * 8,
  }))

  const socialShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: socialShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: socialShadowOpacity.value * 2,
  }))

  const handleEmailPressIn = () => {
    emailScale.value = withSpring(0.98)
  }

  const handleEmailPressOut = () => {
    emailScale.value = withSpring(1)
  }

  const handlePasswordPressIn = () => {
    passwordScale.value = withSpring(0.98)
  }

  const handlePasswordPressOut = () => {
    passwordScale.value = withSpring(1)
  }

  const handleSignInPressIn = () => {
    signInScale.value = withSpring(0.96)
  }

  const handleSignInPressOut = () => {
    signInScale.value = withSpring(1)
  }

  if (isAuthenticating) {
    return <LoadingScreen message={authMessage} />
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8f9fa', '#ffffff', '#f8f9fa']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            {/* Logo and Tagline */}
            <Animated.View
              entering={FadeInUp.duration(800).springify()}
              style={styles.header}
            >
              <Text style={styles.logo}>embodi</Text>
              <Text style={styles.tagline}>
                Training that meets your body where it is
              </Text>
            </Animated.View>

            {/* Email Input */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(800).springify()}
              style={styles.inputWrapper}
            >
              <Pressable
                onPressIn={handleEmailPressIn}
                onPressOut={handleEmailPressOut}
                style={styles.inputPressable}
              >
                <Animated.View
                  style={[
                    styles.inputContainer,
                    emailFocused && styles.inputContainerFocused,
                    emailAnimatedStyle,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={onEmailFocus}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* Password Input */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(800).springify()}
              style={styles.inputWrapper}
            >
              <Pressable
                onPressIn={handlePasswordPressIn}
                onPressOut={handlePasswordPressOut}
                style={styles.inputPressable}
              >
                <Animated.View
                  style={[
                    styles.inputContainer,
                    passwordFocused && styles.inputContainerFocused,
                    passwordAnimatedStyle,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={onPasswordFocus}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* Forgot Password */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(800).springify()}
              style={styles.forgotPasswordContainer}
            >
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>
                  Forgot your password?
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Sign In Button */}
            <Animated.View entering={FadeInDown.delay(500).duration(800).springify()}>
              <Animated.View style={signInAnimatedStyle}>
                <Pressable
                  onPress={handleSignIn}
                  onPressIn={handleSignInPressIn}
                  onPressOut={handleSignInPressOut}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={isLoading ? ['#9ca3af', '#6b7280'] : ['#6366f1', '#4f46e5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInButton}
                  >
                    <Text style={styles.signInButtonText}>
                      {isLoading ? 'Signing in...' : 'Sign in'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </Animated.View>

            {/* Divider */}
            <Animated.View
              entering={FadeInDown.delay(600).duration(800).springify()}
              style={styles.dividerContainer}
            >
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </Animated.View>

            {/* Social Sign In Buttons */}
            <Animated.View
              entering={FadeInDown.delay(700).duration(800).springify()}
              style={styles.socialButtonsContainer}
            >
              <AnimatedTouchableOpacity
                style={[styles.socialButton, socialShadowStyle]}
                onPress={handleAppleSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.socialButtonText}>Apple</Text>
              </AnimatedTouchableOpacity>

              <AnimatedTouchableOpacity
                style={[styles.socialButton, socialShadowStyle]}
                onPress={handleFacebookSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.socialButtonText}>Facebook</Text>
              </AnimatedTouchableOpacity>

              <AnimatedTouchableOpacity
                style={[styles.socialButton, socialShadowStyle]}
                onPress={handleGoogleSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.socialButtonText}>Google</Text>
              </AnimatedTouchableOpacity>
            </Animated.View>

            {/* Register Link */}
            <Animated.View
              entering={FadeInDown.delay(800).duration(800).springify()}
              style={styles.registerContainer}
            >
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.registerText}>
                  Need an account? <Text style={styles.registerLink}>Register</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 8,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
    fontWeight: '400',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputPressable: {
    width: '100%',
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 20,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 8,
  },
  inputContainerFocused: {
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '400',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  signInButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4f46e5',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 12,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  socialButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    height: 56,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 8,
  },
  socialButtonText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  registerContainer: {
    alignItems: 'center',
  },
  registerText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '400',
  },
  registerLink: {
    color: '#6366f1',
    fontWeight: '600',
  },
})
