import { useAction, useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import {
  BODY_GROUP_LABELS,
  ICON_BY_MODALITY,
  type BodyGroup,
  type ExerciseEntry,
  type ExerciseModality,
} from '@/constants/exercise-catalog'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type ScanMatch = {
  entry: ExerciseEntry
  confidence: number
  reason: string
}

type SuggestedCustom = {
  name: string
  group: string
  bodyPart: string
  modality: string
  equipment: string[]
}

type Phase = 'recognizing' | 'results' | 'error'

interface ScanEquipmentProps {
  /** Merged catalog + custom exercises used to resolve recognised matches. */
  catalog: ExerciseEntry[]
  /** Forward a chosen exercise into the active add/swap/build flow. */
  onSelectExercise?: (exercise: ExerciseEntry) => void
  /** Ids already chosen, so matched rows can show a selected state. */
  selectedIds?: Set<string>
}

export function ScanEquipment({
  catalog,
  onSelectExercise,
  selectedIds,
}: ScanEquipmentProps) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  const generateUploadUrl = useMutation(api.exerciseRecognition.generateUploadUrl)
  const recognize = useAction(api.exerciseRecognition.recognizeExerciseFromImage)
  const createCustom = useMutation(api.exercises.createCustomExercise)

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('recognizing')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [equipmentLabel, setEquipmentLabel] = useState('')
  const [matches, setMatches] = useState<ScanMatch[]>([])
  const [customs, setCustoms] = useState<SuggestedCustom[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null)

  const closeSheet = () => {
    setOpen(false)
    setPreviewUri(null)
    setMatches([])
    setCustoms([])
    setEquipmentLabel('')
    setErrorMessage(null)
    setCreatingIndex(null)
  }

  const runRecognition = async (uri: string) => {
    setPreviewUri(uri)
    setPhase('recognizing')
    setErrorMessage(null)
    setOpen(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const fileResponse = await fetch(uri)
      const blob = await fileResponse.blob()
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      })
      if (!result.ok) {
        throw new Error('upload failed')
      }
      const { storageId } = (await result.json()) as { storageId: string }

      const compactCatalog = catalog.map((ex) => ({
        id: ex.id,
        name: ex.name,
        bodyPart: ex.bodyPart,
        equipment: ex.equipment,
        modality: ex.modality,
        group: ex.group,
      }))

      const recognition = await recognize({
        imageId: storageId as Id<'_storage'>,
        catalog: compactCatalog,
      })

      const byId = new Map(catalog.map((ex) => [ex.id, ex]))
      const resolvedMatches: ScanMatch[] = recognition.matches
        .map((m) => {
          const entry = byId.get(m.catalogId)
          if (!entry) return null
          return { entry, confidence: m.confidence, reason: m.reason }
        })
        .filter((m): m is ScanMatch => m !== null)

      setEquipmentLabel(recognition.equipmentLabel)
      setMatches(resolvedMatches)
      setCustoms(recognition.suggestedCustoms)
      setPhase('results')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      console.error('exercise recognition', error)
      setErrorMessage(
        'Could not read that photo. Check your connection and try again.',
      )
      setPhase('error')
    }
  }

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        'Photos access needed',
        'Allow photo access in Settings to pick a picture of your equipment.',
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      await runRecognition(result.assets[0].uri)
    }
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access to scan the machine in front of you, or pick a photo from your library instead.',
        [
          {
            text: 'Choose from library',
            onPress: () => void pickFromLibrary(),
          },
          { text: 'OK', style: 'cancel' },
        ],
      )
      return
    }
    // Open the rear camera straight away so the user can shoot the machine
    // in front of them. On web this maps to capture="environment".
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      quality: 0.6,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      await runRecognition(result.assets[0].uri)
    }
  }

  const handleScanPress = async () => {
    await Haptics.selectionAsync()
    // Camera-first: jump straight into the camera. Gallery stays available as
    // a fallback (camera unavailable / permission denied, and from the results
    // empty state).
    await takePhoto()
  }

  const handlePickMatch = (entry: ExerciseEntry) => {
    // Select first, then haptic — awaiting haptics before the callback can
    // drop the add if vibration is slow/unavailable on web.
    onSelectExercise?.(entry)
    void Haptics.selectionAsync()
  }

  // Prefer the live parent selection set; fall back to empty so rows always
  // render a determinate selected state after a tap.
  const selected = useMemo(
    () => selectedIds ?? new Set<string>(),
    [selectedIds],
  )

  const handleCreateCustom = async (custom: SuggestedCustom, index: number) => {
    if (creatingIndex !== null) return
    setCreatingIndex(index)
    try {
      const group = custom.group as BodyGroup
      const modality = custom.modality as ExerciseModality
      const newId = await createCustom({
        name: custom.name,
        group,
        bodyPart: custom.bodyPart || BODY_GROUP_LABELS[group],
        modality,
        equipment: custom.equipment,
      })
      onSelectExercise?.({
        id: `custom-${newId}`,
        name: custom.name,
        group,
        bodyPart: custom.bodyPart || BODY_GROUP_LABELS[group],
        equipment: custom.equipment.join(', ') || 'None',
        modality,
        iconName: ICON_BY_MODALITY[modality],
      })
      // Drop the suggestion so it isn't created twice.
      setCustoms((prev) => prev.filter((_, i) => i !== index))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      console.error('create custom from scan', error)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setCreatingIndex(null)
    }
  }

  const confidenceLabel = (confidence: number) => {
    if (confidence >= 0.66) return 'Strong match'
    if (confidence >= 0.4) return 'Likely'
    return 'Possible'
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleScanPress}
        onLongPress={() => void pickFromLibrary()}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Scan equipment with your camera. Long press to pick from your library."
        style={[
          styles.scanButton,
          { backgroundColor: palette.primary },
        ]}
      >
        <IconSymbol name="camera.fill" size={20} color={palette.white} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.overlay}>
          {/* Absolute backdrop so it never steals layout space from the sheet
              or sit on top of the match rows (flex:1 sibling was broken on web). */}
          <Pressable
            style={styles.backdrop}
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Dismiss scan results"
          />
          <View
            style={[
              styles.sheet,
              shadows.lg,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.border,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
              phase === 'results' ? styles.sheetResults : null,
            ]}
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: palette.borderStrong },
              ]}
            />

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: palette.textPrimary }]}>
                  {phase === 'recognizing'
                    ? 'Scanning your photo'
                    : phase === 'error'
                      ? 'Scan failed'
                      : 'What we found'}
                </Text>
                {phase === 'results' && equipmentLabel ? (
                  <Text
                    style={[styles.subtitle, { color: palette.textSecondary }]}
                    numberOfLines={1}
                  >
                    Looks like: {equipmentLabel}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={closeSheet}
                hitSlop={12}
                style={[
                  styles.headerIcon,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <IconSymbol name="xmark" size={18} color={palette.textPrimary} />
              </Pressable>
            </View>

            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={[styles.preview, { backgroundColor: palette.surfaceAlt }]}
                contentFit="cover"
                transition={150}
              />
            ) : null}

            {phase === 'recognizing' ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={[styles.stateText, { color: palette.textSecondary }]}>
                  Matching your equipment to exercises…
                </Text>
              </View>
            ) : null}

            {phase === 'error' ? (
              <View style={styles.centerState}>
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={28}
                  color={palette.danger}
                />
                <Text style={[styles.stateText, { color: palette.textSecondary }]}>
                  {errorMessage}
                </Text>
                <Pressable
                  onPress={() => void handleScanPress()}
                  style={[styles.retryBtn, { backgroundColor: palette.primary }]}
                >
                  <Text style={[styles.retryText, { color: palette.white }]}>
                    Try again
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {phase === 'results' ? (
              <>
                <ScrollView
                  style={styles.resultsScroll}
                  contentContainerStyle={styles.resultsContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {matches.length > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.sectionHeader,
                          { color: palette.textSecondary },
                        ]}
                      >
                        Matches from the library
                      </Text>
                      {matches.map((match) => {
                        const isSelected = selected.has(match.entry.id)
                        return (
                          <Pressable
                            key={match.entry.id}
                            testID={`scan-match-${match.entry.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={
                              isSelected
                                ? `Remove ${match.entry.name}`
                                : `Add ${match.entry.name}`
                            }
                            onPress={() => handlePickMatch(match.entry)}
                            style={({ pressed }) => [
                              styles.card,
                              {
                                backgroundColor: palette.surface,
                                borderColor: isSelected
                                  ? palette.primary
                                  : palette.border,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.cardIcon,
                                { backgroundColor: palette.primaryMuted },
                              ]}
                            >
                              <IconSymbol
                                name={match.entry.iconName}
                                size={22}
                                color={palette.primary}
                              />
                            </View>
                            <View style={styles.cardBody}>
                              <Text
                                style={[
                                  styles.cardName,
                                  { color: palette.textPrimary },
                                ]}
                              >
                                {match.entry.name}
                              </Text>
                              <Text
                                style={[
                                  styles.cardMeta,
                                  { color: palette.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {confidenceLabel(match.confidence)} ·{' '}
                                {match.entry.bodyPart}
                              </Text>
                            </View>
                            <IconSymbol
                              name={isSelected ? 'checkmark' : 'plus'}
                              size={22}
                              color={
                                isSelected
                                  ? palette.primary
                                  : palette.textTertiary
                              }
                            />
                          </Pressable>
                        )
                      })}
                    </>
                  ) : null}

                  {customs.length > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.sectionHeader,
                          styles.sectionHeaderSpaced,
                          { color: palette.textSecondary },
                        ]}
                      >
                        Create from your photo
                      </Text>
                      {customs.map((custom, index) => {
                        const isCreating = creatingIndex === index
                        const group = custom.group as BodyGroup
                        const modality = custom.modality as ExerciseModality
                        return (
                          <Pressable
                            key={`${custom.name}-${index}`}
                            testID={`scan-custom-${index}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Create ${custom.name}`}
                            disabled={creatingIndex !== null}
                            onPress={() => void handleCreateCustom(custom, index)}
                            style={({ pressed }) => [
                              styles.card,
                              {
                                backgroundColor: palette.primaryMuted,
                                borderColor: palette.primaryBorder,
                                opacity:
                                  creatingIndex !== null && !isCreating
                                    ? 0.5
                                    : pressed
                                      ? 0.85
                                      : 1,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.cardIcon,
                                { backgroundColor: palette.primary },
                              ]}
                            >
                              <IconSymbol
                                name={ICON_BY_MODALITY[modality]}
                                size={22}
                                color={palette.white}
                              />
                            </View>
                            <View style={styles.cardBody}>
                              <Text
                                style={[
                                  styles.cardName,
                                  { color: palette.textPrimary },
                                ]}
                              >
                                {custom.name}
                              </Text>
                              <Text
                                style={[
                                  styles.cardMeta,
                                  { color: palette.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                New custom · {BODY_GROUP_LABELS[group] ?? group}
                              </Text>
                            </View>
                            {isCreating ? (
                              <ActivityIndicator
                                size="small"
                                color={palette.primary}
                              />
                            ) : (
                              <IconSymbol
                                name="plus.circle.fill"
                                size={22}
                                color={palette.primary}
                              />
                            )}
                          </Pressable>
                        )
                      })}
                    </>
                  ) : null}

                  {matches.length === 0 && customs.length === 0 ? (
                    <View style={styles.centerState}>
                      <IconSymbol
                        name="camera.fill"
                        size={28}
                        color={palette.textTertiary}
                      />
                      <Text
                        style={[
                          styles.stateText,
                          { color: palette.textSecondary },
                        ]}
                      >
                        {equipmentLabel
                          ? `We saw "${equipmentLabel}" but couldn't match an exercise. Try a clearer photo or add it manually.`
                          : "We couldn't spot any gym equipment. Try a clearer photo."}
                      </Text>
                      <Pressable
                        onPress={() => void handleScanPress()}
                        style={[
                          styles.retryBtn,
                          { backgroundColor: palette.primary },
                        ]}
                      >
                        <Text
                          style={[styles.retryText, { color: palette.white }]}
                        >
                          Scan again
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </ScrollView>

                {matches.length > 0 || customs.length > 0 ? (
                  <View
                    style={[
                      styles.footer,
                      { borderTopColor: palette.divider },
                    ]}
                  >
                    <Text
                      style={[styles.footerHint, { color: palette.textSecondary }]}
                      numberOfLines={1}
                    >
                      {matches.filter((m) => selected.has(m.entry.id)).length > 0
                        ? `${matches.filter((m) => selected.has(m.entry.id)).length} added · tap again to remove`
                        : 'Tap + to add to your workout'}
                    </Text>
                    <Pressable
                      testID="scan-done"
                      onPress={closeSheet}
                      style={({ pressed }) => [
                        styles.doneBtn,
                        {
                          backgroundColor: palette.primary,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Done"
                    >
                      <Text style={[styles.doneText, { color: palette.white }]}>
                        Done
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  scanButton: {
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '85%',
    width: '100%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    overflow: 'hidden',
    zIndex: 1,
  },
  // Results need a real height so the ScrollView gets a bounded viewport and
  // match rows stay tappable (maxHeight alone let content paint outside the
  // hit target on web).
  sheetResults: {
    height: '85%',
  },
  resultsScroll: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerHint: {
    ...typography.small,
    flex: 1,
  },
  doneBtn: {
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    ...typography.button,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  centerState: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.huge,
  },
  stateText: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  retryBtn: {
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...typography.button,
  },
  resultsContent: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionHeader: {
    ...typography.smallStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  sectionHeaderSpaced: {
    marginTop: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    ...typography.bodyStrong,
  },
  cardMeta: {
    ...typography.small,
    marginTop: 2,
  },
})
