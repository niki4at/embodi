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
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        entering={SlideInDown.springify()}
        exiting={SlideOutDown}
        style={[
          styles.panel,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <View style={styles.panelHandle} />
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Science-backed facts</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {facts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                No health insights yet
              </Text>
              <Text style={styles.emptySubtitle}>
                I am still gathering evidence-backed guidance for your profile.
                Check back after your next session.
              </Text>
            </View>
          ) : (
            facts.map((fact, index) => (
              <View key={`fact-${index}`} style={styles.factBlock}>
                <Text style={styles.factText}>{fact.text}</Text>
                {fact.citations.map((citation) => (
                  <TouchableOpacity
                    key={citation.id}
                    onPress={() => Linking.openURL(citation.url)}
                    style={styles.citation}
                  >
                    <Text style={styles.citationTitle}>
                      {citation.title}
                    </Text>
                    <Text style={styles.citationMeta}>
                      {citation.authors.slice(0, 2).join(', ')}
                      {citation.authors.length > 2 ? ' et al.' : ''} ·{' '}
                      {citation.year}
                    </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    maxHeight: '70%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    marginBottom: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  factBlock: {
    marginBottom: 20,
  },
  factText: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  citation: {
    borderLeftWidth: 2,
    borderLeftColor: '#38bdf8',
    paddingLeft: 10,
    marginBottom: 6,
  },
  citationTitle: {
    color: '#bae6fd',
    fontWeight: '600',
    fontSize: 13,
  },
  citationMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 18,
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
})

