import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PillButton } from '@/components/ui/pill-button'
import { Chip, Eyebrow } from '@/components/ui/primitives'
import { spacing, typography } from '@/constants/design'
import { FLARE_REGIONS, labelForRegion } from '@/constants/flare-regions'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

/**
 * Flare-up mode as a small pill under the greeting. Off: outlined
 * "Flare-up today?". On: pink "Flare-up mode on". Tapping opens a sheet to
 * toggle the mode and mark where it is flaring.
 */
export function FlareChip() {
  const { palette } = useTheme()
  const flare = useQuery(api.flareUp.getFlareUp)
  const setFlareUp = useMutation(api.flareUp.setFlareUp)

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(false)
  const [regions, setRegions] = useState<string[]>([])
  const hydrated = useRef(false)

  useEffect(() => {
    if (flare && !hydrated.current) {
      setActive(flare.active)
      setRegions(flare.regions)
      hydrated.current = true
    }
  }, [flare])

  const persist = useCallback(
    (nextActive: boolean, nextRegions: string[]) => {
      setFlareUp({ active: nextActive, regions: nextRegions }).catch((error) => {
        console.error('Failed to save flare-up state:', error)
      })
    },
    [setFlareUp],
  )

  const handleToggle = useCallback(
    (next: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      setActive(next)
      const nextRegions = next ? regions : []
      if (!next) setRegions([])
      persist(next, nextRegions)
    },
    [regions, persist],
  )

  const handleToggleRegion = useCallback(
    (id: string) => {
      const next = regions.includes(id)
        ? regions.filter((r) => r !== id)
        : [...regions, id]
      setRegions(next)
      if (!active) setActive(true)
      persist(true, next)
    },
    [regions, active, persist],
  )

  if (flare === undefined) return null

  return (
    <>
      <Chip
        label={active ? 'Flare-up mode on' : 'Flare-up today?'}
        onPress={() => setOpen(true)}
        accessibilityLabel={
          active
            ? `Flare-up mode on${regions.length ? `: ${regions.map(labelForRegion).join(', ')}` : ''}. Edit.`
            : 'Flare-up today? Turn on flare-up mode.'
        }
        leading={
          <View
            style={[
              styles.dot,
              { backgroundColor: active ? palette.flare : palette.textTertiary },
            ]}
          />
        }
        style={[
          styles.chip,
          active && { backgroundColor: palette.flareMuted, borderColor: palette.flare },
        ]}
      />

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Flare-up mode"
        subtitle="When it's on, the coach eases off the areas you mark and steers around related moves."
        footer={<PillButton label="Done" onPress={() => setOpen(false)} />}
      >
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: palette.textPrimary }]}>
            Flare-up today
          </Text>
          <Switch
            value={active}
            onValueChange={handleToggle}
            trackColor={{ false: palette.surfaceHigh, true: palette.flare }}
            thumbColor={palette.white}
            accessibilityLabel="Toggle flare-up mode"
          />
        </View>

        <Eyebrow style={styles.eyebrow}>Where is it flaring?</Eyebrow>
        <View style={styles.regions}>
          {FLARE_REGIONS.map((region) => (
            <Chip
              key={region.id}
              label={region.label}
              selected={regions.includes(region.id)}
              onPress={() => handleToggleRegion(region.id)}
            />
          ))}
        </View>
        {active && regions.length > 0 ? (
          <Text style={[styles.note, { color: palette.textSecondary }]}>
            Got it. Today eases off{' '}
            {regions.map(labelForRegion).join(', ').toLowerCase()}.
          </Text>
        ) : null}
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 30,
    paddingHorizontal: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    ...typography.bodyStrong,
  },
  eyebrow: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  regions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  note: {
    ...typography.small,
    marginTop: spacing.lg,
  },
})
