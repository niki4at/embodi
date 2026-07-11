import { useMutation } from 'convex/react'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

import { IconSymbol } from '@/components/ui/icon-symbol'
import type { EquipmentCatalogItem } from '@/constants/equipment-catalog'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { compressAndUploadPhoto } from '@/utils/photoUpload'

import {
  generateEquipmentUploadUrl,
  upsertEquipment,
} from './api'
import type {
  EquipmentDetails,
  EquipmentScanSuggestion,
  UserEquipment,
} from './types'

interface EquipmentEditorModalProps {
  item: EquipmentCatalogItem | null
  existing?: UserEquipment
  scanSuggestion?: EquipmentScanSuggestion | null
  visible: boolean
  onClose: () => void
}

function parseOptionalNumber(value: string) {
  const parsed = Number(value)
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined
}

export function EquipmentEditorModal({
  item,
  existing,
  scanSuggestion,
  visible,
  onClose,
}: EquipmentEditorModalProps) {
  const { palette, resolved } = useTheme()
  const saveEquipment = useMutation(upsertEquipment)
  const createUploadUrl = useMutation(generateEquipmentUploadUrl)
  const registerPhotoUpload = useMutation(api.equipment.registerPhotoUpload)
  const discardPhotoUpload = useMutation(api.equipment.discardPhotoUpload)
  const [minWeight, setMinWeight] = useState('')
  const [maxWeight, setMaxWeight] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [resistance, setResistance] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [notes, setNotes] = useState('')
  const [adjustable, setAdjustable] = useState(false)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [photoStorageIds, setPhotoStorageIds] = useState<
    UserEquipment['photoStorageIds']
  >([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const details = existing?.details
    setMinWeight(
      scanSuggestion?.minWeightKg?.toString() ??
        details?.minWeightKg?.toString() ??
        '',
    )
    setMaxWeight(
      scanSuggestion?.maxWeightKg?.toString() ??
        details?.maxWeightKg?.toString() ??
        '',
    )
    setQuantity(
      scanSuggestion?.quantity.toString() ??
        details?.quantity?.toString() ??
        '1',
    )
    setResistance(details?.resistance ?? '')
    setDimensions(details?.dimensions ?? '')
    setNotes(details?.notes ?? '')
    setAdjustable(scanSuggestion?.adjustable ?? details?.adjustable ?? false)
    setPhotoStorageIds(
      scanSuggestion
        ? [scanSuggestion.photoStorageId]
        : (existing?.photoStorageIds ?? []),
    )
    setPhotoUri(scanSuggestion?.photoUri ?? null)
  }, [existing, item, scanSuggestion, visible])

  if (!item) return null

  const discardPendingPhotos = async () => {
    const existingIds = new Set(existing?.photoStorageIds ?? [])
    const pendingIds = photoStorageIds.filter((id) => !existingIds.has(id))
    for (const storageId of pendingIds) {
      await discardPhotoUpload({ storageId }).catch((error: unknown) => {
        console.info('Could not discard pending equipment photo', error)
      })
    }
  }

  const closeWithoutSaving = async () => {
    await discardPendingPhotos()
    onClose()
  }

  const uploadPhoto = async (uri: string) => {
    setPhotoUri(uri)
    setIsUploading(true)
    try {
      const storageId = await compressAndUploadPhoto(uri, createUploadUrl)
      await registerPhotoUpload({
        storageId: storageId as UserEquipment['photoStorageIds'][number],
      })
      await discardPendingPhotos()
      setPhotoStorageIds([
        storageId as UserEquipment['photoStorageIds'][number],
      ])
    } catch (error) {
      console.error('Equipment photo upload failed', error)
      setPhotoUri(null)
      Alert.alert('Could not upload photo', 'Check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access to attach a private equipment photo.',
      )
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      quality: 0.7,
    })
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset) await uploadPhoto(asset.uri)
  }

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        'Photos access needed',
        'Allow photo access to attach a private equipment photo.',
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset) await uploadPhoto(asset.uri)
  }

  const save = async () => {
    if (isSaving || isUploading) return
    setIsSaving(true)
    const details: EquipmentDetails = {
      minWeightKg: parseOptionalNumber(minWeight),
      maxWeightKg: parseOptionalNumber(maxWeight),
      quantity: parseOptionalNumber(quantity),
      adjustable,
      resistance: resistance.trim() || undefined,
      dimensions: dimensions.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      await saveEquipment({
        equipmentId: existing?._id,
        catalogKey: item.key,
        label: item.label,
        details,
        photoStorageIds,
      })
      onClose()
    } catch (error) {
      console.error('Equipment save failed', error)
      Alert.alert('Could not save equipment', 'Check your details and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const textColor = palette.textPrimary
  const placeholderColor = palette.textTertiary
  const hasCapability = (capability: EquipmentCatalogItem['capabilities'][number]) =>
    item.capabilities.includes(capability)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => void closeWithoutSaving()}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.bg }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => void closeWithoutSaving()}
            accessibilityRole="button"
            accessibilityLabel="Close equipment details"
            style={[styles.headerButton, { borderColor: palette.border }]}
          >
            <IconSymbol
              name="xmark"
              size={19}
              color={resolved === 'dark' ? palette.white : palette.textPrimary}
            />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            {existing ? 'Equipment details' : `Add ${item.label}`}
          </Text>
          <Pressable
            onPress={() => void save()}
            disabled={isSaving || isUploading}
            accessibilityRole="button"
            accessibilityLabel="Save equipment"
            style={[
              styles.saveButton,
              {
                backgroundColor: palette.primary,
                opacity: isSaving || isUploading ? 0.6 : 1,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <Text style={[styles.saveText, { color: palette.white }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.summary,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <View
                style={[styles.summaryIcon, { backgroundColor: palette.primaryMuted }]}
              >
                <IconSymbol name={item.icon} size={28} color={palette.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: textColor }]}>{item.label}</Text>
                <Text style={[styles.itemDescription, { color: palette.textSecondary }]}>
                  {item.description}
                </Text>
              </View>
            </View>

            {hasCapability('weightRange') ? (
              <View style={styles.fieldRow}>
                <Field
                  label="Lightest (kg)"
                  value={minWeight}
                  onChangeText={setMinWeight}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Heaviest (kg)"
                  value={maxWeight}
                  onChangeText={setMaxWeight}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}

            {hasCapability('quantity') ? (
              <Field
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
            ) : null}

            {hasCapability('resistance') ? (
              <Field
                label="Resistance levels"
                value={resistance}
                onChangeText={setResistance}
                placeholder="Light, medium, heavy"
              />
            ) : null}

            {hasCapability('dimensions') ? (
              <Field
                label="Size"
                value={dimensions}
                onChangeText={setDimensions}
                placeholder="Optional dimensions"
              />
            ) : null}

            {hasCapability('adjustable') ? (
              <View
                style={[
                  styles.switchRow,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <View style={styles.flex}>
                  <Text style={[styles.switchTitle, { color: textColor }]}>
                    Adjustable
                  </Text>
                  <Text style={[styles.switchSubtitle, { color: palette.textSecondary }]}>
                    The load, height, or setup can change
                  </Text>
                </View>
                <Switch
                  value={adjustable}
                  onValueChange={setAdjustable}
                  accessibilityLabel={`${item.label} is adjustable`}
                  trackColor={{ false: palette.surfaceHigh, true: palette.primary }}
                  thumbColor={palette.white}
                />
              </View>
            ) : null}

            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Condition, attachments, or limits"
              multiline
            />

            <View>
              <Text style={[styles.label, { color: palette.textSecondary }]}>
                Private photo
              </Text>
              <Text style={[styles.photoHelp, { color: palette.textTertiary }]}>
                Photos stay private. Embodi can suggest inventory details, but
                nothing is saved until you confirm.
              </Text>
              {scanSuggestion?.reason ? (
                <Text style={[styles.scanReason, { color: palette.primary }]}>
                  Scan suggestion: {scanSuggestion.reason}
                </Text>
              ) : null}
              {photoUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
                  {isUploading ? (
                    <View style={styles.previewLoading}>
                      <ActivityIndicator color={palette.white} />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.photoActions}>
                <PhotoButton
                  icon="camera.fill"
                  label="Take photo"
                  onPress={() => void takePhoto()}
                />
                <PhotoButton
                  icon="photo.on.rectangle"
                  label="Choose photo"
                  onPress={() => void choosePhoto()}
                />
              </View>
              {photoStorageIds.length > 0 ? (
                <Text style={[styles.savedPhoto, { color: palette.success }]}>
                  {photoStorageIds.length} private photo
                  {photoStorageIds.length === 1 ? '' : 's'} attached
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )

  function Field({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    multiline,
  }: {
    label: string
    value: string
    onChangeText: (value: string) => void
    placeholder?: string
    keyboardType?: 'decimal-pad' | 'number-pad'
    multiline?: boolean
  }) {
    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType={keyboardType}
          multiline={multiline}
          accessibilityLabel={label}
          style={[
            styles.input,
            multiline && styles.multiline,
            {
              color: textColor,
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        />
      </View>
    )
  }

  function PhotoButton({
    icon,
    label,
    onPress,
  }: {
    icon: React.ComponentProps<typeof IconSymbol>['name']
    label: string
    onPress: () => void
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.photoButton,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            opacity: isUploading ? 0.5 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <IconSymbol name={icon} size={18} color={palette.primary} />
        <Text style={[styles.photoButtonText, { color: textColor }]}>{label}</Text>
      </Pressable>
    )
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
  },
  saveButton: {
    minWidth: 70,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  saveText: { ...typography.smallStrong },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { ...typography.bodyStrong },
  itemDescription: { ...typography.small, marginTop: spacing.xs },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: { flex: 1, gap: spacing.sm },
  label: { ...typography.smallStrong },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  multiline: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  switchTitle: { ...typography.bodyStrong },
  switchSubtitle: { ...typography.small, marginTop: spacing.xs },
  photoHelp: { ...typography.small, marginTop: spacing.xs },
  scanReason: { ...typography.smallStrong, marginTop: spacing.sm },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  photoButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoButtonText: { ...typography.smallStrong },
  previewWrap: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  preview: { width: '100%', height: '100%' },
  previewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  savedPhoto: { ...typography.smallStrong, marginTop: spacing.sm },
})
