import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { compressAndUploadPhoto } from '@/utils/photoUpload'

export default function EditProfileScreen() {
  const { palette } = useTheme()
  const profile = useQuery(api.profiles.getMyProfile)
  const updateProfile = useMutation(api.profiles.updateProfile)
  const generateAvatarUploadUrl = useMutation(
    api.profiles.generateAvatarUploadUrl
  )

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [debouncedUsername, setDebouncedUsername] = useState('')

  useEffect(() => {
    if (profile && !hydrated) {
      setDisplayName(profile.displayName)
      setUsername(profile.username)
      setBio(profile.bio ?? '')
      setIsPrivate(profile.isPrivate)
      setHydrated(true)
    }
  }, [profile, hydrated])

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedUsername(username.trim().toLowerCase()),
      350
    )
    return () => clearTimeout(timeout)
  }, [username])

  const usernameChanged =
    profile != null && debouncedUsername !== profile.username
  const availability = useQuery(
    api.profiles.checkUsernameAvailable,
    usernameChanged && debouncedUsername.length >= 3
      ? { username: debouncedUsername }
      : 'skip'
  )

  const handlePickAvatar = async () => {
    Haptics.selectionAsync()
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    })
    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!profile || saving) return
    if (usernameChanged && availability && !availability.available) {
      Alert.alert('Handle unavailable', availability.reason ?? 'Try another')
      return
    }
    setSaving(true)
    try {
      let avatarStorageId: Id<'_storage'> | undefined
      if (localAvatarUri) {
        avatarStorageId = (await compressAndUploadPhoto(
          localAvatarUri,
          () => generateAvatarUploadUrl({})
        )) as Id<'_storage'>
      }
      await updateProfile({
        displayName: displayName.trim() || undefined,
        bio,
        isPrivate,
        username: usernameChanged ? debouncedUsername : undefined,
        avatarStorageId,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again in a moment.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.bg }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <IconSymbol name="xmark" size={22} color={palette.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
            Edit profile
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={handlePickAvatar}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <Avatar
              url={localAvatarUri ?? profile.avatarUrl}
              name={displayName || profile.displayName}
              size={96}
            />
            <View
              style={[
                styles.avatarBadge,
                {
                  backgroundColor: palette.primary,
                  borderColor: palette.bg,
                },
              ]}
            >
              <IconSymbol name="camera.fill" size={14} color="#FFFFFF" />
            </View>
          </Pressable>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Name
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={palette.textTertiary}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.textPrimary,
              },
            ]}
            maxLength={50}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Handle
          </Text>
          <TextInput
            value={username}
            onChangeText={(text) =>
              setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            placeholder="yourhandle"
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.textPrimary,
              },
            ]}
            maxLength={20}
          />
          {usernameChanged && availability ? (
            <Text
              style={[
                styles.fieldHint,
                {
                  color: availability.available
                    ? palette.success
                    : palette.danger,
                },
              ]}
            >
              {availability.available
                ? `@${debouncedUsername} is available`
                : (availability.reason ?? 'That handle is taken')}
            </Text>
          ) : (
            <Text style={[styles.fieldHint, { color: palette.textTertiary }]}>
              You can change your handle once every 14 days
            </Text>
          )}

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="A line about how you move"
            placeholderTextColor={palette.textTertiary}
            multiline
            style={[
              styles.input,
              styles.bioInput,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.textPrimary,
              },
            ]}
            maxLength={160}
          />

          <View
            style={[
              styles.privateRow,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View
              style={[styles.privateIcon, { backgroundColor: palette.surfaceAlt }]}
            >
              <IconSymbol
                name={isPrivate ? 'lock.fill' : 'globe'}
                size={18}
                color={palette.textPrimary}
              />
            </View>
            <View style={styles.privateText}>
              <Text style={[styles.privateTitle, { color: palette.textPrimary }]}>
                Private account
              </Text>
              <Text
                style={[styles.privateSubtitle, { color: palette.textSecondary }]}
              >
                New backers need your approval and only backers see your posts
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={(next) => {
                Haptics.selectionAsync()
                setIsPrivate(next)
              }}
              trackColor={{ false: palette.surfaceAlt, true: palette.primary }}
              thumbColor={palette.white}
              ios_backgroundColor={palette.surfaceAlt}
            />
          </View>

          <View style={styles.saveWrap}>
            <PillButton
              label={saving ? 'Saving…' : 'Save changes'}
              onPress={handleSave}
              disabled={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginVertical: spacing.xl,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    ...typography.smallStrong,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  fieldHint: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  input: {
    ...typography.body,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xxl,
  },
  privateIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateText: { flex: 1 },
  privateTitle: {
    ...typography.bodyStrong,
  },
  privateSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  saveWrap: {
    marginTop: spacing.xxl,
  },
})
