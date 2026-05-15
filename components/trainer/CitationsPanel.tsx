import React from 'react'
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { Fact } from './types'

type CitationsPanelProps = {
  visible: boolean
  facts: Fact[]
  onClose: () => void
}

export default function CitationsPanel({
  visible,
  facts,
  onClose,
}: CitationsPanelProps) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        entering={SlideInDown.duration(280).easing(
          Easing.bezier(0.22, 1, 0.36, 1),
        )}
        exiting={SlideOutDown.duration(220).easing(
          Easing.bezier(0.4, 0, 1, 1),
        )}
        style={[
          styles.panel,
          shadows.lg,
          {
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            backgroundColor: palette.bgElevated,
            borderColor: palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.panelHandle,
            { backgroundColor: palette.borderStrong },
          ]}
        />
        <View style={styles.panelHeader}>
          <View>
            <Text style={[styles.panelTitle, { color: palette.textPrimary }]}>
              Science behind your session
            </Text>
            <Text
              style={[styles.panelSubtitle, { color: palette.textSecondary }]}
            >
              Sources we used to design today
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            hitSlop={12}
          >
            <IconSymbol name="xmark" size={18} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {facts.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                name="book.closed"
                size={26}
                color={palette.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                No insights yet
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: palette.textSecondary }]}
              >
                I&apos;m still gathering evidence-backed guidance for your
                profile. Check back after your next session.
              </Text>
            </View>
          ) : (
            facts.map((fact, index) => (
              <View key={`fact-${index}`} style={styles.factBlock}>
                <Text style={[styles.factText, { color: palette.textPrimary }]}>
                  {fact.text}
                </Text>
                {fact.citations.map(citation => (
                  <TouchableOpacity
                    key={citation.id}
                    onPress={() => Linking.openURL(citation.url)}
                    style={[
                      styles.citation,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.citationLeft,
                        { backgroundColor: palette.primary },
                      ]}
                    />
                    <View style={styles.citationContent}>
                      <Text
                        style={[
                          styles.citationTitle,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {citation.title}
                      </Text>
                      <Text
                        style={[
                          styles.citationMeta,
                          { color: palette.textTertiary },
                        ]}
                      >
                        {citation.authors.slice(0, 2).join(', ')}
                        {citation.authors.length > 2 ? ' et al.' : ''} ·{' '}
                        {citation.year}
                      </Text>
                    </View>
                    <IconSymbol
                      name="arrow.up.right"
                      size={14}
                      color={palette.primary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    maxHeight: '76%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  panelTitle: {
    ...typography.h2,
  },
  panelSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  factBlock: {
    marginBottom: spacing.xl,
  },
  factText: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  citation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  citationLeft: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  citationContent: {
    flex: 1,
  },
  citationTitle: {
    ...typography.smallStrong,
  },
  citationMeta: {
    ...typography.small,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.small,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
})
