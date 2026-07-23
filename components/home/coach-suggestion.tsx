import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

type Recommendation = {
  title: string
  durationMin: number
  moveCount: number
  modality: string
  description: string
  reasoning: string
  tags: string[]
}

type InsightShape = {
  status: 'generating' | 'ready' | 'failed'
  alignedRecommendations: Recommendation[]
  explorationRecommendations: Recommendation[]
} | null

/**
 * One short coach suggestion under the start experience. Tapping routes
 * through today's check-in with the recommendation as the seed, keeping the
 * rule that every session builds on today's state.
 */
export function CoachSuggestion() {
  const { palette } = useTheme()
  const insight = useQuery(api.weeklyInsights.getCurrentWeekInsight) as
    | InsightShape
    | undefined

  const rec =
    insight && insight.status === 'ready'
      ? (insight.alignedRecommendations[0] ??
        insight.explorationRecommendations[0] ??
        null)
      : null
  const source =
    insight && insight.status === 'ready' && insight.alignedRecommendations[0]
      ? 'aligned'
      : 'exploration'

  const handlePress = useCallback(async () => {
    if (!rec) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const seed = {
      title: rec.title,
      modality: rec.modality,
      durationMin: rec.durationMin,
      moveCount: rec.moveCount,
      description: rec.description,
      reasoning: rec.reasoning,
      tags: rec.tags,
      source,
    }
    router.push({
      pathname: '/checkin',
      params: { rec: JSON.stringify(seed) },
    } as unknown as Href)
  }, [rec, source])

  if (!rec) return null

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Coach suggests ${rec.title}, ${rec.durationMin} minutes. Starts with a quick check-in.`}
      style={[
        styles.chip,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: palette.primaryMuted }]}>
        <IconSymbol name="wand.and.stars" size={14} color={palette.primary} />
      </View>
      <Text
        style={[styles.text, { color: palette.textSecondary }]}
        numberOfLines={1}
      >
        Coach suggests{' '}
        <Text style={{ color: palette.textPrimary }}>{rec.title}</Text> ·{' '}
        {rec.durationMin} min
      </Text>
      <IconSymbol name="chevron.right" size={14} color={palette.textTertiary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.small,
    flex: 1,
  },
})
