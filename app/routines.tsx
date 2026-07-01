import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export default function RoutinesScreen() {
  const { palette, resolved, shadows } = useTheme()
  const routines = useQuery(api.routines.listRoutines)
  const startSessionFromRoutine = useMutation(
    api.routines.startSessionFromRoutine,
  )
  const renameRoutine = useMutation(api.routines.renameRoutine)
  const deleteRoutine = useMutation(api.routines.deleteRoutine)

  const [startingId, setStartingId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{
    id: Id<'workout_routines'>
    name: string
  } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [])

  const handleStart = useCallback(
    async (id: Id<'workout_routines'>) => {
      if (startingId) return
      setStartingId(id)
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        const sessionId = await startSessionFromRoutine({ routineId: id })
        router.replace({
          pathname: '/session',
          params: { sessionId: String(sessionId) },
        } as unknown as Href)
      } catch (error) {
        console.error('start routine error', error)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setStartingId(null)
      }
    },
    [startingId, startSessionFromRoutine],
  )

  const openRename = useCallback(
    (id: Id<'workout_routines'>, name: string) => {
      Haptics.selectionAsync()
      setRenameTarget({ id, name })
      setRenameValue(name)
    },
    [],
  )

  const handleRename = useCallback(async () => {
    if (!renameTarget || isRenaming) return
    const name = renameValue.trim()
    if (!name) return
    setIsRenaming(true)
    try {
      await renameRoutine({ routineId: renameTarget.id, name })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setRenameTarget(null)
    } catch (error) {
      console.error('rename routine error', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsRenaming(false)
    }
  }, [renameTarget, isRenaming, renameValue, renameRoutine])

  const handleDelete = useCallback(
    (id: Id<'workout_routines'>, name: string) => {
      Haptics.selectionAsync()
      Alert.alert(
        'Delete routine',
        `Remove "${name}" from your routines? This can't be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteRoutine({ routineId: id }).catch((error) => {
                console.error('delete routine error', error)
              })
            },
          },
        ],
      )
    },
    [deleteRoutine],
  )

  const isLoading = routines === undefined
  const isEmpty = !isLoading && routines.length === 0

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconSymbol
            name="arrow.left"
            size={18}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
      </View>

      <Animated.View
        entering={FadeInUp.duration(motion.duration.base)}
        style={styles.titleBlock}
      >
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Your routines
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Saved workouts you can run again anytime.
        </Text>
      </Animated.View>

      {isLoading && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      )}

      {isEmpty && (
        <Animated.View
          entering={FadeInDown.duration(motion.duration.base)}
          style={[
            styles.emptyCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: palette.primaryMuted }]}>
            <IconSymbol name="bookmark" size={28} color={palette.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
            No routines yet
          </Text>
          <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
            Finish a workout, then tap &quot;Save as routine&quot; on the recap
            to keep it here.
          </Text>
        </Animated.View>
      )}

      {!isLoading && !isEmpty && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {routines.map((routine, index) => (
            <Animated.View
              key={routine._id}
              entering={FadeInDown.delay(index * 40).duration(
                motion.duration.base,
              )}
            >
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Pressable
                  style={styles.cardMain}
                  onPress={() => handleStart(routine._id)}
                  disabled={startingId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${routine.name}`}
                >
                  <View
                    style={[
                      styles.cardIcon,
                      { backgroundColor: palette.primaryMuted },
                    ]}
                  >
                    {startingId === routine._id ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <IconSymbol
                        name="repeat"
                        size={20}
                        color={palette.primary}
                      />
                    )}
                  </View>
                  <View style={styles.cardText}>
                    <Text
                      style={[styles.cardTitle, { color: palette.textPrimary }]}
                      numberOfLines={1}
                    >
                      {routine.name}
                    </Text>
                    <Text
                      style={[styles.cardMeta, { color: palette.textSecondary }]}
                      numberOfLines={1}
                    >
                      {routine.modality} {'\u00b7'} {routine.exerciseCount}{' '}
                      {routine.exerciseCount === 1 ? 'move' : 'moves'} {'\u00b7'}{' '}
                      {routine.durationMin} min
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => openRename(routine._id, routine.name)}
                    hitSlop={8}
                    style={styles.actionButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${routine.name}`}
                  >
                    <IconSymbol
                      name="square.and.pencil"
                      size={18}
                      color={palette.textTertiary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(routine._id, routine.name)}
                    hitSlop={8}
                    style={styles.actionButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${routine.name}`}
                  >
                    <IconSymbol
                      name="trash"
                      size={18}
                      color={palette.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          ))}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}

      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setRenameTarget(null)}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
              Rename routine
            </Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Routine name"
              placeholderTextColor={palette.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
              maxLength={60}
              style={[
                styles.modalInput,
                {
                  color: palette.textPrimary,
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setRenameTarget(null)}
                style={styles.modalCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text
                  style={[styles.modalCancelText, { color: palette.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRename}
                disabled={isRenaming || renameValue.trim().length === 0}
                style={[
                  styles.modalSave,
                  {
                    backgroundColor: palette.primary,
                    opacity:
                      isRenaming || renameValue.trim().length === 0 ? 0.5 : 1,
                  },
                  resolved === 'dark' ? shadows.primaryDark : shadows.primary,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Save name"
              >
                {isRenaming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  centerBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodyStrong,
  },
  cardMeta: {
    ...typography.small,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginHorizontal: spacing.xl,
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h2,
  },
  emptyBody: {
    ...typography.small,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: spacing.huge,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
  },
  modalInput: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalCancel: {
    height: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    ...typography.button,
  },
  modalSave: {
    height: 44,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    ...typography.button,
    color: '#FFFFFF',
  },
})
