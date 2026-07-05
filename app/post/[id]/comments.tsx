import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { timeAgo } from '@/utils/timeAgo'

type CommentRow = {
  _id: Id<'comments'>
  text: string
  createdAt: number
  author: {
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    isPrivate: boolean
  } | null
  isMine: boolean
}

export default function PostCommentsScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<{ id?: string }>()
  const postId =
    typeof params.id === 'string' ? (params.id as Id<'posts'>) : undefined

  const post = useQuery(api.social.getPost, postId ? { postId } : 'skip')
  const myProfile = useQuery(api.profiles.getMyProfile)
  const addComment = useMutation(api.social.addComment)
  const deleteComment = useMutation(api.social.deleteComment)

  const {
    results: comments,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.social.listComments,
    postId ? { postId } : 'skip',
    { initialNumItems: 20 }
  )

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !postId || sending) return
    setSending(true)
    try {
      await addComment({ postId, text })
      setDraft('')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (error) {
      Alert.alert(
        'Could not comment',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again.'
      )
    } finally {
      setSending(false)
    }
  }

  const confirmDeleteComment = (commentId: Id<'comments'>) => {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteComment({ commentId }).catch(() => {})
        },
      },
    ])
  }

  const author = post?.type === 'repost' ? post.original?.author : post?.author
  const workoutTitle =
    (post?.type === 'repost' ? post.original?.workout : post?.workout)?.title ??
    null

  const renderComment = ({ item }: { item: CommentRow }) => (
    <Pressable
      onLongPress={() => {
        if (item.isMine || post?.author?.userId === myProfile?.userId) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          confirmDeleteComment(item._id)
        }
      }}
      style={styles.commentRow}
    >
      <Pressable
        onPress={() => {
          if (item.author) {
            router.push({
              pathname: '/u/[username]',
              params: { username: item.author.username },
            })
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.author?.displayName ?? 'profile'}`}
      >
        <Avatar
          url={item.author?.avatarUrl}
          name={item.author?.displayName ?? '?'}
          size={32}
        />
      </Pressable>
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Text
            style={[typography.smallStrong, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {item.author?.displayName ?? 'Unknown'}
          </Text>
          <Text style={[typography.small, { color: palette.textTertiary }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        <Text style={[typography.body, { color: palette.textPrimary }]}>
          {item.text}
        </Text>
      </View>
    </Pressable>
  )

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol
            name="chevron.left"
            size={22}
            color={palette.textPrimary}
          />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[typography.h3, { color: palette.textPrimary }]}>
            Comments
          </Text>
          {author ? (
            <Text
              style={[typography.small, { color: palette.textTertiary }]}
              numberOfLines={1}
            >
              {author.displayName}
              {workoutTitle ? ` \u00b7 ${workoutTitle}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 22 }} />
      </View>

      {post === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : post === null ? (
        <View style={styles.centered}>
          <Text style={[typography.body, { color: palette.textSecondary }]}>
            This post is not available.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            data={comments as CommentRow[]}
            keyExtractor={(item) => String(item._id)}
            renderItem={renderComment}
            ListEmptyComponent={
              <Text
                style={[
                  typography.small,
                  styles.emptyComments,
                  { color: palette.textTertiary },
                ]}
              >
                Be the first to say something encouraging.
              </Text>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (status === 'CanLoadMore') loadMore(20)
            }}
          />

          <View
            style={[
              styles.composer,
              { backgroundColor: palette.bg, borderTopColor: palette.divider },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment"
              placeholderTextColor={palette.textTertiary}
              multiline
              maxLength={500}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              style={[
                styles.sendButton,
                {
                  backgroundColor: draft.trim()
                    ? palette.primary
                    : palette.surfaceAlt,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
            >
              <IconSymbol
                name="arrow.up"
                size={17}
                color={draft.trim() ? '#FFFFFF' : palette.textTertiary}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  emptyComments: {
    marginTop: spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    ...typography.body,
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    maxHeight: 110,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
