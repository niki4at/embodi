import { useSSO, useSignIn, useSignUp } from '@clerk/clerk-expo'
import * as Haptics from 'expo-haptics'
import * as Linking from 'expo-linking'
import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmbodiWordmark } from '@/components/ui/embodi-wordmark'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { SocialLogo, type SocialBrand } from '@/components/ui/social-logo'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import LoadingScreen from './loading-screen'
import WelcomeScreen from './welcome-screen'

type Mode = 'welcome' | 'sign-in' | 'sign-up' | 'verify'

const COPY = {
  'sign-in': {
    title: 'Welcome back.',
    tagline: 'Sign in to pick up where you left off.',
    primaryLabel: 'Sign in',
    busyLabel: 'Signing in',
    footerPrompt: 'New to Embody?',
    footerAction: 'Create account',
    footerSwitch: 'sign-up' as const,
  },
  'sign-up': {
    title: 'Create your account.',
    tagline: 'Start a personalized plan in under a minute.',
    primaryLabel: 'Create account',
    busyLabel: 'Creating account',
    footerPrompt: 'Already have an account?',
    footerAction: 'Sign in',
    footerSwitch: 'sign-in' as const,
  },
}

export default function LoginScreen() {
  const { palette } = useTheme()
  const [mode, setMode] = useState<Mode>('welcome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [codeFocused, setCodeFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const { startSSOFlow } = useSSO()
  const { signIn, setActive: setSignInActive } = useSignIn()
  const { signUp, setActive: setSignUpActive } = useSignUp()

  const isSignUp = mode === 'sign-up'
  const copy = isSignUp ? COPY['sign-up'] : COPY['sign-in']

  const goBackToWelcome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setMode('welcome')
    setEmail('')
    setPassword('')
    setCode('')
  }

  const switchMode = (next: Mode) => {
    Haptics.selectionAsync().catch(() => {})
    setMode(next)
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter both email and password.')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsLoading(true)
      setIsAuthenticating(true)
      setAuthMessage('Signing you in')

      const attempt = await signIn?.create({
        identifier: email,
        password,
      })

      if (attempt?.status === 'complete') {
        await setSignInActive?.({ session: attempt.createdSessionId })
      } else {
        Alert.alert('Error', 'Sign in failed. Try again.')
        setIsAuthenticating(false)
      }
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ||
        'Sign in failed. Check your credentials.'
      Alert.alert('Error', message)
      setIsAuthenticating(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter both email and password.')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsLoading(true)

      await signUp?.create({
        emailAddress: email,
        password,
      })

      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' })
      setMode('verify')
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ||
        'Could not create account. Try a different email.'
      Alert.alert('Error', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code) {
      Alert.alert('Missing code', 'Enter the 6-digit code we just emailed you.')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsLoading(true)
      setIsAuthenticating(true)
      setAuthMessage('Confirming your account')

      const attempt = await signUp?.attemptEmailAddressVerification({ code })

      if (attempt?.status === 'complete') {
        await setSignUpActive?.({ session: attempt.createdSessionId })
      } else {
        Alert.alert('Error', 'Could not verify code. Try again.')
        setIsAuthenticating(false)
      }
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ||
        'Verification failed. Check the code and retry.'
      Alert.alert('Error', message)
      setIsAuthenticating(false)
    } finally {
      setIsLoading(false)
    }
  }

  const runSSO = async (
    strategy: 'oauth_apple' | 'oauth_google' | 'oauth_facebook',
    label: string,
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsAuthenticating(true)
      setAuthMessage(`Continuing with ${label}`)

      const redirectUrl = Linking.createURL('/sso-callback')
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl,
        authSessionOptions: { showInRecents: true },
      })

      if (createdSessionId) {
        setAuthMessage('Almost there')
        await setActive?.({ session: createdSessionId })
      } else {
        setIsAuthenticating(false)
      }
    } catch {
      setIsAuthenticating(false)
    }
  }

  if (isAuthenticating) {
    return <LoadingScreen message={authMessage} />
  }

  if (mode === 'welcome') {
    return (
      <WelcomeScreen
        onGetStarted={() => setMode('sign-up')}
        onSignIn={() => setMode('sign-in')}
      />
    )
  }

  if (mode === 'verify') {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: palette.bg }]}
        edges={['top', 'bottom']}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.topBar}>
            <BackButton onPress={() => switchMode('sign-up')} />
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              entering={FadeInUp.duration(motion.duration.base)}
              style={styles.header}
            >
              <EmbodiWordmark size="md" align="left" />
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Check your inbox.
              </Text>
              <Text style={[styles.tagline, { color: palette.textSecondary }]}>
                We sent a 6-digit code to {email}. Enter it below to finish.
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(60).duration(motion.duration.base)}
              style={styles.inputWrapper}
            >
              <Text
                style={[styles.inputLabel, { color: palette.textSecondary }]}
              >
                Verification code
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: palette.surface,
                    borderColor: codeFocused
                      ? palette.primary
                      : palette.borderStrong,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: palette.textPrimary }]}
                  placeholder="123456"
                  placeholderTextColor={palette.textTertiary}
                  value={code}
                  onChangeText={setCode}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(120).duration(motion.duration.base)}
              style={styles.cta}
            >
              <PillButton
                label={isLoading ? 'Verifying' : 'Verify and continue'}
                loading={isLoading}
                onPress={handleVerify}
              />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // Sign-in or sign-up form
  const onPrimaryPress = isSignUp ? handleSignUp : handleSignIn

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <BackButton onPress={goBackToWelcome} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.duration(motion.duration.base)}
            style={styles.header}
          >
            <EmbodiWordmark size="md" align="left" />
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              {copy.title}
            </Text>
            <Text style={[styles.tagline, { color: palette.textSecondary }]}>
              {copy.tagline}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(60).duration(motion.duration.base)}
            style={styles.inputWrapper}
          >
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Email
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: palette.surface,
                  borderColor: emailFocused
                    ? palette.primary
                    : palette.borderStrong,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: palette.textPrimary }]}
                placeholder="you@embodi.app"
                placeholderTextColor={palette.textTertiary}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(120).duration(motion.duration.base)}
            style={styles.inputWrapper}
          >
            <View style={styles.labelRow}>
              <Text
                style={[styles.inputLabel, { color: palette.textSecondary }]}
              >
                Password
              </Text>
              {!isSignUp ? (
                <TouchableOpacity
                  onPress={() =>
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }
                >
                  <Text style={[styles.linkText, { color: palette.primary }]}>
                    Forgot?
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: palette.surface,
                  borderColor: passwordFocused
                    ? palette.primary
                    : palette.borderStrong,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: palette.textPrimary }]}
                placeholder={
                  isSignUp ? 'Pick a strong password' : 'Your password'
                }
                placeholderTextColor={palette.textTertiary}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <Pressable
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={8}
                style={styles.toggleVisibility}
              >
                <Text
                  style={[styles.toggleText, { color: palette.textSecondary }]}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(200).duration(motion.duration.base)}
            style={styles.cta}
          >
            <PillButton
              label={isLoading ? copy.busyLabel : copy.primaryLabel}
              loading={isLoading}
              onPress={onPrimaryPress}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(260).duration(motion.duration.base)}
            style={styles.dividerContainer}
          >
            <View
              style={[styles.divider, { backgroundColor: palette.divider }]}
            />
            <Text style={[styles.dividerText, { color: palette.textTertiary }]}>
              OR CONTINUE WITH
            </Text>
            <View
              style={[styles.divider, { backgroundColor: palette.divider }]}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(motion.duration.base)}
            style={styles.socialRow}
          >
            <SocialButton
              brand="apple"
              label="Apple"
              onPress={() => runSSO('oauth_apple', 'Apple')}
            />
            <SocialButton
              brand="google"
              label="Google"
              onPress={() => runSSO('oauth_google', 'Google')}
            />
            <SocialButton
              brand="facebook"
              label="Facebook"
              onPress={() => runSSO('oauth_facebook', 'Facebook')}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(360).duration(motion.duration.base)}
            style={styles.registerContainer}
          >
            <Text
              style={[styles.registerText, { color: palette.textSecondary }]}
            >
              {copy.footerPrompt}{' '}
              <Text
                style={[styles.registerLink, { color: palette.primary }]}
                onPress={() => switchMode(copy.footerSwitch)}
              >
                {copy.footerAction}
              </Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

interface BackButtonProps {
  onPress: () => void
}

function BackButton({ onPress }: BackButtonProps) {
  const { palette } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.backButton,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <IconSymbol
        name="chevron.left"
        size={20}
        color={palette.textPrimary}
      />
    </Pressable>
  )
}

interface SocialButtonProps {
  brand: SocialBrand
  label: string
  onPress: () => void
}

function SocialButton({ brand, label, onPress }: SocialButtonProps) {
  const { palette } = useTheme()
  return (
    <TouchableOpacity
      style={[
        styles.socialButton,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
    >
      <SocialLogo brand={brand} size={22} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.lg,
  },
  tagline: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  inputWrapper: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  inputLabel: {
    ...typography.smallStrong,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 58,
  },
  input: {
    ...typography.body,
    flex: 1,
  },
  toggleVisibility: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  toggleText: {
    ...typography.smallStrong,
  },
  linkText: {
    ...typography.smallStrong,
  },
  cta: {
    marginTop: spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxl,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    ...typography.caption,
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  socialButton: {
    flex: 1,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  registerText: {
    ...typography.body,
    textAlign: 'center',
  },
  registerLink: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
})
