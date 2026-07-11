import { useAction, useMutation } from 'convex/react'
import * as ImagePicker from 'expo-image-picker'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import {
  EQUIPMENT_CATALOG,
  type EquipmentCatalogItem,
} from '@/constants/equipment-catalog'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { compressAndUploadPhoto } from '@/utils/photoUpload'

import { archiveEquipment, removeEquipment } from './api'
import { EquipmentEditorModal } from './equipment-editor-modal'
import { SectionShell } from './section-shell'
import type { EquipmentScanSuggestion, UserEquipment } from './types'

interface EquipmentSectionProps {
  equipment: UserEquipment[]
}

export function EquipmentSection({ equipment }: EquipmentSectionProps) {
  const { palette } = useTheme()
  const archive = useMutation(archiveEquipment)
  const remove = useMutation(removeEquipment)
  const generateUploadUrl = useMutation(api.equipment.generateUploadUrl)
  const registerPhotoUpload = useMutation(api.equipment.registerPhotoUpload)
  const discardPhotoUpload = useMutation(api.equipment.discardPhotoUpload)
  const recognizeInventory = useAction(
    api.exerciseRecognition.recognizeInventoryFromImage,
  )
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EquipmentCatalogItem | null>(null)
  const [scanSuggestion, setScanSuggestion] =
    useState<EquipmentScanSuggestion | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const selectedByKey = useMemo(
    () => new Map(equipment.map((entry) => [entry.catalogKey, entry])),
    [equipment],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return EQUIPMENT_CATALOG
    return EQUIPMENT_CATALOG.filter((item) =>
      [item.label, item.description, ...item.searchTerms]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [search])
  const existing = editing ? selectedByKey.get(editing.key) : undefined

  const manageExisting = (item: EquipmentCatalogItem, entry: UserEquipment) => {
    Alert.alert(item.label, 'Choose what to do with this saved item.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Edit details',
        onPress: () => {
          setScanSuggestion(null)
          setEditing(item)
        },
      },
      {
        text: 'Archive',
        onPress: () => {
          void archive({ equipmentId: entry._id, archived: true }).catch((error) => {
            console.error('Equipment archive failed', error)
            Alert.alert('Could not archive equipment', 'Try again in a moment.')
          })
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void remove({ equipmentId: entry._id }).catch((error) => {
            console.error('Equipment delete failed', error)
            Alert.alert('Could not delete equipment', 'Try again in a moment.')
          })
        },
      },
    ])
  }

  const scanEquipment = async () => {
    if (isScanning) return
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access to identify equipment for your private inventory.',
      )
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      quality: 0.7,
    })
    const asset = result.canceled ? undefined : result.assets[0]
    if (!asset) return

    setIsScanning(true)
    let storageId: Id<'_storage'> | null = null
    try {
      storageId = (await compressAndUploadPhoto(
        asset.uri,
        generateUploadUrl,
      )) as Id<'_storage'>
      await registerPhotoUpload({ storageId })
      const recognized = await recognizeInventory({
        imageId: storageId,
        catalog: EQUIPMENT_CATALOG.map((item) => ({
          key: item.key,
          label: item.label,
        })),
      })
      const topMatch = recognized.matches[0]
      const item = topMatch
        ? EQUIPMENT_CATALOG.find(
            (candidate) => candidate.key === topMatch.catalogKey,
          )
        : undefined
      if (!topMatch || !item) {
        await discardPhotoUpload({ storageId })
        storageId = null
        Alert.alert(
          'No equipment match',
          recognized.summary ||
            'Try another angle or add the equipment from the catalog.',
        )
        return
      }
      setScanSuggestion({
        photoStorageId: storageId,
        photoUri: asset.uri,
        quantity: topMatch.quantity,
        minWeightKg: topMatch.suggestedMinWeightKg,
        maxWeightKg: topMatch.suggestedMaxWeightKg,
        adjustable: topMatch.adjustable,
        reason: topMatch.reason,
      })
      setEditing(item)
    } catch (error) {
      if (storageId) {
        await discardPhotoUpload({ storageId }).catch((discardError: unknown) => {
          console.info('Could not discard failed equipment scan', discardError)
        })
      }
      console.error('Inventory scan failed', error)
      Alert.alert(
        'Could not scan equipment',
        'Check your connection or add the item from the catalog.',
      )
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <>
      <SectionShell
        icon="dumbbell.fill"
        title="Home equipment"
        description="Saved equipment is an availability boundary, not a list every workout must use."
      >
        <Pressable
          onPress={() => void scanEquipment()}
          disabled={isScanning}
          accessibilityRole="button"
          accessibilityLabel="Scan home equipment with camera"
          style={[
            styles.scanButton,
            {
              backgroundColor: palette.primary,
              opacity: isScanning ? 0.65 : 1,
            },
          ]}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <IconSymbol name="camera.fill" size={18} color={palette.white} />
          )}
          <Text style={[styles.scanButtonText, { color: palette.white }]}>
            {isScanning ? 'Identifying equipment…' : 'Scan equipment'}
          </Text>
        </Pressable>

        <View
          style={[
            styles.search,
            { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}
        >
          <IconSymbol name="magnifyingglass" size={19} color={palette.textTertiary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search equipment"
            placeholderTextColor={palette.textTertiary}
            accessibilityLabel="Search home equipment"
            style={[styles.searchInput, { color: palette.textPrimary }]}
          />
          {search ? (
            <Pressable
              onPress={() => setSearch('')}
              accessibilityRole="button"
              accessibilityLabel="Clear equipment search"
              hitSlop={10}
            >
              <IconSymbol name="xmark" size={18} color={palette.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        {equipment.length > 0 ? (
          <View
            style={[
              styles.inventorySummary,
              { backgroundColor: palette.primaryMuted },
            ]}
          >
            <IconSymbol name="checkmark.circle.fill" size={18} color={palette.primary} />
            <Text style={[styles.inventoryText, { color: palette.textPrimary }]}>
              {equipment.length} active item{equipment.length === 1 ? '' : 's'} saved
            </Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {filtered.map((item) => {
            const saved = selectedByKey.get(item.key)
            return (
              <Pressable
                key={item.key}
                onPress={() =>
                  saved
                    ? manageExisting(item, saved)
                    : (setScanSuggestion(null), setEditing(item))
                }
                accessibilityRole="button"
                accessibilityLabel={`${saved ? 'Manage' : 'Add'} ${item.label}`}
                accessibilityState={{ selected: !!saved }}
                style={({ pressed }) => [
                  styles.catalogItem,
                  {
                    backgroundColor: saved ? palette.primaryMuted : palette.surfaceAlt,
                    borderColor: saved ? palette.primary : palette.border,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
              >
                <View style={styles.itemTop}>
                  <IconSymbol
                    name={item.icon}
                    size={24}
                    color={saved ? palette.primary : palette.textSecondary}
                  />
                  <IconSymbol
                    name={saved ? 'checkmark.circle.fill' : 'plus.circle.fill'}
                    size={18}
                    color={saved ? palette.primary : palette.textTertiary}
                  />
                </View>
                <Text
                  style={[styles.itemLabel, { color: palette.textPrimary }]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
                <Text
                  style={[styles.itemDescription, { color: palette.textSecondary }]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {filtered.length === 0 ? (
          <Text style={[styles.empty, { color: palette.textSecondary }]}>
            No catalog items match “{search}”.
          </Text>
        ) : null}

        <View
          style={[
            styles.photoNote,
            { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}
        >
          <IconSymbol name="lock.fill" size={16} color={palette.textSecondary} />
          <Text style={[styles.photoNoteText, { color: palette.textSecondary }]}>
            Camera scans suggest catalog items and useful details. You confirm
            every result before it joins your private inventory.
          </Text>
        </View>
      </SectionShell>

      <EquipmentEditorModal
        item={editing}
        existing={existing}
        scanSuggestion={scanSuggestion}
        visible={editing !== null}
        onClose={() => {
          setEditing(null)
          setScanSuggestion(null)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  scanButton: {
    minHeight: 48,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  scanButtonText: {
    ...typography.smallStrong,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
  },
  inventorySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inventoryText: { ...typography.smallStrong },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  catalogItem: {
    width: '48%',
    minHeight: 132,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  itemLabel: { ...typography.smallStrong },
  itemDescription: { ...typography.small, marginTop: spacing.xs },
  empty: { ...typography.body, textAlign: 'center', paddingVertical: spacing.xl },
  photoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  photoNoteText: { ...typography.small, flex: 1 },
})
