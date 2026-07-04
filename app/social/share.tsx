import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WorkoutStatCard } from '@/components/social/workout-stat-card'
import type { PostWorkout } from '@/components/social/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { compressAndUploadPhoto } from '@/utils/photoUpload'

const MAX_PHOTOS = 5

type ShareParams = {
  sessionId?: string
  communityId?: string
}

export default function ShareComposerScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<ShareParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined
  const communityId =
    typeof params.communityId === 'string' && params.communityId.length > 0
      ? (params.communityId as Id<'communities'>)
      : undefined

  const insights = useQuery(
    api.sessionInsights.getSessionInsights,
    sessionId ? { sessionId } : 'skip'
  )
  const myProfile = useQuery(api.profiles.getMyProfile)
  const generateUploadUrl = useMutation(api.social.generatePostPhotoUploadUrl)
  const createPost = useMutation(api.social.createPost)

  const [title, setTitle] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [visibility, setVisibility] = useState<'public' | 'backers'>('public')
  const [posting, setPosting] = useState(false)

  const effectiveTitle = title ?? insights?.goal ?? ''

  // Live preview: exactly the snapshot the backend will store.
  const previewWorkout = useMemo<PostWorkout | null>(() => {
    if (!insights) return null
    return {
      title: effectiveTitle || insights.goal,
      modality: insights.modality,
      durationMin: insights.durationMin,
      totalVolumeKg: insights.totalVolumeKg,
      totalReps: insights.totalReps,
      totalDistanceM: insights.totalDistanceM,
      exercisesCompleted: insights.exercisesCompleted,
      workingSets: insights.workingSetsLogged,
      avgRpe: insights.avgRpe,
      bodyParts: insights.bodyParts,
      highlights: insights.highlights.slice(0, 3),
      dateMs: insights.dateMs,
    }
  }, [insights, effectiveTitle])

  const addPhotos = async (source: 'camera' | 'library') => {
    Haptics.selectionAsync()
    const remaining = MAX_PHOTOS - photoUris.length
    if (remaining <= 0) return

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
          })
    if (result.canceled) return
    const uris = result.assets.slice(0, remaining).map((a) => a.uri)
    setPhotoUris((prev) => [...prev, ...uris])
  }

  const removePhoto = (uri: string) => {
    Haptics.selectionAsync()
    setPhotoUris((prev) => prev.filter((u) => u !== uri))
  }

  const handlePost = async () => {
    if (!sessionId || posting || !insights) return
    setPosting(true)
    try {
      const storageIds: Id<'_storage'>[] = []
      for (const uri of photoUris) {
        const id = await compressAndUploadPhoto(uri, () =>
          generateUploadUrl({})
        )
        storageIds.push(id as Id<'_storage'>)
      }
      await createPost({
        sessionId,
        title: effectiveTitle || undefined,
        caption: caption.trim() || undefined,
        photoStorageIds: storageIds,
        visibility,
        communityId,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not share',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again in a moment.'
      )
      setPosting(false)
    }
  }

  if (!sessionId) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
        edges={['top', 'bottom']}
      >
        <Text style={[typography.body, { color: palette.danger }]}>
          Missing session.
        </Text>
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
            Share your workout
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {insights === undefined ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : insights === null || previewWorkout === null ? (
          <View style={styles.centered}>
            <Text style={[typography.body, { color: palette.textSecondary }]}>
              Workout not available.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
              <Text style={[styles.previewLabel, { color: palette.textTertiary }]}>
                {photoUris.length > 0
                  ? 'YOUR STATS RIDE ALONG WITH THE PHOTOS'
                  : 'HOW BACKERS WILL SEE IT'}
              </Text>
              <WorkoutStatCard workout={previewWorkout} />
            </Animated.View>

            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Title
            </Text>
            <TextInput
              value={effectiveTitle}
              onChangeText={setTitle}
              placeholder="Name this session"
              placeholderTextColor={palette.textTertiary}
              maxLength={80}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />

            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Photos
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {photoUris.map((uri) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image
                    source={{ uri }}
                    style={styles.photo}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => removePhoto(uri)}
                    style={[styles.photoRemove, { backgroundColor: palette.black }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <IconSymbol name="xmark" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photoUris.length < MAX_PHOTOS ? (
                <>
                  <Pressable
                    onPress={() => addPhotos('camera')}
                    style={[
                      styles.photoAdd,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo"
                  >
                    <IconSymbol
                      name="camera.fill"
                      size={22}
                      color={palette.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => addPhotos('library')}
                    style={[
                      styles.photoAdd,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose from library"
                  >
                    <IconSymbol
                      name="photo.on.rectangle"
                      size={22}
                      color={palette.textSecondary}
                    />
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
            <Text style={[styles.fieldHint, { color: palette.textTertiary }]}>
              Up to {MAX_PHOTOS} photos
            </Text>

            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Caption
            </Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="How did it feel?"
              placeholderTextColor={palette.textTertiary}
              multiline
              maxLength={500}
              style={[
                styles.input,
                styles.captionInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />

            <View
              style={[
                styles.spotifyRow,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <View
                style={[styles.spotifyIcon, { backgroundColor: palette.surfaceAlt }]}
              >
                <IconSymbol
                  name="music.note"
                  size={18}
                  color={palette.textTertiary}
                />
              </View>
              <View style={styles.spotifyText}>
                <Text
                  style={[styles.spotifyTitle, { color: palette.textTertiary }]}
                >
                  Add your soundtrack
                </Text>
                <Text
                  style={[styles.spotifySubtitle, { color: palette.textTertiary }]}
                >
                  Spotify is coming soon
                </Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Who can see it
            </Text>
            <View style={styles.visibilityRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync()
                  setVisibility('public')
                }}
                style={[
                  styles.visibilityOption,
                  {
                    backgroundColor:
                      visibility === 'public'
                        ? palette.primaryMuted
                        : palette.surface,
                    borderColor:
                      visibility === 'public' ? palette.primary : palette.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Share publicly"
              >
                <IconSymbol
                  name="globe"
                  size={18}
                  color={
                    visibility === 'public'
                      ? palette.primary
                      : palette.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.visibilityLabel,
                    {
                      color:
                        visibility === 'public'
                          ? palette.primary
                          : palette.textPrimary,
                    },
                  ]}
                >
                  Public
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync()
                  setVisibility('backers')
                }}
                style={[
                  styles.visibilityOption,
                  {
                    backgroundColor:
                      visibility === 'backers'
                        ? palette.primaryMuted
                        : palette.surface,
                    borderColor:
                      visibility === 'backers' ? palette.primary : palette.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Share with backers only"
              >
                <IconSymbol
                  name="person.2.fill"
                  size={18}
                  color={
                    visibility === 'backers'
                      ? palette.primary
                      : palette.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.visibilityLabel,
                    {
                      color:
                        visibility === 'backers'
                          ? palette.primary
                          : palette.textPrimary,
                    },
                  ]}
                >
                  Backers only
                </Text>
              </Pressable>
            </View>

            {myProfile ? (
              <Text style={[styles.postingAs, { color: palette.textTertiary }]}>
                Posting as @{myProfile.username}
              </Text>
            ) : null}

            <View style={styles.postButton}>
              <PillButton
                label={posting ? 'Sharing…' : 'Share workout'}
                onPress={handlePost}
                disabled={posting}
                loading={posting}
              />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  previewLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.smallStrong,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
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
  captionInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  photoRow: {
    gap: spacing.md,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xl,
    opacity: 0.75,
  },
  spotifyIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyText: { flex: 1 },
  spotifyTitle: {
    ...typography.bodyStrong,
  },
  spotifySubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
  },
  visibilityLabel: {
    ...typography.bodyStrong,
  },
  postingAs: {
    ...typography.small,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  postButton: {
    marginTop: spacing.lg,
  },
})
