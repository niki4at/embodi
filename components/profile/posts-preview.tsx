import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import type { Id } from '@/convex/_generated/dataModel'

export interface PostPreview {
  _id: Id<'posts'>
  photoUrl: string | null
  title: string
  createdAt: number
}

/** Compact grid of the user's latest posts; each tile opens the post. */
export function PostsPreview({ posts }: { posts: PostPreview[] }) {
  const { palette } = useTheme()

  const handleOpen = useCallback((postId: Id<'posts'>) => {
    Haptics.selectionAsync()
    router.push({
      pathname: '/post/[id]',
      params: { id: String(postId) },
    } as unknown as Href)
  }, [])

  return (
    <View style={styles.grid}>
      {posts.map((post) => (
        <TouchableOpacity
          key={post._id}
          onPress={() => handleOpen(post._id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open post: ${post.title}`}
          style={[
            styles.tile,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          {post.photoUrl ? (
            <Image
              source={{ uri: post.photoUrl }}
              style={styles.photo}
              contentFit="cover"
              transition={120}
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[styles.placeholder, { backgroundColor: palette.surfaceAlt }]}
            >
              <IconSymbol
                name="figure.strengthtraining.traditional"
                size={22}
                color={palette.textTertiary}
              />
            </View>
          )}
          <Text
            style={[styles.title, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {post.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '30.5%',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: spacing.xs,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.small,
    fontSize: 11,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
})
