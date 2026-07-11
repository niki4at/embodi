import type { GenericId } from 'convex/values'

export type TrainingEnvironment = 'home' | 'gym' | 'outdoors' | 'travel'
export type EquipmentIntent = 'available' | 'bodyweight' | 'treadmill'
export type SocialLocationSharing = 'private' | 'generic'
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface DayRhythm {
  day: Weekday
  defaultEnvironment: TrainingEnvironment
  defaultEquipmentIntent: EquipmentIntent
  morning?: TrainingEnvironment
  morningEquipmentIntent?: EquipmentIntent
  evening?: TrainingEnvironment
  eveningEquipmentIntent?: EquipmentIntent
}

export interface TrainingPreferences {
  _id: GenericId<'training_preferences'>
  locationEnabled: boolean
  socialLocationSharing: SocialLocationSharing
  weeklyRhythm: DayRhythm[]
  learningResetAt?: number
}

export interface EquipmentDetails {
  minWeightKg?: number
  maxWeightKg?: number
  adjustable?: boolean
  quantity?: number
  resistance?: string
  dimensions?: string
  notes?: string
}

export interface UserEquipment {
  _id: GenericId<'user_equipment'>
  catalogKey: string
  label: string
  details: EquipmentDetails
  photoStorageIds: GenericId<'_storage'>[]
  archived: boolean
  updatedAt: number
}

export type TrainingPlaceKind = 'home' | 'gym'

export interface TrainingPlace {
  _id: GenericId<'training_places'>
  kind: TrainingPlaceKind
  name: string
  radiusMeters: number
  latitude?: number
  longitude?: number
}

export interface CapturedCoordinates {
  latitude: number
  longitude: number
}

export interface EquipmentScanSuggestion {
  photoStorageId: GenericId<'_storage'>
  photoUri: string
  quantity: number
  minWeightKg?: number
  maxWeightKg?: number
  adjustable?: boolean
  reason: string
}

export const WEEKDAYS: { key: Weekday; short: string; label: string }[] = [
  { key: 'monday', short: 'Mon', label: 'Monday' },
  { key: 'tuesday', short: 'Tue', label: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', label: 'Wednesday' },
  { key: 'thursday', short: 'Thu', label: 'Thursday' },
  { key: 'friday', short: 'Fri', label: 'Friday' },
  { key: 'saturday', short: 'Sat', label: 'Saturday' },
  { key: 'sunday', short: 'Sun', label: 'Sunday' },
]
