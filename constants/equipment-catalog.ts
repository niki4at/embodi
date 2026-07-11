import type { ComponentProps } from 'react'

import type { IconSymbol } from '@/components/ui/icon-symbol'

export type EquipmentCategory =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'recovery'

export type EquipmentCapability =
  | 'weightRange'
  | 'adjustable'
  | 'quantity'
  | 'resistance'
  | 'dimensions'

export interface EquipmentCatalogItem {
  key: string
  label: string
  category: EquipmentCategory
  icon: ComponentProps<typeof IconSymbol>['name']
  capabilities: EquipmentCapability[]
  searchTerms: string[]
  description: string
}

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  recovery: 'Recovery',
}

export const EQUIPMENT_CATALOG: EquipmentCatalogItem[] = [
  {
    key: 'dumbbells',
    label: 'Dumbbells',
    category: 'strength',
    icon: 'dumbbell.fill',
    capabilities: ['weightRange', 'adjustable', 'quantity'],
    searchTerms: ['free weights', 'hand weights'],
    description: 'Fixed or adjustable pairs',
  },
  {
    key: 'kettlebells',
    label: 'Kettlebells',
    category: 'strength',
    icon: 'dumbbell',
    capabilities: ['weightRange', 'adjustable', 'quantity'],
    searchTerms: ['kettle bell', 'free weights'],
    description: 'Single or paired bells',
  },
  {
    key: 'barbell',
    label: 'Barbell & plates',
    category: 'strength',
    icon: 'figure.strengthtraining.traditional',
    capabilities: ['weightRange', 'quantity'],
    searchTerms: ['olympic bar', 'weight plates'],
    description: 'Bar, collars, and available plates',
  },
  {
    key: 'bench',
    label: 'Workout bench',
    category: 'strength',
    icon: 'figure.strengthtraining.traditional',
    capabilities: ['adjustable'],
    searchTerms: ['incline bench', 'flat bench'],
    description: 'Flat or adjustable bench',
  },
  {
    key: 'squat-rack',
    label: 'Squat rack',
    category: 'strength',
    icon: 'figure.strengthtraining.traditional',
    capabilities: ['adjustable'],
    searchTerms: ['power rack', 'half rack', 'cage'],
    description: 'Rack, stands, or power cage',
  },
  {
    key: 'pull-up-bar',
    label: 'Pull-up bar',
    category: 'strength',
    icon: 'figure.strengthtraining.traditional',
    capabilities: [],
    searchTerms: ['chin up bar', 'door bar'],
    description: 'Doorway, wall, or rack mounted',
  },
  {
    key: 'resistance-bands',
    label: 'Resistance bands',
    category: 'strength',
    icon: 'repeat',
    capabilities: ['resistance', 'quantity'],
    searchTerms: ['loop bands', 'tube bands', 'mini bands'],
    description: 'Loops, tubes, or long bands',
  },
  {
    key: 'suspension-trainer',
    label: 'Suspension trainer',
    category: 'strength',
    icon: 'figure.flexibility',
    capabilities: [],
    searchTerms: ['trx', 'straps'],
    description: 'Door or ceiling anchored straps',
  },
  {
    key: 'cable-machine',
    label: 'Cable machine',
    category: 'strength',
    icon: 'figure.strengthtraining.traditional',
    capabilities: ['weightRange', 'adjustable'],
    searchTerms: ['functional trainer', 'pulley'],
    description: 'Single or dual pulley station',
  },
  {
    key: 'treadmill',
    label: 'Treadmill',
    category: 'cardio',
    icon: 'figure.run',
    capabilities: ['adjustable'],
    searchTerms: ['walking pad', 'running machine'],
    description: 'Running deck or walking pad',
  },
  {
    key: 'stationary-bike',
    label: 'Stationary bike',
    category: 'cardio',
    icon: 'bicycle',
    capabilities: ['adjustable', 'resistance'],
    searchTerms: ['spin bike', 'exercise bike'],
    description: 'Upright, spin, or recumbent',
  },
  {
    key: 'rowing-machine',
    label: 'Rowing machine',
    category: 'cardio',
    icon: 'figure.pool.swim',
    capabilities: ['resistance'],
    searchTerms: ['rower', 'erg'],
    description: 'Air, water, or magnetic rower',
  },
  {
    key: 'jump-rope',
    label: 'Jump rope',
    category: 'cardio',
    icon: 'bolt.fill',
    capabilities: ['adjustable'],
    searchTerms: ['skipping rope', 'speed rope'],
    description: 'Speed or weighted rope',
  },
  {
    key: 'yoga-mat',
    label: 'Exercise mat',
    category: 'mobility',
    icon: 'figure.yoga',
    capabilities: ['dimensions'],
    searchTerms: ['yoga mat', 'floor mat'],
    description: 'Cushioned floor space',
  },
  {
    key: 'foam-roller',
    label: 'Foam roller',
    category: 'recovery',
    icon: 'figure.cooldown',
    capabilities: ['dimensions'],
    searchTerms: ['massage roller', 'mobility roller'],
    description: 'Smooth or textured roller',
  },
  {
    key: 'massage-gun',
    label: 'Massage gun',
    category: 'recovery',
    icon: 'wand.and.stars',
    capabilities: ['adjustable'],
    searchTerms: ['percussion massager'],
    description: 'Percussion recovery device',
  },
]

export function findEquipmentCatalogItem(key: string) {
  return EQUIPMENT_CATALOG.find((item) => item.key === key)
}
