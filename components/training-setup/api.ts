import { makeFunctionReference } from 'convex/server'
import type { GenericId } from 'convex/values'

import type {
  DayRhythm,
  EquipmentDetails,
  SocialLocationSharing,
  TrainingPlaceKind,
  TrainingPreferences,
  UserEquipment,
} from './types'

export const getTrainingPreferences = makeFunctionReference<
  'query',
  Record<string, never>,
  TrainingPreferences | null
>('trainingPreferences:get')

export const updateTrainingPreferences = makeFunctionReference<
  'mutation',
  {
    locationEnabled?: boolean
    socialLocationSharing?: SocialLocationSharing
    weeklyRhythm?: DayRhythm[]
    resetLearnedPatterns?: boolean
  },
  null
>('trainingPreferences:update')

export const listEquipment = makeFunctionReference<
  'query',
  Record<string, never>,
  UserEquipment[]
>('equipment:list')

export const upsertEquipment = makeFunctionReference<
  'mutation',
  {
    equipmentId?: GenericId<'user_equipment'>
    catalogKey: string
    label: string
    details: EquipmentDetails
    photoStorageIds: GenericId<'_storage'>[]
  },
  GenericId<'user_equipment'>
>('equipment:upsert')

export const archiveEquipment = makeFunctionReference<
  'mutation',
  { equipmentId: GenericId<'user_equipment'>; archived: boolean },
  null
>('equipment:archive')

export const removeEquipment = makeFunctionReference<
  'mutation',
  { equipmentId: GenericId<'user_equipment'> },
  null
>('equipment:remove')

export const generateEquipmentUploadUrl = makeFunctionReference<
  'mutation',
  Record<string, never>,
  string
>('equipment:generateUploadUrl')

export const listTrainingPlaces = makeFunctionReference<
  'action',
  Record<string, never>,
  {
    _id: GenericId<'training_places'>
    label: string
    trainingEnvironment: 'home' | 'gym' | 'outdoors' | 'travel'
    equipmentIntent?: 'available' | 'bodyweight' | 'treadmill'
    radiusM: number
    latitude: number
    longitude: number
    createdAt: number
    updatedAt: number
  }[]
>('trainingPlaceActions:list')

export const saveTrainingPlace = makeFunctionReference<
  'action',
  {
    placeId?: GenericId<'training_places'>
    trainingEnvironment: TrainingPlaceKind
    equipmentIntent?: 'available' | 'bodyweight' | 'treadmill'
    label: string
    radiusM: number
    latitude: number
    longitude: number
  },
  GenericId<'training_places'>
>('trainingPlaceActions:save')

export const removeTrainingPlace = makeFunctionReference<
  'mutation',
  { placeId: GenericId<'training_places'> },
  null
>('trainingPlaces:deletePlace')
